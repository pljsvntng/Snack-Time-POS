import TableScroll from '../components/TableScroll';
import { useEffect, useState, useRef } from 'react';
import { Plus, Pencil, ImagePlus, Eye, EyeOff, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { api, imageUrl } from '../services/api';
import { peso } from '../utils/currency';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const emptyForm = { category_id: '', name: '', description: '', price: '', sku: '', track_stock: false, stock: '', low_stock_threshold: 10 };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const fileInputRef = useRef(null);
  const [uploadTargetId, setUploadTargetId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([
        api.get('/products?includeUnavailable=true'),
        api.get('/categories'),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAddForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (p) => {
    setEditingId(p.id);
    setForm({
      category_id: p.category_id, name: p.name, description: p.description || '',
      price: p.price, sku: p.sku || '', track_stock: !!p.track_stock,
      stock: p.stock ?? '', low_stock_threshold: p.low_stock_threshold,
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, price: Number(form.price), stock: form.track_stock ? Number(form.stock || 0) : null };
      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
        setToast({ type: 'success', message: 'Product updated.' });
      } else {
        await api.post('/products', payload);
        setToast({ type: 'success', message: 'Product created.' });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const toggleAvailability = async (p) => {
    try {
      await api.put(`/products/${p.id}`, { available: p.available ? 0 : 1 });
      load();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const handleDeactivate = async (p) => {
    setConfirmTarget(p);
  };

  const confirmDeactivate = async () => {
    const p = confirmTarget;
    setConfirmTarget(null);
    try {
      await api.delete(`/products/${p.id}`);
      setToast({ type: 'success', message: 'Product deactivated.' });
      load();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const triggerUpload = (productId) => {
    setUploadTargetId(productId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !uploadTargetId) return;
    const product = products.find((p) => p.id === uploadTargetId);
    const formData = new FormData();
    formData.append('categorySlug', product?.category_slug || 'misc');
    formData.append('image', file);
    try {
      await api.postForm(`/products/${uploadTargetId}/image`, formData);
      setToast({ type: 'success', message: 'Image uploaded.' });
      load();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      e.target.value = '';
    }
  };

  const visibleProducts = categoryFilter ? products.filter((p) => p.category_id === Number(categoryFilter)) : products;

  return (
    <div>
      <div className="page-header">
        <h2>Products</h2>
        <button className="btn btn-primary" onClick={openAddForm}><Plus size={16} /> Add Product</button>
      </div>

      <div className="filter-row">
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <input type="file" accept="image/jpeg,image/png,image/webp" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />

      <div className="card">
        <TableScroll>
          <table className="data-table">
            <thead>
              <tr><th>Photo</th><th>Product</th><th>Category</th><th className="num">Price</th><th className="num">Stock</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}>Loading...</td></tr>
              ) : visibleProducts.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="thumb-box">
                      {p.image ? <img src={imageUrl(p.image)} alt="" /> : <UtensilsCrossed size={20} />}
                    </div>
                  </td>
                  <td><b>{p.name}</b><br /><span className="cell-sub">{p.sku}</span></td>
                  <td>{p.category_name}</td>
                  <td className="num">{peso(p.price)}</td>
                  <td className="num">{p.track_stock ? p.stock : '—'}</td>
                  <td><span className={`badge badge-${p.status}`}>{p.status.replace('_', ' ')}</span></td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => openEditForm(p)}><Pencil size={14} /> Edit</button>
                      <button className="btn btn-outline btn-sm" onClick={() => triggerUpload(p.id)}><ImagePlus size={14} /> Photo</button>
                      <button className="btn btn-outline btn-sm" onClick={() => toggleAvailability(p)}>
                        {p.available ? <><EyeOff size={14} /> Hide</> : <><Eye size={14} /> Show</>}
                      </button>
                      <button className="btn btn-danger-outline btn-sm" onClick={() => handleDeactivate(p)}><Trash2 size={14} /> Deactivate</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box wide" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={() => setShowForm(false)}><X size={18} /></button>
            <div className="modal-body">
              <div className="modal-title">{editingId ? 'Edit Product' : 'Add Product'}</div>
              <form onSubmit={handleSave} style={{ marginTop: 16 }}>
                <div className="form-grid">
                  <div className="form-group form-full">
                    <label htmlFor="products-field-1">Product Name</label>
                    <input id="products-field-1" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="products-field-2">Category</label>
                    <select id="products-field-2" required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                      <option value="">Select category</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="products-field-3">Price (₱)</label>
                    <input id="products-field-3" required type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                  </div>
                  <div className="form-group form-full">
                    <label htmlFor="products-field-4">Description</label>
                    <input id="products-field-4" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="products-field-5">SKU</label>
                    <input id="products-field-5" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="check-label">
                      <input type="checkbox" checked={form.track_stock} onChange={(e) => setForm({ ...form, track_stock: e.target.checked })} />
                      Track direct stock (e.g. per-piece items)
                    </label>
                  </div>
                  {form.track_stock && (
                    <>
                      <div className="form-group">
                        <label htmlFor="products-field-6">Current Stock</label>
                        <input id="products-field-6" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="products-field-7">Low Stock Threshold</label>
                        <input id="products-field-7" type="number" min="0" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-block">Save Product</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />

      <ConfirmDialog
        open={!!confirmTarget}
        title={`Deactivate "${confirmTarget?.name}"?`}
        message="It will be hidden from the POS immediately, but all past sales history involving this product is kept intact."
        confirmLabel="Deactivate"
        danger
        onConfirm={confirmDeactivate}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
