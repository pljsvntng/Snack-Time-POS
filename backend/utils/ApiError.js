// A small typed error so controllers can throw with an intended HTTP status
// and a friendly, safe-to-display message.
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}
module.exports = ApiError;
