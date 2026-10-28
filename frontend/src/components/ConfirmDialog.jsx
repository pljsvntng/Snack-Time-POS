import { AlertTriangle, HelpCircle, X } from 'lucide-react';

// Reusable themed confirmation dialog, replacing the browser's native confirm().
// Usage: <ConfirmDialog open={showConfirm} title="..." message="..." confirmLabel="..."
//          danger onConfirm={...} onCancel={() => setShowConfirm(false)} />
export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  danger = false, onConfirm, onCancel,
}) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <button className="modal-close" aria-label="Close" onClick={onCancel}><X size={18} /></button>
        <div className="modal-body">
          <div className={`confirm-icon ${danger ? 'danger' : ''}`}>
            {danger ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
          </div>
          <div className="modal-title">{title}</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 8, lineHeight: 1.55 }}>{message}</p>
          <div className="modal-actions" style={{ marginTop: 22 }}>
            <button className="btn btn-outline" onClick={onCancel}>{cancelLabel}</button>
            <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'} btn-block`} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
