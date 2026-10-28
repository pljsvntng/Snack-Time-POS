const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// GET /api/categories
const getCategories = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT * FROM categories ORDER BY display_order ASC, name ASC`
  );
  res.json(rows);
});

// POST /api/categories  (admin)
const createCategory = asyncHandler(async (req, res) => {
  const { name, icon, display_order } = req.body;
  if (!name || !name.trim()) throw new ApiError(400, 'Category name is required.');

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const [result] = await pool.query(
    `INSERT INTO categories (name, slug, icon, display_order) VALUES (?, ?, ?, ?)`,
    [name.trim(), slug, icon || '', display_order || 0]
  );
  res.status(201).json({ id: result.insertId, name, slug, icon, display_order });
});

// PUT /api/categories/:id (admin)
const updateCategory = asyncHandler(async (req, res) => {
  const { name, icon, display_order, active } = req.body;
  const [existing] = await pool.query(`SELECT id FROM categories WHERE id = ?`, [req.params.id]);
  if (!existing.length) throw new ApiError(404, 'Category not found.');

  await pool.query(
    `UPDATE categories SET name = COALESCE(?, name), icon = COALESCE(?, icon),
     display_order = COALESCE(?, display_order), active = COALESCE(?, active) WHERE id = ?`,
    [name, icon, display_order, active, req.params.id]
  );
  res.json({ message: 'Category updated.' });
});

module.exports = { getCategories, createCategory, updateCategory };
