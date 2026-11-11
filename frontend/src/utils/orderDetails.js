export const EMPTY_ORDER_DETAILS = Object.freeze({ orderType: 'takeout', customerName: '', seatingReference: '', orderNotes: '' });
export const orderTypeLabel = type => type === 'dine_in' ? 'Dine-In' : type === 'takeout' ? 'Takeout' : 'Unspecified';

// Shared by durable offline checkout and the cashier form. Missing type means a legacy caller.
export function normalizeOrderDetails(input = {}) {
  const read = (camel, snake) => {
    if (Object.hasOwn(input, camel) && Object.hasOwn(input, snake) && input[camel] !== input[snake]) throw new Error('Conflicting order details.');
    return input[camel] !== undefined ? input[camel] : input[snake];
  };
  const type = read('orderType', 'order_type') ?? null;
  if (type !== null && !['dine_in', 'takeout'].includes(type)) throw new Error('Order type must be dine_in or takeout.');
  const text = (value, label, max, multiline = false) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value) || (!multiline && /[\r\n\t]/.test(value))) throw new Error(`${label} must be text of at most ${max} characters.`);
    return value.trim() || null;
  };
  return {
    order_type: type,
    customer_name: text(read('customerName', 'customer_name'), 'Customer name', 100),
    seating_reference: type === 'dine_in' ? text(read('seatingReference', 'seating_reference'), 'Seating reference', 40) : null,
    order_notes: text(read('orderNotes', 'order_notes'), 'Order notes', 500, true),
  };
}
export const hasOrderDetails = input => ['orderType', 'order_type', 'customerName', 'customer_name', 'seatingReference', 'seating_reference', 'orderNotes', 'order_notes'].some(key => Object.hasOwn(input, key));
