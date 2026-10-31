import { peso, formatDateTime } from '../utils/currency';

export default function ReceiptView({ order, settings, cashierName }) {
  if (!order) return null;
  settings = order.receipt_settings || settings;
  const businessName = settings?.business_name || 'SNACK TIME POS';
  const footer = settings?.receipt_footer || 'THANK YOU! COME AGAIN!';

  return (
    <div className="receipt">
      <div className="receipt-center">
        <strong>{businessName}</strong><br />
        {order.offline ? 'LOCAL CASH RECEIPT' : 'SALES RECEIPT'}
      </div>
      <hr />
      {order.offline && <div className="receipt-center">Saved on this device • Not uploaded</div>}
      <div>Order #: {order.order_number}</div>
      <div>Date: {formatDateTime(order.created_at || new Date())}</div>
      <div>Cashier: {cashierName || order.cashier_name || '-'}</div>
      <hr />
      {order.items.map((item, idx) => (
        <div key={idx} style={{ marginBottom: 6 }}>
          <div className="receipt-row">
            <span>{item.name || item.product_name} x{item.quantity}</span>
            <span>{peso(item.subtotal)}</span>
          </div>
          {(item.options || []).map((opt, i) => (
            <div key={i} style={{ fontSize: 11.5, color: '#555', paddingLeft: 8 }}>
              {opt.name || opt.option_name}{Number(opt.price_modifier) > 0 ? ` (+${peso(opt.price_modifier)})` : ''}
            </div>
          ))}
        </div>
      ))}
      <hr />
      <div className="receipt-row"><span>Subtotal</span><span>{peso(order.subtotal)}</span></div>
      <div className="receipt-row"><span>Discount</span><span>-{peso(order.discount_amount)}</span></div>
      <div className="receipt-row receipt-total"><span>TOTAL</span><span>{peso(order.total)}</span></div>
      <hr />
      {order.payment_method === 'cash' ? (
        <>
          <div className="receipt-row"><span>Payment</span><span>{peso(order.cash_received)}</span></div>
          <div className="receipt-row"><span>Change</span><span>{peso(order.change_amount)}</span></div>
        </>
      ) : (
        <div className="receipt-row"><span>Paid via</span><span>{order.payment_method?.toUpperCase()}</span></div>
      )}
      <div>Payment Method: {order.payment_method?.toUpperCase()}</div>
      <hr />
      <div className="receipt-center">
        <strong>{footer}</strong>
      </div>
    </div>
  );
}
