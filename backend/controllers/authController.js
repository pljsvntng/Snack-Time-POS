const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
    throw new ApiError(400, 'Please enter both username and password.');
  }

  const { rows: rows } = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.password_hash, u.active, r.name AS role
     FROM users u JOIN roles r ON u.role_id = r.id
     WHERE u.username = $1 OR u.email = $2`,
    [username.trim(), username.trim()]
  );

  const user = rows.length===1?rows[0]:null;
  if (!user || !user.active) {
    throw new ApiError(401, 'Invalid username or password.');
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    throw new ApiError(401, 'Invalid username or password.');
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, fullName: user.full_name,
      credentialVersion: require('crypto').createHash('sha256').update(user.password_hash).digest('hex') },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  let offline_authorization = null, offline_error = null;
  if(req.body.offline_device_id){
    try { offline_authorization = require('../utils/offlineGrant').offlineGrant(user,req.body.offline_device_id,require('crypto').createHash('sha256').update(user.password_hash).digest('hex')); }
    catch { offline_error = 'Offline authorization is unavailable. Ask the administrator to check the offline signing key.'; }
  }
  res.set('Cache-Control','no-store');
  res.json({
    offline_authorization, offline_error,
    token,
    user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role },
  });
});

// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

module.exports = { login, me };
