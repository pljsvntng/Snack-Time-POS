import { useEffect, useRef } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose }) {
  // Keep the latest onClose in a ref so re-renders (every cart click) don't restart the timer.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => closeRef.current(), type === 'success' ? 3200 : 6000);
    return () => clearTimeout(t);
  }, [message, type]);

  if (!message) return null;
  return (
    <div className={`toast ${type}`} role={type === 'success' ? 'status' : 'alert'}>
      {type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      <span>{message}</span>
    </div>
  );
}
