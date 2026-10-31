import { useEffect, useRef, useState } from 'react';

export default function TableScroll({ children }) {
  const ref = useRef(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const region = ref.current;
    const measure = () => setOverflow(region.scrollWidth > region.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(region);
    const table = region.querySelector('table');
    if (table) observer.observe(table);
    measure();
    return () => observer.disconnect();
  }, [children]);
  return (
    <div ref={ref} className={`table-wrap ${overflow ? 'can-scroll' : ''}`} role="region"
      aria-label={overflow ? 'Data table. Swipe horizontally to see all columns.' : 'Data table'}
      tabIndex={overflow ? 0 : undefined}>
      {children}
    </div>
  );
}
