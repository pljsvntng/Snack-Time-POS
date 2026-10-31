const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { text, flag } = require('../utils/validation');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// GET /api/users (admin)
const getUsers = asyncHandler(async (req, res) => {
  const { rows: rows } = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.email, u.active, u.created_at, r.name AS role
     FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.full_name ASC`
  );
  res.json(rows);
});

// POST /api/users (admin)
const createUser = asyncHandler(async (req, res) => {
  const { full_name, username, email, password, role } = req.body;
  if (!full_name || !username || !password || !role) {
    throw new ApiError(400, 'Full name, username, password, and role are required.');
  }
  text(full_name, 'Full name'); text(username, 'Username'); text(password, 'Password');
  if (password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters.');

  const { rows: roleRows } = await pool.query(`SELECT id FROM roles WHERE name = $1`, [role]);
  if (!roleRows.length) throw new ApiError(400, 'Invalid role.');

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users (role_id, full_name, username, email, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [roleRows[0].id, full_name.trim(), username.trim(), email || null, passwordHash]
  );
  res.status(201).json({ id: result.rows[0].id, message: 'User created.' });
});

// PUT /api/users/:id (admin) -- edit profile, role, active status, or reset password
const updateUser = asyncHandler(async (req, res) => {
  const { full_name, email, role, active, password } = req.body;
  if (full_name !== undefined) text(full_name, 'Full name');
  if (active !== undefined) flag(active, 'Active');

  const { rows: existing } = await pool.query(`SELECT id FROM users WHERE id = $1`, [req.params.id]);
  if (!existing.length) throw new ApiError(404, 'User not found.');

  let roleId = null;
  if (role) {
    const { rows: roleRows } = await pool.query(`SELECT id FROM roles WHERE name = $1`, [role]);
    if (!roleRows.length) throw new ApiError(400, 'Invalid role.');
    roleId = roleRows[0].id;
  }

  let passwordHash = null;
  if (password) {
    text(password, 'Password');
    if (password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters.');
    passwordHash = await bcrypt.hash(password, 10);
  }

  await pool.query(
    `UPDATE users SET
       full_name = COALESCE($1, full_name),
       email = COALESCE($2, email),
       role_id = COALESCE($3, role_id),
       active = COALESCE($4, active),
       password_hash = COALESCE($5, password_hash)
     WHERE id = $6`,
    [full_name, email, roleId, active === undefined ? null : flag(active, 'Active'), passwordHash, req.params.id]
  );
  res.json({ message: 'User updated.' });
});

module.exports = { getUsers, createUser, updateUser };
