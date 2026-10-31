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
const allowedOrigins = new Set([...(process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(v=>v.trim()), 'https://localhost']);
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)) }));
app.use(express.json());
// Log path/status only. Query strings may contain a mistakenly supplied secret.
app.use(morgan((tokens,req,res)=>[tokens.method(req,res),req.path,tokens.status(req,res),tokens['response-time'](req,res)+' ms'].join(' ')));

// Serve uploaded product images (also served statically by the frontend's /public in dev,
// but this makes the API self-sufficient too, e.g. if frontend is built separately)
app.use('/images', require('./utils/productImages').serveImage, express.static(path.join(__dirname, '..', 'frontend', 'public', 'images')));

app.get('/api/health', require('./utils/asyncHandler')(async (req, res) => {
  await require('./config/db').query('SELECT 1');
  res.json({ status: 'ok', database: 'postgresql', time: new Date().toISOString() });
}));

app.use('/api/auth', authRoutes);
app.use('/api/offline', require('./routes/offline'));
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/settings', settingsRoutes);

if (process.env.SERVE_WEB === 'true') {
  const webRoot = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(webRoot));
  app.get('*', (req, res, next) => {
    if (/^\/(api|images)(\/|$)/.test(req.path)) return next();
    res.sendFile(path.join(webRoot, 'index.html'));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`Snack Time POS API listening on port ${PORT}`);
});
let closing=false;
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{
  if(closing)return;closing=true;
  server.close(()=>require('./config/db').end().then(()=>process.exit(0)).catch(()=>process.exit(1)));
  // Let active checkouts finish before the host's shutdown deadline.
  setTimeout(()=>{server.closeAllConnections();process.exit(1);},25000).unref();
});
