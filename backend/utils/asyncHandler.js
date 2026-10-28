// Wraps an async route handler so thrown errors are forwarded to Express's
// error-handling middleware instead of crashing the process.
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
