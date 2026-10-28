import { ShoppingCart, Minus, Plus, Trash2, X, UtensilsCrossed, AlertTriangle } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { peso } from '../utils/currency';
import { issuesMessage } from '../utils/stock';

// `open` / `onClose` only control the mobile bottom-sheet presentation; on larger screens the
// panel is always visible as a side column.
export default function CartPanel({ discounts, onCheckout, open = false, onClose }) {
  const {
    items, updateQuantity, removeItem, discount, setDiscount, subtotal, discountAmount, total,
    getAvailability, stockIssues, lineIssue,
  } = useCart();
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div className={`cart-panel ${open ? 'open' : ''}`}>
      <div className="cart-header">
        <h3>
          Current Order
          {itemCount > 0 && <span className="cart-count">{itemCount}</span>}
        </h3>
        <button className="cart-close" aria-label="Close order" onClick={onClose}><X size={20} /></button>
      </div>

      <div className="cart-items">
        {items.length === 0 ? (
          <div className="cart-empty">
            <span className="empty-icon" style={{ display: 'flex', justifyContent: 'center' }}><ShoppingCart size={34} /></span>
            <div style={{ marginTop: 10, fontWeight: 700, color: 'var(--text)' }}>Your cart is empty</div>
            <div style={{ marginTop: 4 }}>Tap an item from the menu to add it to the order.</div>
          </div>
        ) : (
          items.map((item) => {
            const avail = getAvailability(item.product, item.selectedOptions);
            const canIncrease = avail.max >= 1;
            const issue = lineIssue(item);
            return (
            <div className="cart-item" key={item.cartItemId}>
              <div className="cart-item-thumb">
                {item.product.image ? <img src={item.product.image} alt="" /> : <UtensilsCrossed size={22} />}
              </div>
              <div className="cart-item-body">
                <div className="cart-item-name">{item.product.name}</div>
                {item.selectedOptions.length > 0 && (
                  <div className="cart-item-opts">
                    {item.selectedOptions.map((o) => o.name).join(', ')}
                  </div>
                )}
                <div className="cart-item-row">
                  <div className="qty-stepper">
                    <button aria-label="Decrease quantity" disabled={item.quantity <= 1} onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}><Minus size={14} /></button>
                    <span className="qty-value">{item.quantity}</span>
                    <button aria-label="Increase quantity" disabled={!canIncrease} onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}><Plus size={14} /></button>
                  </div>
                  <div className="cart-item-price">{peso(item.subtotal)}</div>
                </div>
                {issue ? (
                  <div className="cart-item-note error">
                    <AlertTriangle size={13} /> Only {Number(Number(issue.stock).toFixed(2))} {issue.unit} of {issue.name} available. Reduce the quantity.
                  </div>
                ) : !canIncrease && avail.limiter ? (
                  <div className="cart-item-note">
                    <AlertTriangle size={13} /> Stock limit reached ({avail.limiter.name})
                  </div>
                ) : null}
                <button className="cart-item-remove" onClick={() => removeItem(item.cartItemId)}>
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            </div>
            );
          })
        )}
      </div>

      <div className="cart-summary">
        {discounts && discounts.length > 0 && (
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12.5 }}>Discount</label>
            <select
              value={discount?.id || ''}
              onChange={(e) => setDiscount(discounts.find((d) => d.id === Number(e.target.value)) || null)}
            >
              <option value="">No discount</option>
              {discounts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="summary-row"><span>Subtotal</span><span>{peso(subtotal)}</span></div>
        <div className="summary-row"><span>Discount</span><span>-{peso(discountAmount)}</span></div>
        <div className="summary-row total"><span>Total</span><span>{peso(total)}</span></div>

        {stockIssues.length > 0 && (
          <div className="cart-stock-alert" role="alert">
            <AlertTriangle size={15} /> <span>{issuesMessage(stockIssues)}</span>
          </div>
        )}

        <button className="btn btn-primary btn-block checkout-btn" disabled={items.length === 0 || stockIssues.length > 0} onClick={onCheckout}>
          Complete Order
        </button>
      </div>
    </div>
  );
}
