import DialogSurface from '../components/DialogSurface';
import PageHeader from '../components/PageHeader';
import TableScroll from '../components/TableScroll';
import {syncLabel} from '../utils/syncLabel';
import { useEffect, useState, useRef } from 'react';
import { Search, Eye, Printer, X } from 'lucide-react';
import { api } from '../services/api';
import { peso, formatDateTime, businessDate } from '../utils/currency';
import ReceiptView from '../components/ReceiptView';
import { useAuth } from '../context/AuthContext';
import { orderTypeLabel } from '../utils/orderDetails';

function dateRangeFor(filter) {
  const now = new Date(`${businessDate()}T00:00:00Z`);
  const fmt = (d) => d.toISOString().slice(0, 10);
  if (filter === 'today') return { from: `${fmt(now)} 00:00:00`, to: `${fmt(now)} 23:59:59.999999` };
  if (filter === 'yesterday') {
    const y = new Date(now); y.setUTCDate(now.getUTCDate() - 1);
    return { from: `${fmt(y)} 00:00:00`, to: `${fmt(y)} 23:59:59.999999` };
  }
  if (filter === 'week') {
    const start = new Date(now); start.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
    return { from: `${fmt(start)} 00:00:00`, to: `${fmt(now)} 23:59:59.999999` };
  }
  if (filter === 'month') {
    const start = new Date(now); start.setUTCDate(1);
    return { from: `${fmt(start)} 00:00:00`, to: `${fmt(now)} 23:59:59.999999` };
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
  const [orderType, setOrderType] = useState('');
  const [status, setStatus] = useState('');
  const [payment, setPayment] = useState('');
  const [cashier, setCashier] = useState('');
  const [cashiers, setCashiers] = useState([]);
  const [fromDate, setFromDate] = useState(businessDate());
  const [toDate, setToDate] = useState(businessDate());
  const requestSequence = useRef(0);

  useEffect(() => {
    if (user.role === 'admin') api.get('/users').then(setCashiers).catch(e => setError(e.message));
  }, [user.role]);

  const load = async () => {
    const request = ++requestSequence.current;
    setLoading(true); setError('');
    try {
      if (filter === 'custom' && (!fromDate || !toDate || fromDate > toDate)) throw new Error('Choose a valid start and end date.');
      const range = filter === 'custom' ? { from: `${fromDate} 00:00:00`, to: `${toDate} 23:59:59.999999` } : dateRangeFor(filter);
      const params = new URLSearchParams();
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);
      if (search) params.set('search', search);
      if (orderType) params.set('order_type', orderType);
      if (status) params.set('status', status);
      if (payment) params.set('payment_method', payment);
      if (cashier && user.role === 'admin') params.set('cashier_id', cashier);
      const [ords, sett] = await Promise.all([
        api.get(`/orders?${params.toString()}`),
        api.get('/settings'),
      ]);
      if (request === requestSequence.current) { setOrders(ords); setSettings(sett); }
    } catch (err) { if (request === requestSequence.current) { setError(err.message); setOrders([]); } } finally {
      if (request === requestSequence.current) setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter, orderType, status, payment, cashier, fromDate, toDate]);

  const handleSearch = (e) => { e.preventDefault(); load(); };

  const viewOrder = async (id) => {
    try { const order = await api.get(`/orders/${id}`); setSelectedOrder(order); }
    catch (err) { setError(err.message); }
  };

  return (
    <div>
      <PageHeader title={user.role === 'admin' ? 'Transaction history' : 'My transactions'} description="Every order, in one place. Find a sale or reprint a receipt." />

      {error && <div className="login-error" role="alert">{error}</div>}
      <form className="filter-row" onSubmit={handleSearch}>
        <select aria-label="Transaction period" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="all">All</option>
          <option value="custom">Custom dates</option>
        </select>
        {filter === 'custom' && <><input type="date" aria-label="Start date" value={fromDate} onChange={e => setFromDate(e.target.value)} /><input type="date" aria-label="End date" min={fromDate} value={toDate} onChange={e => setToDate(e.target.value)} /></>}
        <select aria-label="Order type filter" value={orderType} onChange={e => setOrderType(e.target.value)}><option value="">All order types</option><option value="dine_in">Dine-In</option><option value="takeout">Takeout</option><option value="unspecified">Unspecified / legacy</option></select>
        <select aria-label="Status filter" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option value="completed">Completed</option><option value="voided">Voided</option></select>
        <select aria-label="Payment filter" value={payment} onChange={e => setPayment(e.target.value)}><option value="">All payments</option><option value="cash">Cash</option><option value="gcash">GCash</option><option value="other">Other</option></select>
        {user.role === 'admin' && <select aria-label="Cashier filter" value={cashier} onChange={e => setCashier(e.target.value)}><option value="">All cashiers</option>{cashiers.map(u => <option value={u.id} key={u.id}>{u.full_name}</option>)}</select>}
        <div className="search-field">
          <Search size={16} />
          <input aria-label="Search transactions" placeholder="Search order # or product..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-outline"><Search size={16} /> Search</button>
      </form>

      <div className="card">
        <TableScroll>
          <table className="data-table">
            <thead>
              <tr><th>Order #</th><th>Date/Time</th>{user.role === 'admin' && <th>Cashier</th>}<th>Order type</th><th className="num">Total</th><th>Payment</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={user.role === 'admin' ? 8 : 7}>Loading...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={user.role === 'admin' ? 8 : 7} className="table-empty">No transactions found.</td></tr>
              ) : orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.order_number}{syncLabel(o) && <span className="cell-sub" style={{ display: 'block' }}>{syncLabel(o)}</span>}</td>
                  <td>{formatDateTime(o.created_at)}</td>
                  {user.role === 'admin' && <td>{o.cashier_name}</td>}
                  <td><span className={`order-type-badge ${o.order_type || 'unspecified'}`}>{orderTypeLabel(o.order_type)}</span>{o.customer_name && <span className="cell-sub" style={{ display: 'block' }}>{o.customer_name}</span>}</td>
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
          <DialogSurface label="Sales receipt" onClose={() => setSelectedOrder(null)} className="">
            <button className="modal-close" aria-label="Close" onClick={() => setSelectedOrder(null)}><X size={18} /></button>
            <div className="modal-body">
              <ReceiptView order={selectedOrder} settings={settings} cashierName={selectedOrder.cashier_name} />
              <div className="modal-actions" style={{ marginTop: 16 }}>
                <button className="btn btn-outline btn-block" onClick={() => window.print()}><Printer size={16} /> Print Receipt</button>
                <button className="btn btn-primary btn-block" onClick={() => setSelectedOrder(null)}><X size={16} /> Close</button>
              </div>
            </div>
          </DialogSurface>
        </div>
      )}
    </div>
  );
}
