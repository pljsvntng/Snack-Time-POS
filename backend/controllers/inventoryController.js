const pool = require('../config/db');
const { timestamp } = require('../utils/dates');
const { number, text } = require('../utils/validation');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Decimal = require('decimal.js');

function ingredientStatus(row) {
  if (Number(row.current_stock) <= 0) return 'out_of_stock';
  if (Number(row.current_stock) <= Number(row.min_stock)) return 'low_stock';
  return 'in_stock';
}

// GET /api/inventory
const getIngredients = asyncHandler(async (req, res) => {
  const { rows: rows } = await pool.query(`SELECT * FROM ingredients ORDER BY name ASC`);
  res.json(rows.map((r) => ({ ...r, status: ingredientStatus(r) })));
});

// POST /api/inventory (admin) -- add a new ingredient to track
const createIngredient = asyncHandler(async (req, res) => {
  const { name, unit, current_stock, min_stock, cost_per_unit } = req.body;
  text(name, 'Ingredient name');
  for (const [key, value] of Object.entries({ current_stock, min_stock, cost_per_unit })) { if (value !== undefined) number(value, key); }

  const result = await pool.query(
    `INSERT INTO ingredients (name, unit, current_stock, min_stock, cost_per_unit) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [name.trim(), unit || 'pcs', current_stock || 0, min_stock || 0, cost_per_unit || 0]
  );
  res.status(201).json({ id: result.rows[0].id, message: 'Ingredient added.' });
});

// PUT /api/inventory/:id (admin) -- update name/unit/min_stock/cost, not current_stock
// (current_stock changes must go through /adjust so every change is logged)
const updateIngredient = asyncHandler(async (req, res) => {
  const { name, unit, min_stock, cost_per_unit } = req.body;
  if (name !== undefined) text(name, 'Ingredient name');
  if (min_stock !== undefined) number(min_stock, 'Minimum stock');
  if (cost_per_unit !== undefined) number(cost_per_unit, 'Unit cost');
  const { rows: existing } = await pool.query(`SELECT id FROM ingredients WHERE id = $1`, [req.params.id]);
  if (!existing.length) throw new ApiError(404, 'Ingredient not found.');

  await pool.query(
    `UPDATE ingredients SET name = COALESCE($1, name), unit = COALESCE($2, unit),
     min_stock = COALESCE($3, min_stock), cost_per_unit = COALESCE($4, cost_per_unit) WHERE id = $5`,
    [name, unit, min_stock, cost_per_unit, req.params.id]
  );
  res.json({ message: 'Ingredient updated.' });
});

// POST /api/inventory/adjust (admin) -- { ingredient_id, type: 'add'|'deduct'|'adjust', quantity, reason }
const adjustStock = asyncHandler(async (req, res) => {
  const { ingredient_id, type, quantity, reason } = req.body;

  if (!ingredient_id || !['add', 'deduct', 'adjust'].includes(type) || quantity === undefined) {
    throw new ApiError(400, 'Ingredient, type, and quantity are required.');
  }
  number(ingredient_id, 'Ingredient', { min: 1, integer: true });
  number(quantity, 'Quantity');
  if (new Decimal(quantity).decimalPlaces() > 2) throw new ApiError(400, 'Quantity supports at most two decimal places.');

  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');

    const { rows: rows } = await connection.query(
      `SELECT current_stock FROM ingredients WHERE id = $1 FOR UPDATE`,
      [ingredient_id]
    );
    if (!rows.length) throw new ApiError(404, 'Ingredient not found.');

    let newStock;
    if (type === 'add') newStock = new Decimal(rows[0].current_stock).plus(quantity).toFixed(2);
    else if (type === 'deduct') newStock = new Decimal(rows[0].current_stock).minus(quantity).toFixed(2);
    else newStock = new Decimal(quantity).toFixed(2); // 'adjust' sets the absolute value

    if (new Decimal(newStock).lt(0)) throw new ApiError(400, 'This would make stock negative.');

    await connection.query(`UPDATE ingredients SET current_stock = $1 WHERE id = $2`, [newStock, ingredient_id]);
    await connection.query(
      `INSERT INTO inventory_transactions (ingredient_id, type, quantity, resulting_stock, reason, user_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [ingredient_id, type, quantity, newStock, reason || '', req.user?.id || null]
    );

    await connection.query('COMMIT');
    res.json({ message: 'Stock updated.', new_stock: newStock });
  } catch (err) {
    await connection.query('ROLLBACK');
    throw err;
  } finally {
    connection.release();
  }
});

// GET /api/inventory/transactions?ingredient_id=&from=&to=
const getTransactions = asyncHandler(async (req, res) => {
  const { ingredient_id, from, to } = req.query;
  const conditions = [];
  const params = [];

  if (ingredient_id) { conditions.push(`t.ingredient_id = $${params.length + 1}`); params.push(ingredient_id); }
  if (from) { conditions.push(`t.created_at >= $${params.length + 1}`); params.push(timestamp(from)); }
  if (to) { conditions.push(`t.created_at <= $${params.length + 1}`); params.push(timestamp(to)); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: rows } = await pool.query(
    `SELECT t.*, i.name AS ingredient_name, i.unit, u.full_name AS user_name
     FROM inventory_transactions t
     JOIN ingredients i ON t.ingredient_id = i.id
     LEFT JOIN users u ON t.user_id = u.id
     ${where}
     ORDER BY t.created_at DESC
     LIMIT 500`,
    params
  );
  res.json(rows);
});

// GET /api/products/:productId/recipe -- view the Bill of Materials for a product
const getRecipe = asyncHandler(async (req, res) => {
  const { rows: rows } = await pool.query(
    `SELECT pi.id, pi.ingredient_id, i.name, i.unit, pi.quantity_required
     FROM product_ingredients pi JOIN ingredients i ON pi.ingredient_id = i.id
     WHERE pi.product_id = $1`,
    [req.params.productId]
  );
  res.json(rows);
});

// PUT /api/products/:productId/recipe (admin) -- replace the full BOM for a product
// body: { items: [{ ingredient_id, quantity_required }, ...] }
const setRecipe = asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) throw new ApiError(400, 'items must be an array.');
  const ids = new Set();
  for (const item of items) {
    const id = number(item?.ingredient_id, 'Ingredient', { min: 1, integer: true });
    number(item.quantity_required, 'Recipe quantity', { min: 0.01 });
    if (ids.has(id)) throw new ApiError(400, 'A recipe cannot repeat an ingredient.');
    ids.add(id);
  }
  const { rows: [product] } = await pool.query('SELECT id FROM products WHERE id = $1 AND deleted_at IS NULL', [req.params.productId]);
  if (!product) throw new ApiError(404, 'Product not found.');

  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');
    await connection.query(`DELETE FROM product_ingredients WHERE product_id = $1`, [req.params.productId]);
    for (const item of items) {
      if (!item.ingredient_id || !item.quantity_required) continue;
      await connection.query(
        `INSERT INTO product_ingredients (product_id, ingredient_id, quantity_required) VALUES ($1, $2, $3) RETURNING id`,
        [req.params.productId, item.ingredient_id, item.quantity_required]
      );
    }
    await connection.query('COMMIT');
    res.json({ message: 'Recipe updated.' });
  } catch (err) {
    await connection.query('ROLLBACK');
    throw err;
  } finally {
    connection.release();
  }
});

module.exports = {
  getIngredients, createIngredient, updateIngredient, adjustStock, getTransactions, getRecipe, setRecipe,
};
