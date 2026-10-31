import TableScroll from '../components/TableScroll';
import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Banknote, ReceiptText, Package, TrendingUp, Award, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import useMediaQuery from '../hooks/useMediaQuery';
import { peso, formatDateTime } from '../utils/currency';

const COLORS = ['#C2540A', '#F2A33A', '#2E7D32', '#6B4A2F', '#D9A066', '#8B8176', '#BF3B2B'];
const GRID = '#E8DCC9';
const AXIS = { fontSize: 12, fill: '#675F56' };
// Presentation only: shows the API's ISO date as e.g. "Oct 17" (the data itself is unchanged).
const shortDay = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

export default function Dashboard() {
  const compact = useMediaQuery('(max-width: 759px)');
  const tooltipLayout = { position: compact ? { x: 0, y: 0 } : undefined, wrapperStyle: { maxWidth: '100%' }, contentStyle: { whiteSpace: 'normal' } };
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/reports/dashboard').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="empty-state">{error}</div>;
  if (!data) return <div className="empty-state">Loading dashboard...</div>;

  return (
    <div>
      <div className="page-header"><h2>Dashboard</h2></div>

      <div className="stat-grid stat-grid-six">
        <div className="card stat-card">
          <div>
            <div className="label">Today's Sales</div>
            <div className="value accent">{peso(data.today_sales)}</div>
          </div>
          <span className="stat-icon primary"><Banknote size={20} /></span>
        </div>
        <div className="card stat-card">
          <div>
            <div className="label">Today's Orders</div>
            <div className="value">{data.today_transactions}</div>
          </div>
          <span className="stat-icon"><ReceiptText size={20} /></span>
        </div>
        <div className="card stat-card">
          <div>
            <div className="label">Items Sold</div>
            <div className="value">{data.items_sold_today}</div>
          </div>
          <span className="stat-icon"><Package size={20} /></span>
        </div>
        <div className="card stat-card">
          <div>
            <div className="label">Average Order</div>
            <div className="value">{peso(data.average_transaction)}</div>
          </div>
          <span className="stat-icon"><TrendingUp size={20} /></span>
        </div>
        <div className="card stat-card">
          <div>
            <div className="label">Best Selling Product</div>
            <div className="value" style={{ fontSize: 16, lineHeight: 1.3 }}>
              {data.best_sellers_last_30_days[0]?.product_name || '—'}
            </div>
          </div>
          <span className="stat-icon"><Award size={20} /></span>
        </div>
        <div className="card stat-card">
          <div>
            <div className="label">Low Stock Items</div>
            <div className="value" style={{ color: (data.low_stock_products + data.low_stock_ingredients) > 0 ? 'var(--danger)' : undefined }}>
              {data.low_stock_products + data.low_stock_ingredients}
            </div>
          </div>
          <span className={`stat-icon ${(data.low_stock_products + data.low_stock_ingredients) > 0 ? 'danger' : ''}`}><AlertTriangle size={20} /></span>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="section-title">Sales — Last 7 Days</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.daily_sales_last_7_days.map(row => ({ ...row, sales: Number(row.sales) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="day" tick={AXIS} tickFormatter={shortDay} />
              <YAxis tick={AXIS} />
              <Tooltip {...tooltipLayout} formatter={(v) => peso(v)} labelFormatter={shortDay} />
              <Line type="monotone" dataKey="sales" stroke="#C2540A" strokeWidth={2.5} dot={{ r: 3.5 }} />
            </LineChart>
          </ResponsiveContainer>

          <div className="section-title" style={{ marginTop: 20 }}>Best Sellers (30 days)</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.best_sellers_last_30_days.map(row => ({ ...row, qty_sold: Number(row.qty_sold) }))} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis type="number" tick={AXIS} />
              <YAxis type="category" dataKey="product_name" width={140} tick={{ ...AXIS, fontSize: 11.5 }} />
              <Tooltip {...tooltipLayout} formatter={(v) => v} />
              <Bar dataKey="qty_sold" fill="#F2A33A" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="section-title">Sales by Category (30 days)</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data.sales_by_category_last_30_days.map(row => ({ ...row, revenue: Number(row.revenue) }))} dataKey="revenue" nameKey="category" outerRadius={80}>
                {data.sales_by_category_last_30_days.map((entry, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipLayout} formatter={(v) => peso(v)} />
              <Legend wrapperStyle={{ fontSize: 11.5 }} formatter={(v) => <span style={{ color: '#2A2623' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>

          <div className="section-title" style={{ marginTop: 16 }}>Payment Methods Today</div>
          {data.payment_breakdown_today.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>No transactions yet today.</p>
          ) : (
            data.payment_breakdown_today.map((p) => (
              <div key={p.payment_method} className="summary-row">
                <span style={{ textTransform: 'capitalize' }}>{p.payment_method}</span>
                <span>{peso(p.total)} ({p.transactions})</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="section-title">Recent Transactions</div>
        <TableScroll>
          <table className="data-table">
            <thead>
              <tr><th>Order #</th><th>Date/Time</th><th>Cashier</th><th className="num">Total</th><th>Payment</th><th>Status</th></tr>
            </thead>
            <tbody>
              {data.recent_transactions.map((t) => (
                <tr key={t.id}>
                  <td>{t.order_number}</td>
                  <td>{formatDateTime(t.created_at)}</td>
                  <td>{t.cashier_name}</td>
                  <td className="num">{peso(t.total)}</td>
                  <td style={{ textTransform: 'capitalize' }}>{t.payment_method}</td>
                  <td><span className={`badge badge-${t.status}`}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </div>
    </div>
  );
}
