const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// GET /api/categories
const getCategories = asyncHandler(async (req, res) => {
  const { rows: rows } = await pool.query(
    `SELECT * FROM categories ORDER BY display_order ASC, name ASC`
  );
  res.json(rows);
});

// POST /api/categories  (admin)
const createCategory = asyncHandler(async (req, res) => {
  const { name, icon, display_order } = req.body;
  if (!name || !name.trim()) throw new ApiError(400, 'Category name is required.');

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const result = await pool.query(
    `INSERT INTO categories (name, slug, icon, display_order) VALUES ($1, $2, $3, $4) RETURNING id`,
    [name.trim(), slug, icon || '', display_order || 0]
  );
  res.status(201).json({ id: result.rows[0].id, name, slug, icon, display_order });
});

// PUT /api/categories/:id (admin)
const updateCategory = asyncHandler(async (req, res) => {
  const { name, icon, display_order, active } = req.body;
  const { rows: existing } = await pool.query(`SELECT id FROM categories WHERE id = $1`, [req.params.id]);
  if (!existing.length) throw new ApiError(404, 'Category not found.');

  await pool.query(
    `UPDATE categories SET name = COALESCE($1, name), icon = COALESCE($2, icon),
     display_order = COALESCE($3, display_order), active = COALESCE($4, active) WHERE id = $5`,
    [name, icon, display_order, active === undefined ? null : Number(active), req.params.id]
  );
  res.json({ message: 'Category updated.' });
});

module.exports = { getCategories, createCategory, updateCategory };
