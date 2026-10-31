import { createContext, useContext, useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { availability, optionAvailable, findStockIssues, lineIssue as findLineIssue, EMPTY_CATALOG } from '../utils/stock';

import { unitAmount, lineAmount, cartAmounts } from '../utils/money';
import { getOfflineStore } from '../offline/runtime';
import { useAuth } from './AuthContext';
const CartContext = createContext(null);

let nextCartItemId = 1;

const computeUnitPrice = unitAmount;

// Two cart lines are the same line item only when they are the same product (matched by its
// unique id, never by name or price) AND have exactly the same selected options. Different
// options mean a different unit price and different stock deductions, so those stay separate.
function lineKey(product, selectedOptions) {
  const optionIds = selectedOptions.map((o) => o.option_id).sort((a, b) => a - b);
  return `${product.id}|${optionIds.join(',')}`;
}

export function CartProvider({ children }) {
  const { user, offline } = useAuth();
  const checkoutIdRef = useRef(crypto.randomUUID());
  const discountRef = useRef(null);
  const [hydratedUser, setHydratedUser] = useState(null);
  const [persistenceError, setPersistenceError] = useState(null);
  const [items, setItemsState] = useState([]);
  const [discount, setDiscountState] = useState(null);
  const setDiscount = useCallback(value => { checkoutIdRef.current = crypto.randomUUID(); discountRef.current = value; setDiscountState(value); }, []);

  // Stock levels from the latest product list (set by the POS screen). Used only to limit what can be added.
  const [catalog, setCatalogState] = useState(EMPTY_CATALOG);
  const catalogRef = useRef(EMPTY_CATALOG);
  const setCatalog = useCallback((c) => { catalogRef.current = c; setCatalogState(c); }, []);

  // Every cart change goes through commit(), which updates the ref and the React state together.
  // The ref always holds the newest cart, so even very fast repeated clicks are checked against
  // the true current quantities and the stock limit cannot be overshot.
  const itemsRef = useRef([]);
  const commit = useCallback((next) => { checkoutIdRef.current = crypto.randomUUID(); itemsRef.current = next; setItemsState(next); }, []);

  // selectedOptions: [{ option_id, group_name, name, price_modifier, ingredients }]
  // Returns { requested, added, max, limiter }: `added` can be lower than `requested` when stock runs out.
  const addItem = useCallback((product, selectedOptions = [], quantity = 1) => {
    const current = itemsRef.current;
    const avail = availability(product, selectedOptions, current, catalogRef.current);
    const allowed = Math.min(quantity, avail.max);
    const result = { requested: quantity, added: Math.max(0, allowed), ...avail };
    if (allowed < 1) return result;

    const key = lineKey(product, selectedOptions);
    const existing = current.find((i) => lineKey(i.product, i.selectedOptions) === key);
    if (existing) {
      const newQty = existing.quantity + allowed;
      commit(current.map((i) => (i === existing ? { ...i, quantity: newQty, subtotal: lineAmount(i.unitPrice, newQty) } : i)));
    } else {
      const unitPrice = computeUnitPrice(product, selectedOptions);
      commit([
        ...current,
        { cartItemId: nextCartItemId++, product, selectedOptions, quantity: allowed, unitPrice, subtotal: lineAmount(unitPrice, allowed) },
      ]);
    }
    return result;
  }, [commit]);

  // Increasing is limited by stock; decreasing is always allowed (never below 1, use Remove to delete).
  const updateQuantity = useCallback((cartItemId, quantity) => {
    const current = itemsRef.current;
    const item = current.find((i) => i.cartItemId === cartItemId);
    if (!item) return { quantity: 0, capped: false };

    let target = Math.max(1, quantity);
    let capped = false;
    if (target > item.quantity) {
      const avail = availability(item.product, item.selectedOptions, current, catalogRef.current);
      const highest = item.quantity + avail.max;
      if (target > highest) { target = Math.max(item.quantity, highest); capped = true; }
    }
    if (target !== item.quantity) {
      commit(current.map((i) => (i === item ? { ...i, quantity: target, subtotal: lineAmount(i.unitPrice, target) } : i)));
    }
    return { quantity: target, capped };
  }, [commit]);

  const removeItem = useCallback((cartItemId) => {
    commit(itemsRef.current.filter((item) => item.cartItemId !== cartItemId));
  }, [commit]);

  const updateItemOptions = useCallback((cartItemId, selectedOptions) => {
    commit(itemsRef.current.map((item) => {
      if (item.cartItemId !== cartItemId) return item;
      const unitPrice = computeUnitPrice(item.product, selectedOptions);
      return { ...item, selectedOptions, unitPrice, subtotal: lineAmount(unitPrice, item.quantity) };
    }));
  }, [commit]);

  const clearCart = useCallback(() => {
    commit([]);
    setDiscount(null);
  }, [commit]);

  useEffect(() => {
    let cancelled = false;
    clearCart(); setCatalog(EMPTY_CATALOG); setHydratedUser(null); setPersistenceError(null);
    if (offline && user) getOfflineStore().then(store => store.draft()).then(saved => {
      if (cancelled) return;
      if (saved) {
        commit(saved.items); setDiscount(saved.discount || null); checkoutIdRef.current = saved.request_id;
        nextCartItemId = Math.max(nextCartItemId, ...saved.items.map(item => item.cartItemId + 1));
      }
      setHydratedUser(user.id);
    }).catch(err => { if (!cancelled) setPersistenceError(err.message); });
    return () => { cancelled = true; };
  }, [user?.id, offline, clearCart, setCatalog, commit, setDiscount]);

  const flushDraft = useCallback(async () => {
    if (!offline) return;
    if (hydratedUser !== user?.id) throw new Error('The saved cart is still opening.');
    const store = await getOfflineStore();
    await store.draft({ items: itemsRef.current, discount: discountRef.current, request_id: checkoutIdRef.current }, user.id);
    window.dispatchEvent(new Event('pos:cartpersisted'));
    setPersistenceError(null);
  }, [offline, hydratedUser, user?.id]);
  useEffect(() => {
    if (offline && user && hydratedUser === user.id) flushDraft().catch(err => setPersistenceError(err.message));
  }, [items, discount, offline, user?.id, hydratedUser, flushDraft]);

  const { subtotal, discountAmount, total } = useMemo(() => cartAmounts(items, discount), [items, discount]);

  // ---- stock information for the screens (recomputed whenever the cart or the stock levels change) ----
  const getAvailability = useCallback(
    (product, selectedOptions = []) => availability(product, selectedOptions, items, catalog),
    [items, catalog]
  );
  const isOptionAvailable = useCallback((option) => optionAvailable(option, items, catalog), [items, catalog]);
  const stockIssues = useMemo(() => findStockIssues(items, catalog), [items, catalog]);
  const lineIssue = useCallback((item) => findLineIssue(item, stockIssues), [stockIssues]);

  const value = {
    items, addItem, updateQuantity, removeItem, updateItemOptions, clearCart,
    flushDraft, checkoutId: () => checkoutIdRef.current, persistenceError, restoringDraft: offline && hydratedUser !== user?.id,
    discount, setDiscount, subtotal, discountAmount, total,
    catalog, setCatalog, getAvailability, isOptionAvailable, stockIssues, lineIssue,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
