import { useEffect, useRef } from 'react';

// Keep keyboard/switch navigation inside the active layer, then return to its trigger.
export default function useFocusLayer(ref, open, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open || !ref.current) return;
    const layer = ref.current;
    const previous = document.activeElement;
    const focusable = () => [...layer.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')]
      .filter(el => el.getClientRects().length && !el.closest('[inert]'));
    const frame = requestAnimationFrame(() => { if (!layer.contains(document.activeElement)) (focusable()[0] || layer).focus(); });
    const keydown = (event) => {
      // A payment/customization dialog can sit above the cart drawer.
      const dialogs = document.querySelectorAll('.modal-overlay');
      if (dialogs.length && !dialogs[dialogs.length - 1].contains(layer)) return;
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current?.(); }
      if (event.key === 'Tab') {
        const items = focusable();
        const first = items[0], last = items[items.length - 1];
        if (!first) { event.preventDefault(); layer.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !layer.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !layer.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', keydown);
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true });
    };
  }, [ref, open]);
}
