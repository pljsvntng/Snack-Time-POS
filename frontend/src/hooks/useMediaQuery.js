import { useEffect, useState } from 'react';

export const CART_DRAWER_QUERY = '(max-width: 759px), (max-width: 1199px) and (max-height: 559px)';

export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}
