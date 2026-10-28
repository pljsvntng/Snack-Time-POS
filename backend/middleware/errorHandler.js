const ApiError = require('../utils/ApiError');

// Central error handler. Never leaks raw DB/driver errors to the client --
// logs the real error server-side and returns a friendly message instead.
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  console.error('[Unhandled error]', err);

  // Common MySQL error codes get slightly friendlier messages
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'That record already exists.' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ error: 'This action conflicts with related records.' });
  }

  return res.status(500).json({ error: 'Something went wrong on our end. Please try again.' });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Resource not found.' });
}

module.exports = { errorHandler, notFoundHandler };
