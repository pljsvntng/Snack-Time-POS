import { Cookie } from 'lucide-react';

// Snack Time POS brand mark: orange tile with the Lucide "cookie" icon.
export function BrandMark({ size = 36, inverted = false }) {
  return (
    <span
      className={`brand-mark ${inverted ? 'inverted' : ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Cookie size={Math.round(size * 0.58)} />
    </span>
  );
}

export function BrandLockup({ inverted = false, size = 36 }) {
  return (
    <span className={`brand-lockup ${inverted ? 'inverted' : ''}`}>
      <BrandMark size={size} inverted={inverted} />
      <span className="brand-text">
        <span className="brand-name">Snack Time</span>
        <span className="brand-sub">Point of Sale</span>
      </span>
    </span>
  );
}
