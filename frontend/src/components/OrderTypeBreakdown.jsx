import { UtensilsCrossed, ShoppingBag } from 'lucide-react';
import { peso } from '../utils/currency';

export default function OrderTypeBreakdown({ rows }) {
  if (!Array.isArray(rows)) return null;
  const legacy = rows.find(row => row.order_type === 'unspecified');
  return <section className="card order-type-analytics" aria-label="Dine-In and Takeout analytics">
    <div className="analytics-heading"><div><p className="eyebrow">Two ways to snack</p><h3>Dine-In vs Takeout</h3></div><span>Completed orders · Today</span></div>
    <div className="order-type-metrics">
      {rows.filter(row => row.order_type !== 'unspecified').map(row => <div className={`type-metric ${row.order_type}`} key={row.order_type}>
        <div className="type-metric-title">{row.order_type === 'dine_in' ? <UtensilsCrossed size={18} /> : <ShoppingBag size={18} />}<b>{row.order_type === 'dine_in' ? 'Dine-In' : 'Takeout'}</b><span>{Number(row.percentage).toFixed(1)}%</span></div>
        <strong>{peso(row.revenue)}</strong><span>{row.orders} {Number(row.orders) === 1 ? 'order' : 'orders'}</span>
        <div className="type-share-track" role="img" aria-label={`${row.order_type === 'dine_in' ? 'Dine-In' : 'Takeout'}: ${Number(row.percentage).toFixed(1)} percent of completed orders today`}><div style={{ width: `${Math.max(0, Math.min(100, Number(row.percentage)))}%` }} /></div>
      </div>)}
    </div>
    <p className="analytics-footnote">Shares include all completed orders today. Voided transactions are excluded.</p>
    {legacy && Number(legacy.orders) > 0 && <div className="legacy-order-summary"><span>Unspecified / legacy</span><b>{legacy.orders} orders · {peso(legacy.revenue)} · {Number(legacy.percentage).toFixed(1)}%</b></div>}
  </section>;
}
