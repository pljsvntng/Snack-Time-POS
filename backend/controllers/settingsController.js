const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/settings -- returns a flat { key: value } object
const getSettings = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`SELECT setting_key, setting_value FROM settings`);
  const settings = {};
  for (const row of rows) settings[row.setting_key] = row.setting_value;
  res.json(settings);
});

// PUT /api/settings (admin) -- body: { key1: value1, key2: value2, ... }
const updateSettings = asyncHandler(async (req, res) => {
  const entries = Object.entries(req.body || {});
  for (const [key, value] of entries) {
    await pool.query(
      `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, String(value)]
    );
  }
  res.json({ message: 'Settings updated.' });
});

module.exports = { getSettings, updateSettings };
