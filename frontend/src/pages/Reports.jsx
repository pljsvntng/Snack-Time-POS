import { useEffect, useState } from 'react';
import { Printer, Banknote, ReceiptText, Package, Tag } from 'lucide-react';
import { api } from '../services/api';
import { peso } from '../utils/currency';

export default function Reports() {
  const [range, setRange] = useState('daily');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      let data;
      if (range === 'daily') data = await api.get(`/reports/daily?date=${date}`);
      else if (range === 'weekly') data = await api.get(`/reports/weekly?date=${date}`);
      else data = await api.get(`/reports/monthly?year=${date.slice(0, 4)}&month=${date.slice(5, 7)}`);
      setReport(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [range, date]);

  const handlePrint = () => window.print();

  return (
    <div>
      <div className="page-header">
        <h2>Sales Reports</h2>
        <button className="btn btn-outline" onClick={handlePrint}><Printer size={16} /> Print / Export</button>
      </div>

      <div className="filter-row">
        <select value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {loading || !report ? (
        <div className="empty-state">Loading report...</div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="card stat-card">
              <div>
                <div className="label">Total Sales</div>
                <div className="value accent">{peso(report.total_sales)}</div>
              </div>
              <span className="stat-icon primary"><Banknote size={20} /></span>
            </div>
            <div className="card stat-card">
              <div>
                <div className="label">Transactions</div>
                <div className="value">{report.transactions}</div>
              </div>
              <span className="stat-icon "><ReceiptText size={20} /></span>
            </div>
            <div className="card stat-card">
              <div>
                <div className="label">Items Sold</div>
                <div className="value">{report.items_sold}</div>
              </div>
              <span className="stat-icon "><Package size={20} /></span>
            </div>
            <div className="card stat-card">
              <div>
                <div className="label">Total Discounts</div>
                <div className="value">{peso(report.total_discounts)}</div>
              </div>
              <span className="stat-icon "><Tag size={20} /></span>
            </div>
          </div>

          <div className="dash-grid">
            <div className="card">
              <div className="section-title">Product Sales</div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Product</th><th className="num">Qty Sold</th><th className="num">Revenue</th></tr></thead>
                  <tbody>
                    {report.by_product.length === 0 ? (
                      <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No sales in this period.</td></tr>
                    ) : report.by_product.map((p) => (
                      <tr key={p.product_name}>
                        <td>{p.product_name}</td>
                        <td className="num">{p.qty_sold}</td>
                        <td className="num">{peso(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="section-title">Category Sales</div>
              {report.by_category.map((c) => (
                <div key={c.category} className="summary-row">
                  <span>{c.category}</span>
                  <span>{peso(c.revenue)}</span>
                </div>
              ))}

              <div className="section-title" style={{ marginTop: 18 }}>Payment Methods</div>
              {report.by_payment_method.map((p) => (
                <div key={p.payment_method} className="summary-row">
                  <span style={{ textTransform: 'capitalize' }}>{p.payment_method}</span>
                  <span>{peso(p.total)} ({p.transactions})</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
