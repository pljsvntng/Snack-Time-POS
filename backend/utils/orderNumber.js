const { today } = require('./dates');
// Caller holds the database checkout lock until commit/rollback.
async function generateOrderNumber(connection) {
  const prefix = 'FH-' + today().replaceAll('-', '') + '-';
  const { rows: [row] } = await connection.query(
    'SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 13) AS integer)), 0) AS seq FROM orders WHERE order_number COLLATE "C" LIKE $1', [prefix + '%']);
  return prefix + String(Number(row.seq) + 1).padStart(3, '0');
}
module.exports = { generateOrderNumber };
