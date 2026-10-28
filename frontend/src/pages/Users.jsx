import { useEffect, useState } from 'react';
import { Plus, Pencil, UserX, UserCheck, X } from 'lucide-react';
import { api } from '../services/api';
import { formatDateTime } from '../utils/currency';
import Toast from '../components/Toast';

const emptyForm = { full_name: '', username: '', email: '', password: '', role: 'cashier' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState(null);

  const load = () => api.get('/users').then(setUsers).catch((e) => setToast({ type: 'error', message: e.message }));

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (u) => { setEditingId(u.id); setForm({ full_name: u.full_name, username: u.username, email: u.email || '', password: '', role: u.role }); setShowForm(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        const { username, ...updatable } = form;
        const payload = { ...updatable };
        if (!payload.password) delete payload.password;
        await api.put(`/users/${editingId}`, payload);
        setToast({ type: 'success', message: 'User updated.' });
      } else {
        await api.post('/users', form);
        setToast({ type: 'success', message: 'User created.' });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const toggleActive = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { active: u.active ? 0 : 1 });
      load();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Users</h2>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add User</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><b>{u.full_name}</b></td>
                  <td>{u.username}</td>
                  <td>{u.email || '—'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
                  <td><span className={`badge badge-${u.active ? 'available' : 'unavailable'}`}>{u.active ? 'Active' : 'Disabled'}</span></td>
                  <td>{formatDateTime(u.created_at)}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(u)}><Pencil size={14} /> Edit</button>
                      <button className="btn btn-outline btn-sm" onClick={() => toggleActive(u)}>
                        {u.active ? <><UserX size={14} /> Disable</> : <><UserCheck size={14} /> Enable</>}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={() => setShowForm(false)}><X size={18} /></button>
            <div className="modal-body">
              <div className="modal-title">{editingId ? 'Edit User' : 'Add User'}</div>
              <form onSubmit={handleSave} style={{ marginTop: 16 }}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Username</label>
                  <input required disabled={!!editingId} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>{editingId ? 'New Password (leave blank to keep current)' : 'Password'}</label>
                  <input type="password" required={!editingId} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="cashier">Cashier</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-block">Save</button>
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
