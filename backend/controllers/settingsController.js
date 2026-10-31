const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// GET /api/settings -- returns a flat { key: value } object
const getSettings = asyncHandler(async (req, res) => {
  const { rows: rows } = await pool.query(`SELECT setting_key, setting_value FROM settings`);
  const settings = {};
  for (const row of rows) settings[row.setting_key] = row.setting_value;
  res.json(settings);
});

// PUT /api/settings (admin) -- body: { key1: value1, key2: value2, ... }
const updateSettings = asyncHandler(async (req, res) => {
  const entries = Object.entries(req.body || {});
  for (const [key, value] of entries) {
    if (!key || key.length > 60 || typeof value !== 'string' || value.length > 500) throw new ApiError(400, 'Invalid setting value.');
  }
  const connection = await pool.connect();
  try {
  await connection.query('BEGIN');
  for (const [key, value] of entries) {
    await connection.query(
      `INSERT INTO settings (setting_key, setting_value) VALUES ($1, $2)
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
      [key, String(value)]
    );
  }
  await connection.query('COMMIT');
  } catch (err) { await connection.query('ROLLBACK'); throw err; }
  finally { connection.release(); }
  res.json({ message: 'Settings updated.' });
});

module.exports = { getSettings, updateSettings };
