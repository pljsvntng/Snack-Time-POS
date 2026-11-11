import { useRef } from 'react';
import useFocusLayer from '../hooks/useFocusLayer';

// Shared keyboard behavior for the existing management and confirmation dialogs.
export default function DialogSurface({ children, label, onClose, className = '', style }) {
  const ref = useRef(null);
  useFocusLayer(ref, true, onClose);
  return <div ref={ref} className={`modal-box ${className}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} style={style} onClick={e => e.stopPropagation()}>{children}</div>;
}
