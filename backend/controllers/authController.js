const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    throw new ApiError(400, 'Please enter both username and password.');
  }

  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.password_hash, u.active, r.name AS role
     FROM users u JOIN roles r ON u.role_id = r.id
     WHERE u.username = ? OR u.email = ?`,
    [username, username]
  );

  const user = rows[0];
  if (!user || !user.active) {
    throw new ApiError(401, 'Invalid username or password.');
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    throw new ApiError(401, 'Invalid username or password.');
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, fullName: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  res.json({
    token,
    user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role },
  });
});

// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

module.exports = { login, me };
