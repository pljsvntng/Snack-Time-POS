import DialogSurface from '../components/DialogSurface';
import PageHeader from '../components/PageHeader';
import TableScroll from '../components/TableScroll';
import { useEffect, useState } from 'react';
import { Plus, Pencil, UserX, UserCheck, X, Search } from 'lucide-react';
import { api } from '../services/api';
import { formatDateTime } from '../utils/currency';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const emptyForm = { full_name: '', username: '', email: '', password: '', role: 'cashier' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState(null);
  const [disableTarget, setDisableTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => { setLoading(true); return api.get('/users').then(setUsers).catch((e) => setToast({ type: 'error', message: e.message })).finally(() => setLoading(false)); };

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

  const visibleUsers = users.filter(u => [u.full_name, u.username, u.email].some(value => value?.toLowerCase().includes(search.toLowerCase())));

  return (
    <div>
      <PageHeader title="Your team" description="Manage the people behind the counter and their access.">
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add User</button>
      </PageHeader>

      <div className="filter-row"><div className="search-field"><Search size={16} /><input aria-label="Search team" placeholder="Search name, username or email…" value={search} onChange={e => setSearch(e.target.value)} /></div><span className="filter-count">{users.length} team members</span></div>

      <div className="card">
        <TableScroll>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="table-empty">Loading your team…</td></tr> : visibleUsers.length === 0 ? <tr><td colSpan={7} className="table-empty">No team members found.</td></tr> : visibleUsers.map((u) => (
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
                      <button className={`btn ${u.active ? 'btn-danger-outline' : 'btn-outline'} btn-sm`} onClick={() => u.active ? setDisableTarget(u) : toggleActive(u)}>
                        {u.active ? <><UserX size={14} /> Disable</> : <><UserCheck size={14} /> Enable</>}
                      </button>
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
          <DialogSurface label={editingId ? 'Edit User' : 'Add User'} onClose={() => setShowForm(false)} className="">
            <button className="modal-close" aria-label="Close" onClick={() => setShowForm(false)}><X size={18} /></button>
            <div className="modal-body">
              <div className="modal-title">{editingId ? 'Edit User' : 'Add User'}</div>
              <form onSubmit={handleSave} style={{ marginTop: 16 }}>
                <div className="form-group">
                  <label htmlFor="users-field-1">Full Name</label>
                  <input id="users-field-1" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label htmlFor="users-field-2">Username</label>
                  <input id="users-field-2" required disabled={!!editingId} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </div>
                <div className="form-group">
                  <label htmlFor="users-field-3">Email</label>
                  <input id="users-field-3" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label htmlFor="users-field-4">{editingId ? 'New Password (leave blank to keep current)' : 'Password'}</label>
                  <input id="users-field-4" type="password" autoComplete="new-password" minLength={form.role==='admin'?15:6} required={!editingId} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  {form.role==='admin'&&<small>Use a unique passphrase of at least 15 characters, up to 72 UTF-8 bytes.</small>}
                </div>
                <div className="form-group">
                  <label htmlFor="users-field-5">Role</label>
                  <select id="users-field-5" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
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
          </DialogSurface>
        </div>
      )}

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      <ConfirmDialog open={Boolean(disableTarget)} title={`Disable ${disableTarget?.full_name}?`} message="This team member will lose access to the register. Their past sales remain in transaction history." confirmLabel="Disable user" danger onCancel={() => setDisableTarget(null)} onConfirm={() => { toggleActive(disableTarget); setDisableTarget(null); }} />
    </div>
  );
}
