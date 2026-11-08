const test = require('node:test'), assert = require('node:assert/strict');
const { errorHandler } = require('../middleware/errorHandler');

test('database hosting quota failures return actionable 503 without exposing secrets', () => {
  const logs = [], previous = console.error;
  console.error = (...args) => logs.push(args);
  const response = { status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  try { errorHandler({ code: '53000', message: 'private database password and token must never be logged' }, {}, response, () => {}); }
  finally { console.error = previous; }
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'DATABASE_LIMIT_REACHED');
  assert.match(response.body.error, /offline POS/);
  assert.match(response.body.error, /keep app data intact/);
  assert.doesNotMatch(JSON.stringify({ logs, body: response.body }), /private database password|token must never/);
});
