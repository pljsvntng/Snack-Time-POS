import TableScroll from '../components/TableScroll';
import {syncLabel} from '../utils/syncLabel';
import { useEffect, useState } from 'react';
import { Search, Eye, Printer, X } from 'lucide-react';
import { api } from '../services/api';
import { peso, formatDateTime, businessDate } from '../utils/currency';
import ReceiptView from '../components/ReceiptView';
import { useAuth } from '../context/AuthContext';

function dateRangeFor(filter) {
  const now = new Date(`${businessDate()}T00:00:00Z`);
  const fmt = (d) => d.toISOString().slice(0, 10);
  if (filter === 'today') return { from: `${fmt(now)} 00:00:00`, to: `${fmt(now)} 23:59:59` };
  if (filter === 'yesterday') {
    const y = new Date(now); y.setUTCDate(now.getUTCDate() - 1);
    return { from: `${fmt(y)} 00:00:00`, to: `${fmt(y)} 23:59:59` };
  }
  if (filter === 'week') {
    const start = new Date(now); start.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
    return { from: `${fmt(start)} 00:00:00`, to: `${fmt(now)} 23:59:59` };
  }
  if (filter === 'month') {
    const start = new Date(now); start.setUTCDate(1);
    return { from: `${fmt(start)} 00:00:00`, to: `${fmt(now)} 23:59:59` };
  }
  return {};
}

export default function Transactions() {
  const { user } = useAuth();
  const [error, setError] = useState('');
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('today');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const range = dateRangeFor(filter);
      const params = new URLSearchParams();
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);
      if (search) params.set('search', search);
      const [ords, sett] = await Promise.all([
        api.get(`/orders?${params.toString()}`),
        api.get('/settings'),
      ]);
      setOrders(ords);
      setSettings(sett);
    } catch (err) { setError(err.message); setOrders([]); } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const handleSearch = (e) => { e.preventDefault(); load(); };

  const viewOrder = async (id) => {
    try { const order = await api.get(`/orders/${id}`); setSelectedOrder(order); }
    catch (err) { setError(err.message); }
  };

  return (
    <div>
      <div className="page-header"><h2>{user.role === 'admin' ? 'Transaction History' : 'My Transactions'}</h2></div>

      {error && <div className="login-error" role="alert">{error}</div>}
      <form className="filter-row" onSubmit={handleSearch}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="all">All</option>
        </select>
        <div className="search-field">
          <Search size={16} />
          <input placeholder="Search order # or product..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-outline"><Search size={16} /> Search</button>
      </form>

      <div className="card">
        <TableScroll>
          <table className="data-table">
            <thead>
              <tr><th>Order #</th><th>Date/Time</th>{user.role === 'admin' && <th>Cashier</th>}<th className="num">Total</th><th>Payment</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}>Loading...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No transactions found.</td></tr>
              ) : orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.order_number}{syncLabel(o) && <span className="cell-sub" style={{ display: 'block' }}>{syncLabel(o)}</span>}</td>
                  <td>{formatDateTime(o.created_at)}</td>
                  {user.role === 'admin' && <td>{o.cashier_name}</td>}
                  <td className="num">{peso(o.total)}</td>
                  <td style={{ textTransform: 'capitalize' }}>{o.payment_method}</td>
                  <td><span className={`badge badge-${o.status}`}>{o.status}</span></td>
                  <td><button className="btn btn-outline btn-sm" onClick={() => viewOrder(o.id)}><Eye size={14} /> View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </div>

      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={() => setSelectedOrder(null)}><X size={18} /></button>
            <div className="modal-body">
              <ReceiptView order={selectedOrder} settings={settings} cashierName={selectedOrder.cashier_name} />
              <div className="modal-actions" style={{ marginTop: 16 }}>
                <button className="btn btn-outline btn-block" onClick={() => window.print()}><Printer size={16} /> Print Receipt</button>
                <button className="btn btn-primary btn-block" onClick={() => setSelectedOrder(null)}><X size={16} /> Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
