import DialogSurface from '../components/DialogSurface';
import PageHeader from '../components/PageHeader';
import TableScroll from '../components/TableScroll';
import { useEffect, useState } from 'react';
import { Plus, SlidersHorizontal, X, Search, Boxes, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { formatDateTime } from '../utils/currency';
import Toast from '../components/Toast';
import OfflineReconciliation from '../components/OfflineReconciliation';

export default function Inventory() {
  const [ingredients, setIngredients] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', unit: 'pcs', current_stock: 0, min_stock: 0, cost_per_unit: 0 });
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'add', quantity: '', reason: '' });
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState('stock');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [ing, tx] = await Promise.all([api.get('/inventory'), api.get('/inventory/transactions')]);
      setIngredients(ing);
      setTransactions(tx);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAddIngredient = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inventory', addForm);
      setToast({ type: 'success', message: 'Ingredient added.' });
      setShowAddForm(false);
      setAddForm({ name: '', unit: 'pcs', current_stock: 0, min_stock: 0, cost_per_unit: 0 });
      load();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inventory/adjust', {
        ingredient_id: adjustTarget.id,
        type: adjustForm.type,
        quantity: Number(adjustForm.quantity),
        reason: adjustForm.reason,
      });
      setToast({ type: 'success', message: 'Stock updated.' });
      setAdjustTarget(null);
      setAdjustForm({ type: 'add', quantity: '', reason: '' });
      load();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const visibleIngredients = ingredients.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  const restockCount = ingredients.filter(i => ['low_stock', 'out_of_stock'].includes(i.status)).length;

  return (
    <div>
      <PageHeader title="Inventory" description="Keep the counter stocked. Track ingredients and every stock movement.">
        <button className="btn btn-primary" onClick={() => setShowAddForm(true)}><Plus size={16} /> Add Ingredient</button>
      </PageHeader>

      <div className="category-tabs">
        <button className={`category-tab ${tab === 'stock' ? 'active' : ''}`} onClick={() => setTab('stock')}>Current Stock</button>
        <button className={`category-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>Transaction History</button>
        <button className={`category-tab ${tab === 'sync' ? 'active' : ''}`} onClick={() => setTab('sync')}>Offline reconciliation</button>
      </div>

      {tab === 'stock' && <>
        <div className="inventory-overview">
          <span><Boxes size={17} /><b>{ingredients.length}</b> ingredients tracked</span>
          <span className={restockCount ? 'needs-attention' : ''}><AlertTriangle size={17} /><b>{restockCount}</b> need restocking</span>
        </div>
        <div className="filter-row"><div className="search-field"><Search size={16} /><input aria-label="Search ingredients" placeholder="Find an ingredient…" value={search} onChange={e => setSearch(e.target.value)} /></div></div>
      </>}

      {tab === 'sync' ? <OfflineReconciliation /> : tab === 'stock' ? (
        <div className="card">
          <TableScroll>
            <table className="data-table">
              <thead>
                <tr><th>Ingredient</th><th className="num">Current Stock</th><th className="num">Min Stock</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={5} className="table-empty">Loading stock…</td></tr> : visibleIngredients.length === 0 ? <tr><td colSpan={5} className="table-empty">No ingredients found.</td></tr> : visibleIngredients.map((ing) => (
                  <tr key={ing.id}>
                    <td><b>{ing.name}</b></td>
                    <td className="num">{Number(ing.current_stock).toLocaleString()} {ing.unit}</td>
                    <td className="num">{Number(ing.min_stock).toLocaleString()} {ing.unit}</td>
                    <td><span className={`badge badge-${ing.status}`}>{ing.status.replace('_', ' ')}</span></td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => setAdjustTarget(ing)}><SlidersHorizontal size={14} /> Adjust Stock</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </TableScroll>
        </div>
      ) : (
        <div className="card">
          <TableScroll>
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Ingredient</th><th>Type</th><th className="num">Qty</th><th className="num">Resulting Stock</th><th>Reason</th><th>By</th></tr>
              </thead>
              <tbody>
                {!loading && transactions.length === 0 && <tr><td colSpan={7} className="table-empty">Stock movements will appear here.</td></tr>}
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{formatDateTime(t.created_at)}</td>
                    <td>{t.ingredient_name}</td>
                    <td style={{ textTransform: 'capitalize' }}>{t.type}</td>
                    <td className="num">{Number(t.quantity).toLocaleString()} {t.unit}</td>
                    <td className="num">{Number(t.resulting_stock).toLocaleString()} {t.unit}</td>
                    <td>{t.reason}</td>
                    <td>{t.user_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        </TableScroll>
        </div>
      )}

      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <DialogSurface label="Add Ingredient" onClose={() => setShowAddForm(false)} className="">
            <button className="modal-close" aria-label="Close" onClick={() => setShowAddForm(false)}><X size={18} /></button>
            <div className="modal-body">
              <div className="modal-title">Add Ingredient</div>
              <form onSubmit={handleAddIngredient} style={{ marginTop: 16 }}>
                <div className="form-group">
                  <label htmlFor="inventory-field-1">Name</label>
                  <input id="inventory-field-1" required value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label htmlFor="inventory-field-2">Unit</label>
                  <input id="inventory-field-2" value={addForm.unit} onChange={(e) => setAddForm({ ...addForm, unit: e.target.value })} placeholder="pcs, g, ml, servings..." />
                </div>
                <div className="form-group">
                  <label htmlFor="inventory-field-3">Starting Stock</label>
                  <input id="inventory-field-3" type="number" min="0" value={addForm.current_stock} onChange={(e) => setAddForm({ ...addForm, current_stock: e.target.value })} />
                </div>
                <div className="form-group">
                  <label htmlFor="inventory-field-4">Minimum Stock (low stock alert)</label>
                  <input id="inventory-field-4" type="number" min="0" value={addForm.min_stock} onChange={(e) => setAddForm({ ...addForm, min_stock: e.target.value })} />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setShowAddForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-block">Save</button>
                </div>
              </form>
            </div>
          </DialogSurface>
        </div>
      )}

      {adjustTarget && (
        <div className="modal-overlay" onClick={() => setAdjustTarget(null)}>
          <DialogSurface label="Adjust Stock" onClose={() => setAdjustTarget(null)} className="">
            <button className="modal-close" aria-label="Close" onClick={() => setAdjustTarget(null)}><X size={18} /></button>
            <div className="modal-body">
              <div className="modal-title">Adjust Stock — {adjustTarget.name}</div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>
                Current stock: {Number(adjustTarget.current_stock).toLocaleString()} {adjustTarget.unit}
              </p>
              <form onSubmit={handleAdjust}>
                <div className="form-group">
                  <label htmlFor="inventory-field-5">Action</label>
                  <select id="inventory-field-5" value={adjustForm.type} onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}>
                    <option value="add">Add stock (delivery/restock)</option>
                    <option value="deduct">Deduct stock (spoilage/waste)</option>
                    <option value="adjust">Set exact stock (physical count)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="inventory-field-6">{adjustForm.type === 'adjust' ? 'New Stock Value' : 'Quantity'}</label>
                  <input id="inventory-field-6" required type="number" min="0" step="0.01" value={adjustForm.quantity} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })} />
                </div>
                <div className="form-group">
                  <label htmlFor="inventory-field-7">Reason / Note</label>
                  <input id="inventory-field-7" value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} placeholder="e.g. Weekly delivery" />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setAdjustTarget(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-block">Confirm</button>
                </div>
              </form>
            </div>
          </DialogSurface>
        </div>
      )}

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}
