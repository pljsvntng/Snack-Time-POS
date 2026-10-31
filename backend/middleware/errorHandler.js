const ApiError = require('../utils/ApiError');

// Central error handler. Never leaks raw DB/driver errors to the client --
// logs the real error server-side and returns a friendly message instead.
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON request.' });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Image must be 5 MB or smaller.' });
  if (['ECONNREFUSED', 'ETIMEDOUT', '3D000', '28P01', '57P01'].includes(err.code)) return res.status(503).json({ error: 'Database unavailable. Check that PostgreSQL is running and configured correctly.' });
  if (['40P01', '55P03', '40001'].includes(err.code)) return res.status(409).json({ error: 'Stock changed during this request. Please try again.' });
  if (['22003', '22001', '22P02', '22007', '23502', '23514'].includes(err.code)) return res.status(400).json({ error: 'A value is invalid or exceeds the allowed length or range.' });

  // PostgreSQL SQLSTATE codes get slightly friendlier messages
  if (err.code === '23505') {
    return res.status(409).json({ error: 'That record already exists.' });
  }
  if (err.code === '23503') {
    return res.status(409).json({ error: 'This action conflicts with related records.' });
  }

  console.error('[Unhandled error]', { code: /^[A-Z0-9_]{1,40}$/.test(err.code||'')?err.code:'UNEXPECTED' });
  return res.status(500).json({ error: 'Something went wrong on our end. Please try again.' });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Resource not found.' });
}

module.exports = { errorHandler, notFoundHandler };
