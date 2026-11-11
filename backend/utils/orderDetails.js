const ApiError = require('./ApiError');
const fields = [['orderType', 'order_type'], ['customerName', 'customer_name'], ['seatingReference', 'seating_reference'], ['orderNotes', 'order_notes']];
const hasOrderDetails = input => fields.some(names => names.some(name => Object.hasOwn(input, name)));

function orderDetails(input = {}) {
  const read = (camel, snake) => {
    if (Object.hasOwn(input, camel) && Object.hasOwn(input, snake) && input[camel] !== input[snake]) throw new ApiError(400, 'Conflicting order details.');
    return input[camel] !== undefined ? input[camel] : input[snake];
  };
  const type = read('orderType', 'order_type') ?? null;
  if (type !== null && !['dine_in', 'takeout'].includes(type)) throw new ApiError(400, 'Order type must be dine_in or takeout.');
  const text = (value, label, max, multiline = false) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value) || (!multiline && /[\r\n\t]/.test(value))) throw new ApiError(400, `${label} must be text of at most ${max} characters.`);
    return value.trim() || null;
  };
  return {
    order_type: type,
    customer_name: text(read('customerName', 'customer_name'), 'Customer name', 100),
    // Never persist dine-in-only data for a takeout or legacy order.
    seating_reference: type === 'dine_in' ? text(read('seatingReference', 'seating_reference'), 'Seating reference', 40) : null,
    order_notes: text(read('orderNotes', 'order_notes'), 'Order notes', 500, true),
  };
}
module.exports = { orderDetails, hasOrderDetails };
