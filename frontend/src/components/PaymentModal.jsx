import { useState, useMemo } from 'react';
import { Banknote, Smartphone, CreditCard, Check, X } from 'lucide-react';
import { peso } from '../utils/currency';

export default function PaymentModal({ total, onClose, onConfirm, submitting }) {
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
      if (cashReceived === '' || Number(cashReceived) < total) {
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={onClose}><X size={18} /></button>
        <div className="modal-body">
          <div className="modal-title">Payment</div>
          <div className="modal-price">Total: {peso(total)}</div>

          {error && <div className="login-error" style={{ marginBottom: 14 }}>{error}</div>}

          <div className="payment-methods">
            {['cash', 'gcash', 'other'].map((m) => (
              <button key={m} className={`payment-method-btn ${method === m ? 'active' : ''}`} onClick={() => setMethod(m)}>
                {m === 'cash' ? <Banknote size={22} /> : m === 'gcash' ? <Smartphone size={22} /> : <CreditCard size={22} />}
                {m === 'cash' ? 'Cash' : m === 'gcash' ? 'GCash' : 'Other'}
              </button>
            ))}
          </div>

          {method === 'cash' ? (
            <>
              <div className="form-group">
                <label>Cash Received</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <div className="quick-amounts">
                {quickAmounts.map((amt) => (
                  <button key={amt} className="btn btn-outline btn-sm" onClick={() => setCashReceived(String(amt))}>
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

          <div className="modal-actions" style={{ marginTop: 16 }}>
            <button className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button className="btn btn-success btn-block" onClick={handleConfirm} disabled={submitting}>
              {submitting ? 'Processing...' : <><Check size={18} /> Confirm Payment</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
