const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

function ingredientStatus(row) {
  if (Number(row.current_stock) <= 0) return 'out_of_stock';
  if (Number(row.current_stock) <= Number(row.min_stock)) return 'low_stock';
  return 'in_stock';
}

// GET /api/inventory
const getIngredients = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`SELECT * FROM ingredients ORDER BY name ASC`);
  res.json(rows.map((r) => ({ ...r, status: ingredientStatus(r) })));
});

// POST /api/inventory (admin) -- add a new ingredient to track
const createIngredient = asyncHandler(async (req, res) => {
  const { name, unit, current_stock, min_stock, cost_per_unit } = req.body;
  if (!name || !name.trim()) throw new ApiError(400, 'Ingredient name is required.');

  const [result] = await pool.query(
    `INSERT INTO ingredients (name, unit, current_stock, min_stock, cost_per_unit) VALUES (?, ?, ?, ?, ?)`,
    [name.trim(), unit || 'pcs', current_stock || 0, min_stock || 0, cost_per_unit || 0]
  );
  res.status(201).json({ id: result.insertId, message: 'Ingredient added.' });
});

// PUT /api/inventory/:id (admin) -- update name/unit/min_stock/cost, not current_stock
// (current_stock changes must go through /adjust so every change is logged)
const updateIngredient = asyncHandler(async (req, res) => {
  const { name, unit, min_stock, cost_per_unit } = req.body;
  const [existing] = await pool.query(`SELECT id FROM ingredients WHERE id = ?`, [req.params.id]);
  if (!existing.length) throw new ApiError(404, 'Ingredient not found.');

  await pool.query(
    `UPDATE ingredients SET name = COALESCE(?, name), unit = COALESCE(?, unit),
     min_stock = COALESCE(?, min_stock), cost_per_unit = COALESCE(?, cost_per_unit) WHERE id = ?`,
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
  if (Number(quantity) < 0) throw new ApiError(400, 'Quantity cannot be negative.');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT current_stock FROM ingredients WHERE id = ? FOR UPDATE`,
      [ingredient_id]
    );
    if (!rows.length) throw new ApiError(404, 'Ingredient not found.');

    let newStock;
    if (type === 'add') newStock = Number(rows[0].current_stock) + Number(quantity);
    else if (type === 'deduct') newStock = Number(rows[0].current_stock) - Number(quantity);
    else newStock = Number(quantity); // 'adjust' sets the absolute value

    if (newStock < 0) throw new ApiError(400, 'This would make stock negative.');

    await connection.query(`UPDATE ingredients SET current_stock = ? WHERE id = ?`, [newStock, ingredient_id]);
    await connection.query(
      `INSERT INTO inventory_transactions (ingredient_id, type, quantity, resulting_stock, reason, user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [ingredient_id, type, quantity, newStock, reason || '', req.user?.id || null]
    );

    await connection.commit();
    res.json({ message: 'Stock updated.', new_stock: newStock });
  } catch (err) {
    await connection.rollback();
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

  if (ingredient_id) { conditions.push('t.ingredient_id = ?'); params.push(ingredient_id); }
  if (from) { conditions.push('t.created_at >= ?'); params.push(from); }
  if (to) { conditions.push('t.created_at <= ?'); params.push(to); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
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
  const [rows] = await pool.query(
    `SELECT pi.id, pi.ingredient_id, i.name, i.unit, pi.quantity_required
     FROM product_ingredients pi JOIN ingredients i ON pi.ingredient_id = i.id
     WHERE pi.product_id = ?`,
    [req.params.productId]
  );
  res.json(rows);
});

// PUT /api/products/:productId/recipe (admin) -- replace the full BOM for a product
// body: { items: [{ ingredient_id, quantity_required }, ...] }
const setRecipe = asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) throw new ApiError(400, 'items must be an array.');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(`DELETE FROM product_ingredients WHERE product_id = ?`, [req.params.productId]);
    for (const item of items) {
      if (!item.ingredient_id || !item.quantity_required) continue;
      await connection.query(
        `INSERT INTO product_ingredients (product_id, ingredient_id, quantity_required) VALUES (?, ?, ?)`,
        [req.params.productId, item.ingredient_id, item.quantity_required]
      );
    }
    await connection.commit();
    res.json({ message: 'Recipe updated.' });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

module.exports = {
  getIngredients, createIngredient, updateIngredient, adjustStock, getTransactions, getRecipe, setRecipe,
};
