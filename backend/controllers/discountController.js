const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/discounts
const getDiscounts = asyncHandler(async (req, res) => {
  const { rows: rows } = await pool.query(`SELECT * FROM discounts WHERE active = 1 ORDER BY name ASC`);
  res.json(rows);
});

module.exports = { getDiscounts };
