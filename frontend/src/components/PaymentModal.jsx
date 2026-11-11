import { useState, useMemo, useRef } from 'react';
import { Banknote, Smartphone, CreditCard, Check, X } from 'lucide-react';
import useFocusLayer from '../hooks/useFocusLayer';
import { peso } from '../utils/currency';
import { orderTypeLabel } from '../utils/orderDetails';

export default function PaymentModal({ total, onClose, onConfirm, submitting, cashOnly = false, orderDetails }) {
  const dialogRef = useRef(null);
  useFocusLayer(dialogRef, true, () => { if (!submitting) onClose(); });
  const [method, setMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [error, setError] = useState('');

  const change = useMemo(() => {
    const received = Number(cashReceived) || 0;
    return Math.max(0, received - total);
  }, [cashReceived, total]);

  const insufficient = method === 'cash' && cashReceived !== '' && Number(cashReceived) < total;

  const handleConfirm = () => {
    setError('');
    if (method === 'cash') {
      if (cashReceived === '' || !Number.isFinite(Number(cashReceived)) || Number(cashReceived) < total) {
        setError('Insufficient payment.');
        return;
      }
    }
    onConfirm({ payment_method: method, cash_received: method === 'cash' ? Number(cashReceived) : undefined });
  };

  const quickAmounts = [total, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500]
    .filter((v, i, arr) => v >= total && arr.indexOf(v) === i)
    .slice(0, 4);

  return (
    <div className="modal-overlay" onClick={() => { if (!submitting) onClose(); }}>
      <div ref={dialogRef} className="modal-box payment-modal" role="dialog" aria-modal="true" aria-labelledby="PaymentModal-heading" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" disabled={submitting} onClick={onClose}><X size={18} /></button>
        <div className="modal-body">
          <p className="eyebrow">One last step</p>
          <div id="PaymentModal-heading" className="modal-title">Settle the order.</div>
          <div className="payment-total"><span>Total to pay</span><strong>{peso(total)}</strong></div>
          {orderDetails && <div className="payment-order-details"><span className={`order-type-badge ${orderDetails.orderType}`}>{orderTypeLabel(orderDetails.orderType)}</span>{orderDetails.customerName && <span>{orderDetails.customerName}</span>}{orderDetails.orderType === 'dine_in' && orderDetails.seatingReference && <span>Seating: {orderDetails.seatingReference}</span>}</div>}

          {cashOnly && <p className="payment-note">Cash only. This sale is saved on this device and queued for synchronization when a connection is available.</p>}
          {error && <div className="login-error" style={{ marginBottom: 14 }}>{error}</div>}

          <div className="payment-methods">
            {(cashOnly ? ['cash'] : ['cash', 'gcash', 'other']).map((m) => (
              <button key={m} aria-pressed={method === m} className={`payment-method-btn ${method === m ? 'active' : ''}`} onClick={() => { setMethod(m); setError(''); }}>
                {m === 'cash' ? <Banknote size={22} /> : m === 'gcash' ? <Smartphone size={22} /> : <CreditCard size={22} />}
                {m === 'cash' ? 'Cash' : m === 'gcash' ? 'GCash' : 'Other'}
              </button>
            ))}
          </div>

          {method === 'cash' ? (
            <>
              <div className="form-group">
                <label htmlFor="cash-received">Cash Received</label>
                <input
                  id="cash-received"
                  type="number" min="0" step="0.01"
                  inputMode="decimal"
                  value={cashReceived}
                  onChange={(e) => { setCashReceived(e.target.value); setError(''); }}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <div className="quick-amounts">
                {quickAmounts.map((amt) => (
                  <button key={amt} className="btn btn-outline btn-sm" onClick={() => { setCashReceived(String(amt)); setError(''); }}>
                    {peso(amt)}
                  </button>
                ))}
              </div>
              {cashReceived !== '' && !insufficient && (
                <div className="change-display">
                  <div className="label">CHANGE</div>
                  <div className="amount">{peso(change)}</div>
                </div>
              )}
              {insufficient && <div className="login-error">Insufficient payment.</div>}
            </>
          ) : (
            <div className="payment-note">
              This transaction will be recorded as paid in full via {method === 'gcash' ? 'GCash' : 'other cashless payment'}. No change is calculated.
            </div>
          )}

          <div className="modal-actions sticky" style={{ marginTop: 16 }}>
            <button className="btn btn-outline" disabled={submitting} onClick={onClose}>Cancel</button>
            <button className="btn btn-success btn-block" onClick={handleConfirm} disabled={submitting}>
              {submitting ? 'Processing...' : <><Check size={18} /> Confirm Payment</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
