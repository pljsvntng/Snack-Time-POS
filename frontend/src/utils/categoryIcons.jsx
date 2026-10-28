import {
  Sandwich, Popcorn, UtensilsCrossed, CupSoda, Soup, Milk, Coffee,
  IceCreamBowl, Citrus, Utensils, LayoutGrid,
} from 'lucide-react';

// Category icons are chosen by slug on the frontend. The `icon` column stored in the
// database (legacy emoji) is intentionally NOT rendered, and is never modified.
const ICONS = {
  burgers: Sandwich,
  fries: Popcorn,
  combos: UtensilsCrossed,
  drinks: CupSoda,
  siomai: Soup,
  shakes: Milk,
  'milk-tea': Coffee,
  desserts: IceCreamBowl,
  'fresh-shakes': Citrus,
};

export function CategoryIcon({ slug, size = 16 }) {
  if (slug === 'all') return <LayoutGrid size={size} />;
  const Icon = ICONS[slug] || Utensils;
  return <Icon size={size} />;
}
