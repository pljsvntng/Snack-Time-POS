const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

// Verifies the JWT sent as "Authorization: Bearer <token>" and attaches the
// decoded payload ({ id, username, role }) to req.user.
function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new ApiError(401, 'You must be logged in to do that.'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    next(new ApiError(401, 'Your session has expired. Please log in again.'));
  }
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
