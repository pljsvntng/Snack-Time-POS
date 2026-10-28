require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const inventoryRoutes = require('./routes/inventory');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/users');
const reportRoutes = require('./routes/reports');
const discountRoutes = require('./routes/discounts');
const settingsRoutes = require('./routes/settings');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false })); // allow serving product images cross-origin to the frontend dev server
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use(morgan('dev'));

// Serve uploaded product images (also served statically by the frontend's /public in dev,
// but this makes the API self-sufficient too, e.g. if frontend is built separately)
app.use('/images', express.static(path.join(__dirname, '..', 'frontend', 'public', 'images')));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/settings', settingsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Foodtrip House POS API running on http://localhost:${PORT}`);
});
