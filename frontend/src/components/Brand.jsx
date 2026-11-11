// Original Snack Time burger mark, shared with the favicon and exported SVG assets.
export function BrandMark({ size = 36, inverted = false, monochrome = false }) {
  return (
    <svg className={`brand-mark ${inverted ? 'inverted' : ''} ${monochrome ? 'monochrome' : ''}`} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect className="brand-tile" width="64" height="64" rx="18" fill="#D62828" />
      <path className="brand-bun" d="M15 28c1-10 8-16 17-16s16 6 17 16H15Z" fill="#F4B400" />
      <path d="m25 20 1-2m7 1 1-2m6 5 1-2" stroke="#8B5E3C" strokeWidth="2" strokeLinecap="round" />
      <path className="brand-filling" d="m14 34 9 3 9-3 9 3 9-3" stroke="#FFF8F0" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path className="brand-bun" d="M16 43h32c0 6-4 9-10 9H26c-6 0-10-3-10-9Z" fill="#F4B400" />
    </svg>
  );
}

export function BrandLockup({ inverted = false, size = 36 }) {
  return (
    <span className={`brand-lockup ${inverted ? 'inverted' : ''}`}>
      <BrandMark size={size} inverted={inverted} />
      <span className="brand-text">
        <span className="brand-name">SNACK TIME<span className="brand-period">.</span></span>
        <span className="brand-sub">Good food. Better days.</span>
      </span>
    </span>
  );
}
