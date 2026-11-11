import { ShoppingBag, UtensilsCrossed, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '../context/CartContext';

export default function OrderDetailsFields() {
  const { orderDetails: details, setOrderDetails } = useCart();
  const [notesOpen, setNotesOpen] = useState(false);
  return <section className="order-setup" aria-label="Order details">
    <div className="order-type-switch" role="group" aria-label="Order type">
      <button type="button" aria-pressed={details.orderType === 'takeout'} onClick={() => setOrderDetails({ orderType: 'takeout' })}><ShoppingBag size={17} /> Takeout</button>
      <button type="button" aria-pressed={details.orderType === 'dine_in'} onClick={() => setOrderDetails({ orderType: 'dine_in' })}><UtensilsCrossed size={17} /> Dine-In</button>
    </div>
    <div className={`order-customer-fields ${details.orderType === 'dine_in' ? 'has-seating' : ''}`}>
      <div className="form-group"><label htmlFor="order-customer">Customer <span>optional</span></label><input id="order-customer" value={details.customerName} maxLength={100} placeholder="Customer name" autoComplete="off" onChange={e => setOrderDetails({ customerName: e.target.value })} /></div>
      {details.orderType === 'dine_in' && <div className="form-group"><label htmlFor="order-seating">Seating <span>optional</span></label><input id="order-seating" value={details.seatingReference} maxLength={40} placeholder="e.g. Front counter" autoComplete="off" onChange={e => setOrderDetails({ seatingReference: e.target.value })} /></div>}
    </div>
    <details className="order-notes-control" open={notesOpen} onToggle={e => setNotesOpen(e.currentTarget.open)}>
      <summary>Order notes <span>{details.orderNotes ? 'added' : 'optional'}</span><ChevronDown size={14} /></summary>
      <label className="sr-only" htmlFor="order-notes">Order notes</label><textarea id="order-notes" value={details.orderNotes} maxLength={500} rows={2} placeholder="Any special instructions?" onChange={e => setOrderDetails({ orderNotes: e.target.value })} />
    </details>
  </section>;
}
