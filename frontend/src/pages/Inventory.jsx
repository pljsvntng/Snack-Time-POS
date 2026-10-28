import { useEffect, useState } from 'react';
import { Plus, SlidersHorizontal, X } from 'lucide-react';
import { api } from '../services/api';
import { formatDateTime } from '../utils/currency';
import Toast from '../components/Toast';

export default function Inventory() {
  const [ingredients, setIngredients] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', unit: 'pcs', current_stock: 0, min_stock: 0, cost_per_unit: 0 });
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'add', quantity: '', reason: '' });
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState('stock');

  const load = async () => {
    try {
      const [ing, tx] = await Promise.all([api.get('/inventory'), api.get('/inventory/transactions')]);
      setIngredients(ing);
      setTransactions(tx);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
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

  return (
    <div>
      <div className="page-header">
        <h2>Inventory</h2>
        <button className="btn btn-primary" onClick={() => setShowAddForm(true)}><Plus size={16} /> Add Ingredient</button>
      </div>

      <div className="category-tabs">
        <button className={`category-tab ${tab === 'stock' ? 'active' : ''}`} onClick={() => setTab('stock')}>Current Stock</button>
        <button className={`category-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>Transaction History</button>
      </div>

      {tab === 'stock' ? (
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Ingredient</th><th className="num">Current Stock</th><th className="num">Min Stock</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {ingredients.map((ing) => (
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
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Ingredient</th><th>Type</th><th className="num">Qty</th><th className="num">Resulting Stock</th><th>Reason</th><th>By</th></tr>
              </thead>
              <tbody>
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
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={() => setShowAddForm(false)}><X size={18} /></button>
            <div className="modal-body">
              <div className="modal-title">Add Ingredient</div>
              <form onSubmit={handleAddIngredient} style={{ marginTop: 16 }}>
                <div className="form-group">
                  <label>Name</label>
                  <input required value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <input value={addForm.unit} onChange={(e) => setAddForm({ ...addForm, unit: e.target.value })} placeholder="pcs, g, ml, servings..." />
                </div>
                <div className="form-group">
                  <label>Starting Stock</label>
                  <input type="number" min="0" value={addForm.current_stock} onChange={(e) => setAddForm({ ...addForm, current_stock: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Minimum Stock (low stock alert)</label>
                  <input type="number" min="0" value={addForm.min_stock} onChange={(e) => setAddForm({ ...addForm, min_stock: e.target.value })} />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setShowAddForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-block">Save</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {adjustTarget && (
        <div className="modal-overlay" onClick={() => setAdjustTarget(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={() => setAdjustTarget(null)}><X size={18} /></button>
            <div className="modal-body">
              <div className="modal-title">Adjust Stock — {adjustTarget.name}</div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>
                Current stock: {Number(adjustTarget.current_stock).toLocaleString()} {adjustTarget.unit}
              </p>
              <form onSubmit={handleAdjust}>
                <div className="form-group">
                  <label>Action</label>
                  <select value={adjustForm.type} onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}>
                    <option value="add">Add stock (delivery/restock)</option>
                    <option value="deduct">Deduct stock (spoilage/waste)</option>
                    <option value="adjust">Set exact stock (physical count)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{adjustForm.type === 'adjust' ? 'New Stock Value' : 'Quantity'}</label>
                  <input required type="number" min="0" step="0.01" value={adjustForm.quantity} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Reason / Note</label>
                  <input value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} placeholder="e.g. Weekly delivery" />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setAdjustTarget(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-block">Confirm</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}
