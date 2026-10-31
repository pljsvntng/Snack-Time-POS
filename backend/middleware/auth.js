const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const pool = require('../config/db');

// Verifies the JWT sent as "Authorization: Bearer <token>" and attaches the
// decoded payload ({ id, username, role }) to req.user.
async function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new ApiError(401, 'You must be logged in to do that.'));
  }

  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); }
  catch { return next(new ApiError(401, 'Your session has expired. Please log in again.')); }
  try {
    const { rows: [user] } = await pool.query(
      `SELECT u.id, u.username, u.full_name AS "fullName", u.active, u.password_hash, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`, [payload.id]);
    if (!user || !user.active || !payload.credentialVersion || (payload.credentialVersion !==
        require('crypto').createHash('sha256').update(user.password_hash).digest('hex'))) {
      return next(new ApiError(401, 'Your account has changed. Please log in again.'));
    }
    const { active, password_hash, ...identity } = user;
    req.user = identity;
    next();
  } catch (err) { next(err); }
}

// Usage: requireRole('admin') or requireRole('admin', 'cashier')
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to do that.'));
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };
