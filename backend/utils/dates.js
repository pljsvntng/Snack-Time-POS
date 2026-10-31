const ApiError = require('./ApiError');
const today = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

function date(value = today()) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, 'Please supply a valid date (YYYY-MM-DD).');
  }
  return value;
}
function addDays(value, days) {
  const d = new Date(`${date(value)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}( [01]\d:[0-5]\d:[0-5]\d| 2[0-3]:[0-5]\d:[0-5]\d)?$/.test(value)) {
    throw new ApiError(400, 'Invalid date or time filter.');
  }
  date(value.slice(0, 10));
  return value;
}
module.exports = { today, date, addDays, timestamp };
