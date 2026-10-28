// Stock helpers for the POS screen. Pure functions: no network calls, no side effects.
//
// The backend stays the final authority (it re-checks and locks stock when the order is saved).
// These helpers only stop the cashier from building an order that could never be completed, and
// explain why. Nothing here changes stored stock: it is only deducted when an order is completed.

export const LOW_STOCK_ORDERS = 10; // "low stock" when this many orders (or fewer) can still be made. Same value the backend uses.
const EPS = 1e-9;

export const EMPTY_CATALOG = { products: new Map(), ingredients: new Map() };

const fmt = (n) => String(Number(Number(n).toFixed(2)));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Latest product list -> lookup tables for products and for ingredient stock levels.
export function buildCatalog(products) {
  const productMap = new Map();
  const ingredients = new Map();
  const note = (r) => ingredients.set(r.ingredient_id, { name: r.name, unit: r.unit, stock: Number(r.current_stock) });
  for (const p of products) {
    productMap.set(p.id, p);
    (p.recipe || []).forEach(note);
    for (const g of p.option_groups || []) {
      for (const o of g.options || []) (o.ingredients || []).forEach(note);
    }
  }
  return { products: productMap, ingredients };
}

// What ONE unit of this product needs: base recipe + the ingredients of every chosen option.
export function unitNeeds(product, selectedOptions = []) {
  const needs = new Map();
  const add = (r) => {
    const per = Number(r.quantity_required);
    if (!(per > 0)) return;
    const prev = needs.get(r.ingredient_id);
    needs.set(r.ingredient_id, { ingredient_id: r.ingredient_id, name: r.name, unit: r.unit, per: (prev ? prev.per : 0) + per });
  };
  (product.recipe || []).forEach(add);
  for (const o of selectedOptions) (o.ingredients || []).forEach(add);
  return needs;
}

// Everything the current cart would consume if it were paid right now.
export function cartUsage(items) {
  const ingredients = new Map();
  const products = new Map();
  for (const item of items) {
    for (const n of unitNeeds(item.product, item.selectedOptions).values()) {
      ingredients.set(n.ingredient_id, (ingredients.get(n.ingredient_id) || 0) + n.per * item.quantity);
    }
    products.set(item.product.id, (products.get(item.product.id) || 0) + item.quantity);
  }
  return { ingredients, products };
}

// How many MORE units of this product (with these options) can be added, counting what is already in the cart.
// max === Infinity means nothing about it is stock-tracked.
export function availability(product, selectedOptions, items, catalog) {
  const latest = catalog.products.get(product.id) || product;
  const usage = cartUsage(items);
  let max = Infinity;
  let limiter = null;

  for (const n of unitNeeds(latest, selectedOptions).values()) {
    const info = catalog.ingredients.get(n.ingredient_id);
    if (!info) continue; // unknown stock level: do not block, the server decides
    const used = usage.ingredients.get(n.ingredient_id) || 0;
    const can = Math.max(0, Math.floor((info.stock - used + EPS) / n.per));
    if (can < max) {
      max = can;
      limiter = { kind: 'ingredient', name: n.name, unit: n.unit, stock: info.stock, used, per: n.per };
    }
  }

  // Products sold straight from their own stock count (e.g. sold by the piece)
  if (latest.track_stock) {
    const stock = Number(latest.stock);
    const used = usage.products.get(product.id) || 0;
    const can = Math.max(0, Math.floor(stock - used + EPS));
    if (can < max) {
      max = can;
      limiter = { kind: 'product', name: latest.name, unit: 'pcs', stock, used, per: 1 };
    }
  }
  return { max, limiter };
}

// Can ONE more unit of this option's own ingredients still be supplied? (Used to grey out options.)
export function optionAvailable(option, items, catalog) {
  const usage = cartUsage(items);
  for (const r of option.ingredients || []) {
    const per = Number(r.quantity_required);
    const info = catalog.ingredients.get(r.ingredient_id);
    if (!(per > 0) || !info) continue;
    if (info.stock - (usage.ingredients.get(r.ingredient_id) || 0) + EPS < per) return false;
  }
  return true;
}

// The warning shown to the cashier when `requested` units cannot all be added.
export function stockMessage(product, avail, requested = 1) {
  const { max, limiter } = avail;
  if (!limiter) return '';
  const what = limiter.kind === 'product' ? `"${product.name}"` : `the available ${limiter.name}`;
  if (max < 1) {
    if (limiter.used > 0) {
      return `Out of Stock: all the available ${limiter.kind === 'product' ? `"${product.name}"` : limiter.name} (${fmt(limiter.stock)} ${limiter.unit}) is already in the current order.`;
    }
    return limiter.kind === 'product'
      ? `Out of Stock: "${product.name}" has no stock left.`
      : `Out of Stock: not enough ${limiter.name} for "${product.name}" (${fmt(limiter.stock)} ${limiter.unit} left, ${fmt(limiter.per)} needed per order).`;
  }
  if (limiter.used > 0) {
    return `Insufficient Stock: Only ${plural(max, 'more order')} of "${product.name}" can be added. The rest of ${what} is already in the current order.`;
  }
  return `Insufficient Stock: Only ${plural(max, 'order')} of "${product.name}" can be fulfilled with ${what} (${fmt(limiter.stock)} ${limiter.unit}).`;
}

// Status for a product card, based on the base recipe and the current cart.
//   state: 'unavailable' | 'out' | 'low' | 'in' | 'untracked'
export function cardStock(product, items, catalog) {
  if (product.status === 'unavailable') return { state: 'unavailable' };
  const latest = catalog.products.get(product.id) || product;
  const now = availability(latest, [], items, catalog);
  if (now.max === Infinity) return { state: 'untracked' };

  const fresh = availability(latest, [], [], catalog); // ignoring the cart: is it out regardless of this order?
  if (fresh.max < 1) {
    return { state: 'out', cartLimited: false, avail: fresh, note: `No ${fresh.limiter.name} left` };
  }
  if (now.max < 1) {
    return { state: 'out', cartLimited: true, avail: now, note: `All ${now.limiter.name} is in the current order` };
  }
  const lowAt = now.limiter.kind === 'product' ? (Number(latest.low_stock_threshold) || LOW_STOCK_ORDERS) : LOW_STOCK_ORDERS;
  return { state: now.max <= lowAt ? 'low' : 'in', max: now.max, avail: now };
}

// Ingredients (or tracked products) that the cart needs more of than is in stock right now.
export function findStockIssues(items, catalog) {
  const usage = cartUsage(items);
  const issues = [];
  for (const [id, used] of usage.ingredients) {
    const info = catalog.ingredients.get(id);
    if (info && used > info.stock + EPS) issues.push({ kind: 'ingredient', id, name: info.name, unit: info.unit, stock: info.stock, used });
  }
  for (const [pid, used] of usage.products) {
    const p = catalog.products.get(pid);
    if (p && p.track_stock && used > Number(p.stock) + EPS) {
      issues.push({ kind: 'product', id: pid, name: p.name, unit: 'pcs', stock: Number(p.stock), used });
    }
  }
  return issues;
}

// The first issue affecting a particular cart line, or null.
export function lineIssue(item, issues) {
  if (!issues.length) return null;
  const needs = unitNeeds(item.product, item.selectedOptions);
  return issues.find((i) => (i.kind === 'ingredient' ? needs.has(i.id) : i.id === item.product.id)) || null;
}

export function issuesMessage(issues) {
  const parts = issues.map((i) => `${i.name} (needs ${fmt(i.used)} ${i.unit}, only ${fmt(i.stock)} available)`);
  return `Insufficient Stock: ${parts.join('; ')}. Please reduce the quantity or remove the item.`;
}
