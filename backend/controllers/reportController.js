const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/reports/dashboard -- summary numbers + recent activity for the admin dashboard
const getDashboard = asyncHandler(async (req, res) => {
  const [[todaySummary]] = await pool.query(
    `SELECT COALESCE(SUM(total),0) AS sales, COUNT(*) AS transactions
     FROM orders WHERE DATE(created_at) = CURDATE() AND status = 'completed'`
  );

  const [[itemsSold]] = await pool.query(
    `SELECT COALESCE(SUM(oi.quantity),0) AS qty
     FROM order_items oi JOIN orders o ON oi.order_id = o.id
     WHERE DATE(o.created_at) = CURDATE() AND o.status = 'completed'`
  );

  const [[lowStockProducts]] = await pool.query(
    `SELECT COUNT(*) AS count FROM products
     WHERE deleted_at IS NULL AND track_stock = 1 AND stock <= low_stock_threshold`
  );
  const [[lowStockIngredients]] = await pool.query(
    `SELECT COUNT(*) AS count FROM ingredients WHERE current_stock <= min_stock`
  );

  const [recentTransactions] = await pool.query(
    `SELECT o.id, o.order_number, o.created_at, o.total, o.payment_method, o.status, u.full_name AS cashier_name
     FROM orders o JOIN users u ON o.user_id = u.id
     ORDER BY o.created_at DESC LIMIT 10`
  );

  const [dailySales] = await pool.query(
    `SELECT DATE(created_at) AS day, COALESCE(SUM(total),0) AS sales
     FROM orders WHERE status = 'completed' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
     GROUP BY DATE(created_at) ORDER BY day ASC`
  );

  const [bestSellers] = await pool.query(
    `SELECT oi.product_name, SUM(oi.quantity) AS qty_sold, SUM(oi.subtotal) AS revenue
     FROM order_items oi JOIN orders o ON oi.order_id = o.id
     WHERE o.status = 'completed' AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
     GROUP BY oi.product_name ORDER BY qty_sold DESC LIMIT 5`
  );

  const [salesByCategory] = await pool.query(
    `SELECT c.name AS category, COALESCE(SUM(oi.subtotal),0) AS revenue
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     JOIN products p ON oi.product_id = p.id
     JOIN categories c ON p.category_id = c.id
     WHERE o.status = 'completed' AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
     GROUP BY c.name ORDER BY revenue DESC`
  );

  const [paymentBreakdown] = await pool.query(
    `SELECT payment_method, COALESCE(SUM(total),0) AS total, COUNT(*) AS transactions
     FROM orders WHERE status = 'completed' AND DATE(created_at) = CURDATE()
     GROUP BY payment_method`
  );

  res.json({
    today_sales: todaySummary.sales,
    today_transactions: todaySummary.transactions,
    items_sold_today: itemsSold.qty,
    average_transaction: todaySummary.transactions > 0 ? todaySummary.sales / todaySummary.transactions : 0,
    low_stock_products: lowStockProducts.count,
    low_stock_ingredients: lowStockIngredients.count,
    recent_transactions: recentTransactions,
    daily_sales_last_7_days: dailySales,
    best_sellers_last_30_days: bestSellers,
    sales_by_category_last_30_days: salesByCategory,
    payment_breakdown_today: paymentBreakdown,
  });
});

// Shared helper: sales totals for an arbitrary date range
async function salesSummaryBetween(from, to) {
  const [[summary]] = await pool.query(
    `SELECT COALESCE(SUM(total),0) AS total_sales, COUNT(*) AS transactions,
            COALESCE(SUM(subtotal),0) AS gross_subtotal, COALESCE(SUM(discount_amount),0) AS total_discounts
     FROM orders WHERE status = 'completed' AND created_at BETWEEN ? AND ?`,
    [from, to]
  );
  const [[items]] = await pool.query(
    `SELECT COALESCE(SUM(oi.quantity),0) AS qty
     FROM order_items oi JOIN orders o ON oi.order_id = o.id
     WHERE o.status = 'completed' AND o.created_at BETWEEN ? AND ?`,
    [from, to]
  );
  const [byProduct] = await pool.query(
    `SELECT oi.product_name, SUM(oi.quantity) AS qty_sold, SUM(oi.subtotal) AS revenue
     FROM order_items oi JOIN orders o ON oi.order_id = o.id
     WHERE o.status = 'completed' AND o.created_at BETWEEN ? AND ?
     GROUP BY oi.product_name ORDER BY revenue DESC`,
    [from, to]
  );
  const [byCategory] = await pool.query(
    `SELECT c.name AS category, SUM(oi.quantity) AS qty_sold, SUM(oi.subtotal) AS revenue
     FROM order_items oi JOIN orders o ON oi.order_id = o.id
     JOIN products p ON oi.product_id = p.id JOIN categories c ON p.category_id = c.id
     WHERE o.status = 'completed' AND o.created_at BETWEEN ? AND ?
     GROUP BY c.name ORDER BY revenue DESC`,
    [from, to]
  );
  const [byPayment] = await pool.query(
    `SELECT payment_method, SUM(total) AS total, COUNT(*) AS transactions
     FROM orders WHERE status = 'completed' AND created_at BETWEEN ? AND ?
     GROUP BY payment_method`,
    [from, to]
  );

  return {
    total_sales: summary.total_sales,
    transactions: summary.transactions,
    gross_subtotal: summary.gross_subtotal,
    total_discounts: summary.total_discounts,
    items_sold: items.qty,
    by_product: byProduct,
    by_category: byCategory,
    by_payment_method: byPayment,
  };
}

// GET /api/reports/daily?date=YYYY-MM-DD
const getDailyReport = asyncHandler(async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const from = `${date} 00:00:00`;
  const to = `${date} 23:59:59`;
  res.json({ range: 'daily', date, ...(await salesSummaryBetween(from, to)) });
});

// GET /api/reports/weekly?date=YYYY-MM-DD  (returns the Mon-Sun week containing `date`)
const getWeeklyReport = asyncHandler(async (req, res) => {
  const base = req.query.date ? new Date(req.query.date) : new Date();
  const day = base.getDay() === 0 ? 7 : base.getDay(); // ISO: Monday=1..Sunday=7
  const monday = new Date(base);
  monday.setDate(base.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const from = `${monday.toISOString().slice(0, 10)} 00:00:00`;
  const to = `${sunday.toISOString().slice(0, 10)} 23:59:59`;
  res.json({
    range: 'weekly',
    week_start: monday.toISOString().slice(0, 10),
    week_end: sunday.toISOString().slice(0, 10),
    ...(await salesSummaryBetween(from, to)),
  });
});

// GET /api/reports/monthly?year=YYYY&month=MM
const getMonthlyReport = asyncHandler(async (req, res) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getFullYear();
  const month = Number(req.query.month) || now.getMonth() + 1;

  const from = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${lastDay} 23:59:59`;

  res.json({ range: 'monthly', year, month, ...(await salesSummaryBetween(from, to)) });
});

module.exports = { getDashboard, getDailyReport, getWeeklyReport, getMonthlyReport };
