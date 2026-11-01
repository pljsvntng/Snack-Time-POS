const pool = require('../config/db');
const { timestamp } = require('../utils/dates');
const { number } = require('../utils/validation');
const Decimal = require('decimal.js');
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { generateOrderNumber } = require('../utils/orderNumber');

// Loads a product plus its option groups/options, for validating an order line.
async function loadProductForOrder(connection, productId) {
  const { rows: productRows } = await connection.query(
    `SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
    [productId]
  );
  if (!productRows.length) throw new ApiError(400, 'One of the products in this order no longer exists.');
  const product = productRows[0];
  if (!product.available) throw new ApiError(400, `"${product.name}" is currently unavailable.`);

  const { rows: groups } = await connection.query(`SELECT * FROM option_groups WHERE product_id = $1`, [productId]);
  const { rows: options } = groups.length
    ? await connection.query(
        `SELECT * FROM options WHERE option_group_id = ANY($1::integer[])`,
        [groups.map((g) => g.id)]
      )
    : { rows: [] };

  return { product, groups, options };
}

// Validates the customer's chosen option ids against a product's option groups,
// enforcing required single/multi selection rules, and returns the resolved
// option rows (with group name attached) plus the total price modifier.
function resolveOptions(groups, options, selectedOptionIds) {
  if (!Array.isArray(selectedOptionIds || [])) throw new ApiError(400, 'Selected options must be an array.');
  const selectedSet = new Set((selectedOptionIds || []).map((id) => number(id, 'Option', { min: 1, integer: true })));
  if ([...selectedSet].some((id) => !options.some((o) => o.id === id))) throw new ApiError(400, 'An option does not belong to this product.');
  const resolved = [];

  for (const group of groups) {
    const groupOptionIds = options.filter((o) => o.option_group_id === group.id).map((o) => o.id);
    const chosenInGroup = groupOptionIds.filter((id) => selectedSet.has(id));

    if (group.is_required && chosenInGroup.length === 0) {
      throw new ApiError(400, `Please select a ${group.name.toLowerCase()}.`);
    }
    if (group.selection_type === 'single' && chosenInGroup.length > 1) {
      throw new ApiError(400, `Only one ${group.name.toLowerCase()} may be selected.`);
    }

    for (const optionId of chosenInGroup) {
      const option = options.find((o) => o.id === optionId);
      resolved.push({ ...option, group_name: group.name });
    }
  }

  const modifierTotal = resolved.reduce((sum, o) => sum.plus(o.price_modifier), new Decimal(0)).toFixed(2);
  return { resolved, modifierTotal };
}

// POST /api/orders
const createOrder = asyncHandler(async (req, res) => {
  const { items, discount_id, payment_method, cash_received } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Cannot complete an order with no items.');
  }
  if (!['cash', 'gcash', 'other'].includes(payment_method)) {
    throw new ApiError(400, 'Please select a valid payment method.');
  }
  for (const item of items) {
    if (!item || typeof item !== 'object') throw new ApiError(400, 'Invalid order item.');
    number(item.product_id, 'Product', { min: 1, integer: true });
    item.quantity = number(item.quantity, 'Quantity', { min: 1, integer: true });
    if (!item.product_id || !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new ApiError(400, 'Each order item needs a product and a whole-number quantity of at least 1.');
    }
  }

  if (payment_method === 'cash') number(cash_received, 'Cash received');
  const requestId=req.body.request_id;
  if(requestId!==undefined&&(typeof requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requestId)))throw new ApiError(400,'A valid checkout identifier is required.');
  const requestHash=requestId?require('crypto').createHash('sha256').update(JSON.stringify({
    items:items.map(item=>({product_id:Number(item.product_id),quantity:item.quantity,selected_option_ids:Array.isArray(item.selected_option_ids)?item.selected_option_ids.map(id=>number(id,'Option',{min:1,integer:true})).sort((a,b)=>a-b):item.selected_option_ids??[]})),
    discount_id:discount_id?number(discount_id,'Discount',{min:1,integer:true}):null,payment_method,
    cash_received:payment_method==='cash'?new Decimal(cash_received).toFixed(2):null,
    expected_total:req.body.expected_total===undefined?null:new Decimal(number(req.body.expected_total,'Expected total')).toFixed(2)
  })).digest('hex'):null;
  const connection = await pool.connect();

  try {
    await connection.query('BEGIN');
    await connection.query("SET LOCAL lock_timeout = '10s'");
    // Transaction advisory lock releases automatically on commit, rollback, or disconnect.
    await connection.query('SELECT pg_advisory_xact_lock(731042, 1)');
    // Replay before checking today's stock/prices: a committed sale may have
    // consumed the last item even when its original HTTP reply was lost.
    if(requestId){
      const {rows:[saved]}=await connection.query('SELECT request_hash,response FROM online_checkouts WHERE user_id=$1 AND request_id=$2',[req.user.id,requestId]);
      if(saved){
        if(saved.request_hash!==requestHash)throw new ApiError(409,'Checkout identifier already belongs to a different sale. Review transaction history before starting another order.');
        await connection.query('COMMIT');return res.status(201).json(saved.response);
      }
    }

    // ---- Resolve each line item: price, chosen options, snapshot data ----
    const resolvedItems = [];
    for (const item of items) {
      const { product, groups, options } = await loadProductForOrder(connection, item.product_id);
      const { resolved, modifierTotal } = resolveOptions(groups, options, item.selected_option_ids);
      const unitPrice = new Decimal(product.price).plus(modifierTotal).toFixed(2);
      const subtotal = new Decimal(unitPrice).times(item.quantity).toFixed(2);

      resolvedItems.push({ product, options: resolved, unitPrice, subtotal, quantity: item.quantity });
    }

    // ---- Check direct product stock (for products sold by piece, e.g. Siomai) ----
    // Totalled per product, because the same product can appear on more than one line (different options).
    const trackedQty = new Map(); // product_id -> total quantity across all lines
    for (const line of resolvedItems) {
      if (line.product.track_stock) {
        trackedQty.set(line.product.id, (trackedQty.get(line.product.id) || 0) + line.quantity);
      }
    }
    for (const line of resolvedItems) {
      if (line.product.track_stock && Number(line.product.stock) < trackedQty.get(line.product.id)) {
        throw new ApiError(400,
          `Insufficient Stock: only ${Number(line.product.stock)} of "${line.product.name}" left. Please reduce the quantity.`);
      }
    }

    // ---- Check ingredient stock (base recipe + chosen options), aggregated across the order ----
    const requiredByIngredient = new Map(); // ingredient_id -> total quantity required

    for (const line of resolvedItems) {
      const { rows: baseIngredients } = await connection.query(
        `SELECT ingredient_id, quantity_required FROM product_ingredients WHERE product_id = $1`,
        [line.product.id]
      );
      for (const bi of baseIngredients) {
        const need = new Decimal(bi.quantity_required).times(line.quantity);
        requiredByIngredient.set(bi.ingredient_id, new Decimal(requiredByIngredient.get(bi.ingredient_id) || 0).plus(need));
      }

      for (const opt of line.options) {
        const { rows: optIngredients } = await connection.query(
          `SELECT ingredient_id, quantity_required FROM option_ingredients WHERE option_id = $1`,
          [opt.id]
        );
        for (const oi of optIngredients) {
          const need = new Decimal(oi.quantity_required).times(line.quantity);
          requiredByIngredient.set(oi.ingredient_id, new Decimal(requiredByIngredient.get(oi.ingredient_id) || 0).plus(need));
        }
      }
    }

    // Round away floating-point noise (e.g. 0.1 x 3) so exact-stock orders are not rejected by accident.
    for (const [ingredientId, needed] of requiredByIngredient.entries()) {
      requiredByIngredient.set(ingredientId, needed.toFixed(2));
    }

    if (requiredByIngredient.size > 0) {
      const ingredientIds = [...requiredByIngredient.keys()];
      // The rows are locked (FOR UPDATE) until commit, so two cashiers cannot both spend the same stock.
      const { rows: stockRows } = await connection.query(
        `SELECT id, name, unit, current_stock FROM ingredients WHERE id = ANY($1::integer[]) FOR UPDATE`,
        [ingredientIds]
      );
      const stockById = new Map(stockRows.map((r) => [r.id, r]));
      const fmt = (n) => String(Number(Number(n).toFixed(2)));

      const shortages = [];
      for (const [ingredientId, needed] of requiredByIngredient.entries()) {
        const row = stockById.get(ingredientId);
        const available = row ? Number(row.current_stock) : 0;
        if (new Decimal(available).lt(needed)) {
          shortages.push(`${row ? row.name : 'an ingredient'} (needs ${fmt(needed)} ${row ? row.unit : ''}, only ${fmt(available)} available)`);
        }
      }
      if (shortages.length) {
        throw new ApiError(400, `Insufficient Stock: ${shortages.join('; ')}. Please reduce the quantity or remove the item.`);
      }
    }

    // ---- Compute totals ----
    const subtotal = resolvedItems.reduce((sum, l) => sum.plus(l.subtotal), new Decimal(0)).toFixed(2);

    let discountAmount = 0;
    let discountRow = null;
    if (discount_id) {
      const { rows: discountRows } = await connection.query(
        `SELECT * FROM discounts WHERE id = $1 AND active = 1`,
        [discount_id]
      );
      if (!discountRows.length) throw new ApiError(400, 'This discount is no longer available.');
      if (discountRows.length) {
        discountRow = discountRows[0];
        discountAmount = discountRow.type === 'percent'
          ? new Decimal(subtotal).times(discountRow.value).dividedBy(100)
          : new Decimal(discountRow.value);
        number(discountRow.value, 'Discount value');
        if (discountRow.type === 'percent' && Number(discountRow.value) > 100) throw new ApiError(400, 'Invalid discount percentage.');
        discountAmount = Decimal.min(discountAmount, subtotal).toFixed(2);
      }
    }

    const total = new Decimal(subtotal).minus(discountAmount).toFixed(2);
    if (req.body.expected_total !== undefined && !new Decimal(number(req.body.expected_total, 'Expected total')).toDecimalPlaces(2).eq(total)) {
      throw new ApiError(409, 'Prices or discounts changed. Clear and rebuild the order using the refreshed catalog before paying.');
    }

    let cashReceivedValue = null;
    let changeAmount = null;
    if (payment_method === 'cash') {
      if (cash_received === undefined || cash_received === null) {
        throw new ApiError(400, 'Please enter the amount received.');
      }
      if (new Decimal(cash_received).lt(total)) {
        throw new ApiError(400, 'Insufficient payment.');
      }
      cashReceivedValue = new Decimal(cash_received).toFixed(2);
      changeAmount = new Decimal(cashReceivedValue).minus(total).toFixed(2);
    }

    // ---- Persist the order ----
    const orderNumber = await generateOrderNumber(connection);

    const orderResult = await connection.query(
      `INSERT INTO orders (order_number, user_id, subtotal, discount_id, discount_amount, total,
         payment_method, cash_received, change_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed') RETURNING id`,
      [orderNumber, req.user.id, subtotal, discountRow?.id || null, discountAmount, total,
        payment_method, cashReceivedValue, changeAmount]
    );
    const orderId = orderResult.rows[0].id;

    for (const line of resolvedItems) {
      const itemResult = await connection.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [orderId, line.product.id, line.product.name, line.unitPrice, line.quantity, line.subtotal]
      );
      const orderItemId = itemResult.rows[0].id;

      for (const opt of line.options) {
        await connection.query(
          `INSERT INTO order_item_options (order_item_id, option_group_name, option_name, price_modifier)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [orderItemId, opt.group_name, opt.name, opt.price_modifier]
        );
      }

      if (line.product.track_stock) {
        // Relative update, so several lines of the same product each take their share correctly.
        await connection.query(`UPDATE products SET stock = stock - $1 WHERE id = $2`, [line.quantity, line.product.id]);
      }
    }

    // ---- Deduct ingredient stock & log inventory transactions ----
    for (const [ingredientId, needed] of requiredByIngredient.entries()) {
      // Guarded, atomic deduction: stock can never be taken below zero, whatever else happens.
      const upd = await connection.query(
        `UPDATE ingredients SET current_stock = current_stock - $1 WHERE id = $2 AND current_stock >= $3`,
        [needed, ingredientId, needed]
      );
      if (upd.rowCount !== 1) {
        throw new ApiError(400, 'Insufficient Stock: ingredient stock changed while the order was being saved. Please try again.');
      }
      const { rows: [current] } = await connection.query(
        `SELECT current_stock FROM ingredients WHERE id = $1`, [ingredientId]
      );
      const newStock = current.current_stock;
      await connection.query(
        `INSERT INTO inventory_transactions (ingredient_id, type, quantity, resulting_stock, reason, reference_order_id, user_id)
         VALUES ($1, 'deduct', $2, $3, $4, $5, $6) RETURNING id`,
        [ingredientId, needed, newStock, `Sold on order ${orderNumber}`, orderId, req.user.id]
      );
    }

    const response={
      id: orderId,
      order_number: orderNumber,
      created_at: new Date().toISOString(),
      subtotal: Number(subtotal), discount_amount: Number(discountAmount), total: Number(total),
      payment_method, cash_received: cashReceivedValue === null ? null : Number(cashReceivedValue), change_amount: changeAmount === null ? null : Number(changeAmount),
      items: resolvedItems.map((l) => ({
        product_id: l.product.id, name: l.product.name, unit_price: l.unitPrice,
        quantity: l.quantity, subtotal: l.subtotal,
        options: l.options.map((o) => ({ group: o.group_name, name: o.name, price_modifier: o.price_modifier })),
      })),
    };
    if(requestId)await connection.query('INSERT INTO online_checkouts(user_id,request_id,request_hash,order_id,response) VALUES($1,$2,$3,$4,$5)',[req.user.id,requestId,requestHash,orderId,JSON.stringify(response)]);
    await connection.query('COMMIT');
    res.status(201).json(response);
  } catch (err) {
    await connection.query('ROLLBACK');
    throw err;
  } finally {
    connection.release();
  }
});

// GET /api/orders?from=&to=&search=&cashier_id=&status=&limit=
const getOrders = asyncHandler(async (req, res) => {
  const { from, to, search, cashier_id, status, limit } = req.query;
  const conditions = [];
  const params = [];

  // Cashiers may only see their own transaction history
  if (req.user.role === 'cashier') {
    conditions.push(`o.user_id = $${params.length + 1}`);
    params.push(req.user.id);
  } else if (cashier_id) {
    conditions.push(`o.user_id = $${params.length + 1}`);
    params.push(cashier_id);
  }

  if (from) { conditions.push(`o.created_at >= $${params.length + 1}`); params.push(timestamp(from)); }
  if (to) { conditions.push(`o.created_at <= $${params.length + 1}`); params.push(timestamp(to)); }
  if (status) { conditions.push(`o.status = $${params.length + 1}`); params.push(status); }
  if (search) {
    conditions.push(`(o.order_number COLLATE "C" ILIKE $${params.length + 1} OR EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND unaccent(oi.product_name COLLATE "C") ILIKE unaccent($${params.length + 2}::text)))`);
    params.push(`%${search}%`, `%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: rows } = await pool.query(
    `SELECT o.*, COALESCE(s.payload->'receipt'->>'cashier_name',u.full_name) AS cashier_name,
       s.client_id AS offline_client_id,s.device_id AS offline_device_id,s.synced_at,s.status AS sync_status
     FROM orders o JOIN users u ON o.user_id = u.id LEFT JOIN offline_sales s ON s.order_id=o.id
     ${where}
     ORDER BY o.created_at DESC
     LIMIT $${params.length + 1}`,
    [...params, Math.min(limit === undefined ? 100 : number(limit, 'Limit', { min: 1, integer: true }), 500)]
  );
  res.json(rows);
});

// GET /api/orders/:id -- full detail for viewing/reprinting a receipt
const getOrder = asyncHandler(async (req, res) => {
  const conditions = ['o.id = $1'];
  const params = [req.params.id];
  if (req.user.role === 'cashier') {
    conditions.push(`o.user_id = $${params.length + 1}`);
    params.push(req.user.id);
  }

  const { rows: orderRows } = await pool.query(
    `SELECT o.*, COALESCE(s.payload->'receipt'->>'cashier_name',u.full_name) AS cashier_name,
       CASE WHEN s.id IS NOT NULL THEN s.payload->'receipt'->>'discount_name' ELSE d.name END AS discount_name,
       s.payload->'receipt'->'receipt_settings' AS receipt_settings,
       s.client_id AS offline_client_id,s.device_id AS offline_device_id,s.synced_at,s.status AS sync_status
     FROM orders o JOIN users u ON o.user_id = u.id LEFT JOIN discounts d ON o.discount_id = d.id LEFT JOIN offline_sales s ON s.order_id=o.id
     WHERE ${conditions.join(' AND ')}`,
    params
  );
  if (!orderRows.length) throw new ApiError(404, 'Order not found.');
  const order = orderRows[0];

  const { rows: items } = await pool.query(`SELECT * FROM order_items WHERE order_id = $1`, [order.id]);
  const itemIds = items.map((i) => i.id);
  const { rows: options } = itemIds.length
    ? await pool.query(`SELECT * FROM order_item_options WHERE order_item_id = ANY($1::integer[])`, [itemIds])
    : { rows: [] };

  order.items = items.map((item) => ({
    ...item,
    options: options.filter((o) => o.order_item_id === item.id),
  }));

  res.json(order);
});

module.exports = { createOrder, getOrders, getOrder };
