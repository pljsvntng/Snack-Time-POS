const ApiError = require('./ApiError');

function number(value, label, { min = 0, integer = false } = {}) {
  const n = Number(value);
  if (value === null || value === '' || typeof value === 'boolean' ||
      !['string', 'number'].includes(typeof value) || !Number.isFinite(n) ||
      n < min || (integer && !Number.isSafeInteger(n))) {
    throw new ApiError(400, `${label} must be a valid ${integer ? 'whole number' : 'number'} of at least ${min}.`);
  }
  return n;
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(400, `${label} is required.`);
  return value.trim();
}

function flag(value, label) {
  if (![true, false, 0, 1].includes(value)) throw new ApiError(400, `${label} must be true or false.`);
  return Number(value);
}

module.exports = { number, text, flag };
