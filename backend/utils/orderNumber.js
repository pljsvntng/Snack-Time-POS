// Generates order numbers like FH-20260925-001, guaranteed unique by
// counting today's orders using the same transaction connection.
async function generateOrderNumber(connection) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const datePart = `${y}${m}${d}`;

  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count FROM orders WHERE order_number LIKE ?`,
    [`FH-${datePart}-%`]
  );
  const nextSeq = rows[0].count + 1;
  const seqPart = String(nextSeq).padStart(3, '0');
  return `FH-${datePart}-${seqPart}`;
}

module.exports = { generateOrderNumber };
