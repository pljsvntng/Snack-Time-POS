import { useEffect, useState, useMemo, useRef } from 'react';
import { api, imageUrl } from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import ProductCard from '../components/ProductCard';
import CustomizationModal from '../components/CustomizationModal';
import CartPanel from '../components/CartPanel';
import PaymentModal from '../components/PaymentModal';
import ReceiptView from '../components/ReceiptView';
import Toast from '../components/Toast';
import { Search, SearchX, Check, Printer, Plus, ShoppingCart } from 'lucide-react';
import { CategoryIcon } from '../utils/categoryIcons';
import { peso } from '../utils/currency';
import { buildCatalog, cardStock, stockMessage, findStockIssues, issuesMessage } from '../utils/stock';

export default function POS() {
  const { user, offline } = useAuth();
  const submissionRef = useRef(false);
  const cart = useCart();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [settings, setSettings] = useState({});
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [modalProduct, setModalProduct] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false); // mobile bottom-sheet only; no effect on cart data

  const loadData = async () => {
    setLoading(true);
    try {
      const [cats, prods, disc, sett] = await Promise.all([
        api.get('/categories'),
        api.get('/products'),
        api.get('/discounts'),
        api.get('/settings'),
      ]);
      setCategories(cats);
      setProducts(prods.map((p) => ({ ...p, image: imageUrl(p.image) })));
      setDiscounts(disc);
      setSettings(sett);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Quietly re-reads product + ingredient stock (no loading skeleton). Returns the fresh list, or null on failure.
  const refreshProducts = async () => {
    try {
      const prods = await api.get('/products');
      const list = prods.map((p) => ({ ...p, image: imageUrl(p.image) }));
      setProducts(list);
      return list;
    } catch (err) {
      return null;
    }
  };

  // Stock levels as of the latest product list; the cart uses them to limit what can be added.
  const catalog = useMemo(() => buildCatalog(products), [products]);
  useEffect(() => { cart.setCatalog(catalog); }, [catalog]);

  const warn = (message) => setToast({ type: 'warning', message });

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = activeCategory === 'all' || p.category_slug === activeCategory;
      const matchesSearch = !search || [p.name, p.category_name, ...(p.option_groups || []).flatMap((g) => g.options.map((o) => o.name))].some((name) => name?.toLowerCase().includes(search.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, search]);

  // Tapping a product that is out of stock explains which ingredient is missing.
  const handleBlockedClick = (product) => {
    warn(stockMessage(product, cart.getAvailability(product, []), 1));
  };

  const handleProductClick = (product) => {
    if (product.option_groups && product.option_groups.length > 0) {
      setModalProduct(product); // the options window applies the stock limits itself
    } else {
      const result = cart.addItem(product, [], 1);
      if (result.added < 1) warn(stockMessage(product, result, 1));
    }
  };

  const handleConfirmCustomization = ({ selectedOptions, quantity }) => {
    const result = cart.addItem(modalProduct, selectedOptions, quantity);
    if (result.added < quantity) warn(stockMessage(modalProduct, result, quantity));
    setModalProduct(null);
  };

  // Stock is checked again against the latest levels before payment is taken
  // (another cashier or an inventory change may have used it up since items were added).
  const handleCheckout = async () => {
    try { await cart.flushDraft(); } catch (err) { warn(err.message); return; }
    const fresh = await refreshProducts();
    if (fresh) {
      const issues = findStockIssues(cart.items, buildCatalog(fresh));
      if (issues.length) {
        warn(issuesMessage(issues));
        return;
      }
    }
    setShowPayment(true);
  };

  const handleConfirmPayment = async ({ payment_method, cash_received }) => {
    if (submissionRef.current) return;
    submissionRef.current = true;
    setSubmitting(true);
    try {
      const payload = {
        items: cart.items.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          selected_option_ids: item.selectedOptions.map((o) => o.option_id),
        })),
        request_id: offline ? cart.checkoutId() : undefined,
        expected_total: cart.total,
        discount_id: cart.discount?.id,
        payment_method,
        cash_received,
      };
      const order = await api.post('/orders', payload);
      setCompletedOrder(order);
      setShowPayment(false);
      cart.clearCart();
      loadData(); // refresh stock levels
    } catch (err) {
      setToast({ type: err.message.startsWith('Insufficient Stock') ? 'warning' : 'error', message: err.message });
      setShowPayment(false);
      refreshProducts(); // stock may have changed: update the cards and cart warnings
    } finally {
      submissionRef.current = false;
      setSubmitting(false);
    }
  };

  const handleNewOrder = () => setCompletedOrder(null);

  return (
    <div className="pos-layout">
      <div className="pos-menu">
        <div className="pos-search-row">
          <div className="search-field">
            <Search size={16} />
            <input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="category-tabs">
          <button className={`category-tab ${activeCategory === 'all' ? 'active' : ''}`} onClick={() => setActiveCategory('all')}>
            <CategoryIcon slug="all" /> All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`category-tab ${activeCategory === c.slug ? 'active' : ''}`}
              onClick={() => setActiveCategory(c.slug)}
            >
              <CategoryIcon slug={c.slug} /> {c.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="skeleton-grid">
            {Array.from({ length: 10 }).map((_, i) => (
              <div className="skeleton-card" key={i}>
                <div className="skeleton-photo" />
                <div className="skeleton-line" />
                <div className="skeleton-line short" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon"><SearchX size={36} /></span>
            <div className="empty-title">No food found</div>
            <div className="empty-sub">Try searching for another menu item, or pick a different category.</div>
          </div>
        ) : (
          <div className="product-grid">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                stock={cardStock(product, cart.items, catalog)}
                onClick={handleProductClick}
                onBlocked={handleBlockedClick}
              />
            ))}
          </div>
        )}
      </div>

      <div className={`cart-backdrop ${cartOpen ? 'show' : ''}`} onClick={() => setCartOpen(false)} />
      <CartPanel discounts={discounts} onCheckout={handleCheckout} open={cartOpen} onClose={() => setCartOpen(false)} />

      <button className="cart-fab" aria-controls="current-order" aria-expanded={cartOpen} onClick={() => setCartOpen(true)}>
        <span className="fab-left">
          <ShoppingCart size={20} />
          View order
          <span className="fab-count">{cart.items.reduce((n, i) => n + i.quantity, 0)}</span>
        </span>
        <span>{peso(cart.total)}</span>
      </button>

      {modalProduct && (
        <CustomizationModal
          product={modalProduct}
          onClose={() => setModalProduct(null)}
          onConfirm={handleConfirmCustomization}
          getAvailability={cart.getAvailability}
          isOptionAvailable={cart.isOptionAvailable}
        />
      )}

      {showPayment && (
        <PaymentModal
          total={cart.total}
          cashOnly={offline}
          submitting={submitting}
          onClose={() => setShowPayment(false)}
          onConfirm={handleConfirmPayment}
        />
      )}

      {completedOrder && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-body">
              <div className="payment-success-banner">
                <div className="payment-success-check"><Check size={28} /></div>
                <div className="payment-success-title">{offline ? 'Sale saved on this device' : 'Payment Successful!'}</div>
                <div className="payment-success-order">
                  Order #{completedOrder.order_number} · Thank you for your order!
                </div>
              </div>
              <ReceiptView order={completedOrder} settings={settings} cashierName={user?.fullName} />
              <div className="modal-actions" style={{ marginTop: 16 }}>
                <button className="btn btn-outline btn-block" onClick={() => window.print()}><Printer size={16} /> Print Receipt</button>
                <button className="btn btn-primary btn-block" onClick={handleNewOrder}><Plus size={16} /> New Order</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}
