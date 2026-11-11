// End-to-end order service metadata: real Express/PostgreSQL and durable SQLite.
// Every write is confined to a disposable loopback database.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { Pool, options } = require('../config/postgresql');

test('Dine-In / Takeout survive checkout, receipt, filters, analytics and offline sync', async t => {
  assert.ok(!process.env.DATABASE_URL && ['localhost', '127.0.0.1', '::1'].includes(options().host), 'Only disposable local PostgreSQL is permitted');
  const database = 'snacktime_order_types_' + Date.now();
  assert.match(database, /^snacktime_order_types_\d+$/);
  const maintenance = new Pool(options('postgres'));
  let created = false, db, pool, server, driver, store;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snacktime-order-types-'));
  try {
    await maintenance.query(`CREATE DATABASE "${database}"`); created = true;
    db = new Pool(options(database));
    await db.query(fs.readFileSync(path.join(__dirname, '../../database/schema.postgresql.sql'), 'utf8'));
    await db.query(fs.readFileSync(path.join(__dirname, '../../database/seed.sql'), 'utf8').replace(/USE foodtrip_house_pos;/, ''));
    const password = 'Isolated-order-type-test-passphrase';
    const hash = await require('bcrypt').hash(password, 4);
    await db.query("INSERT INTO users(id,role_id,full_name,username,password_hash) VALUES(1,1,'Service Admin','service-admin',$1),(2,2,'Service Cashier','service-cashier',$1)", [hash]);
    await db.query("INSERT INTO orders(order_number,user_id,subtotal,total,payment_method) VALUES('LEGACY-TEST',1,99,99,'cash')");
    await require('../utils/syncSchema').ensureSyncSchema(db);
    await require('../utils/syncSchema').ensureSyncSchema(db);
    await db.query("INSERT INTO ingredients(id,name,unit,current_stock) VALUES(10001,'Service Test Mix','g',100)");
    await db.query("INSERT INTO products(id,category_id,name,price,track_stock,stock) VALUES(10001,1,'Service Test Snack',20,1,30)");
    await db.query('INSERT INTO product_ingredients(product_id,ingredient_id,quantity_required) VALUES(10001,10001,1)');
    process.env.PG_DATABASE = database;
    process.env.JWT_SECRET = crypto.randomBytes(40).toString('hex');
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.OFFLINE_AUTH_PRIVATE_KEY = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
    pool = require('../config/db');
    const express = require('express'), app = express(); app.use(express.json());
    for (const route of ['auth', 'orders', 'reports', 'offline', 'products', 'inventory', 'users']) app.use('/api/' + route, require('../routes/' + route));
    app.use(require('../middleware/errorHandler').errorHandler);
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    async function req(route, body, token, expected = 200) {
      const response = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const json = await response.json(); assert.equal(response.status, expected, route + ': ' + (json.error || response.status)); return json;
    }
    const admin = await req('/auth/login', { username: 'service-admin', password });
    const cashier = await req('/auth/login', { username: 'service-cashier', password });
    const request = details => ({ request_id: crypto.randomUUID(), items: [{ product_id: 10001, quantity: 2, selected_option_ids: [] }], discount_id: 2, payment_method: 'cash', cash_received: 100, expected_total: 30, ...details });
    let dineIn, takeout, dineRequest;
    await t.test('migration is repeatable and historical service type remains unspecified', async () => {
      const { rows: [legacy] } = await db.query("SELECT * FROM orders WHERE order_number='LEGACY-TEST'");
      assert.equal(legacy.order_type, null); assert.equal(legacy.total, '99.00');
      await assert.rejects(db.query("UPDATE orders SET order_type='delivery' WHERE id=$1", [legacy.id]), /orders_order_type_valid/);
      await assert.rejects(db.query("UPDATE orders SET order_type='takeout',seating_reference='Table 1' WHERE id=$1", [legacy.id]), /orders_seating_type_valid/);
    });
    await t.test('Dine-In saves optional details, applies the same discount and deducts stock once', async () => {
      dineRequest = request({ orderType: 'dine_in', customerName: '  Ana  ', seatingReference: ' Front counter ', orderNotes: 'No ice\nServe together' });
      dineIn = await req('/orders', dineRequest, cashier.token, 201);
      assert.equal(dineIn.order_type, 'dine_in'); assert.equal(dineIn.customer_name, 'Ana'); assert.equal(dineIn.seating_reference, 'Front counter');
      assert.equal(dineIn.total, 30); assert.equal(dineIn.discount_amount, 10); assert.equal(dineIn.change_amount, 70);
      assert.deepEqual(await req('/orders', dineRequest, cashier.token, 201), dineIn);
      await req('/orders', { ...dineRequest, orderType: 'takeout' }, cashier.token, 409);
      const { rows: [stock] } = await db.query('SELECT stock FROM products WHERE id=10001'); assert.equal(stock.stock, 28);
      assert.equal((await db.query('SELECT current_stock FROM ingredients WHERE id=10001')).rows[0].current_stock, '98.00');
      const receipt = await req('/orders/' + dineIn.id, undefined, cashier.token); assert.equal(receipt.order_notes, 'No ice\nServe together');
    });
    await t.test('Takeout strips stale seating and invalid metadata cannot create a sale', async () => {
      takeout = await req('/orders', request({ orderType: 'takeout', customerName: 'Ben', seatingReference: 'OLD TABLE', orderNotes: 'Pack separately' }), cashier.token, 201);
      assert.equal(takeout.order_type, 'takeout'); assert.equal(takeout.seating_reference, null);
      const before = (await db.query('SELECT COUNT(*) n FROM orders')).rows[0].n;
      for (const details of [{ orderType: 'delivery' }, { orderType: {} }, { customerName: {} }, { orderNotes: 'x'.repeat(501) }, { orderType: 'dine_in', seatingReference: 'x'.repeat(41) }, { orderType: 'dine_in', order_type: 'takeout' }]) await req('/orders', request(details), cashier.token, 400);
      assert.equal((await db.query('SELECT COUNT(*) n FROM orders')).rows[0].n, before);
      const blank = await req('/orders', request({ orderType: 'dine_in' }), cashier.token, 201); assert.equal(blank.seating_reference, null);
      await db.query("UPDATE orders SET status='voided' WHERE id=$1", [blank.id]);
    });
    await t.test('real history filters combine correctly, preserve cashier scope and reject invalid values', async () => {
      assert.deepEqual((await req('/orders?order_type=dine_in&status=completed&payment_method=cash&cashier_id=2', undefined, admin.token)).map(o => o.id), [dineIn.id]);
      assert.deepEqual((await req('/orders?order_type=takeout', undefined, admin.token)).map(o => o.id), [takeout.id]);
      assert.equal((await req('/orders?order_type=unspecified', undefined, admin.token))[0].order_number, 'LEGACY-TEST');
      assert.ok((await req('/orders?cashier_id=1', undefined, cashier.token)).every(o => o.user_id === 2));
      for (const query of ['order_type=delivery', 'status=cancelled', 'payment_method=invalid', 'cashier_id=oops', 'from=2026-10-02&to=2026-10-01']) await req('/orders?' + query, undefined, admin.token, 400);
      const today = require('../utils/dates').today();
      assert.ok((await req(`/orders?from=${today}%2000:00:00&to=${today}%2023:59:59.999999`, undefined, admin.token)).length >= 3);
      for (const route of ['/reports/dashboard', '/users', '/inventory']) await req(route, undefined, cashier.token, 403);
    });
    await t.test('dashboard uses completed revenue and separates legacy orders', async () => {
      const dashboard = await req('/reports/dashboard', undefined, admin.token);
      assert.equal(dashboard.today_transactions, 3); assert.equal(Number(dashboard.today_sales), 159);
      for (const [type, revenue] of [['dine_in', 30], ['takeout', 30], ['unspecified', 99]]) {
        const row = dashboard.order_types_today.find(r => r.order_type === type); assert.equal(row.orders, 1); assert.equal(Number(row.revenue), revenue); assert.ok(Math.abs(row.percentage - 100 / 3) < .001);
      }
      assert.ok(dashboard.total_products > 0); assert.ok(Array.isArray(dashboard.daily_sales_last_30_days)); assert.ok(Array.isArray(dashboard.monthly_sales_last_6_months));
    });
    const { OfflineStore } = await import('../../frontend/src/offline/store.js');
    const { openTestDatabase } = await import('../../frontend/tests/offline/node-driver.mjs');
    const file = path.join(dir, 'orders.sqlite'), key = pair.publicKey.export({ format: 'jwk' });
    driver = openTestDatabase(file); store = new OfflineStore(driver, key); await store.initialize();
    const device = (await store.status()).deviceId;
    const auth = await req('/auth/login', { username: 'service-cashier', password, offline_device_id: device });
    const snapshot = await req('/offline/catalog', { device_id: device }, auth.token);
    await store.enroll({ password, alias: 'service-cashier', grant: auth.offline_authorization, snapshot });
    const product = (await store.catalog('products')).find(p => p.id === 10001);
    const saved = [];
    await t.test('offline receipts, details and queue survive restart for both service types', async () => {
      for (const type of ['dine_in', 'takeout']) {
        const q = request({ orderType: type, customerName: 'Offline customer', seatingReference: 'Window seat', orderNotes: 'Offline note' });
        const draft = { request_id: q.request_id, items: [{ cartItemId: 1, product, selectedOptions: [], quantity: 2 }], orderDetails: { orderType: type, seatingReference: 'Window seat', orderNotes: 'Offline note' } };
        await store.draft(draft); assert.equal((await store.draft()).orderDetails.orderType, type);
        const receipt = await store.checkout(q); saved.push({ q, receipt }); assert.equal(receipt.order_type, type); assert.equal(receipt.seating_reference, type === 'dine_in' ? 'Window seat' : null);
        assert.equal((await store.checkout(q)).id, receipt.id);
        await assert.rejects(store.checkout({ ...q, orderNotes: 'Changed receipt' }), /different sale/);
      }
      driver.close(); driver = openTestDatabase(file); store = new OfflineStore(driver, key); await store.initialize(); await store.login('service-cashier', password);
      assert.equal((await store.syncStatus()).pending, 2);
      for (const type of ['dine_in', 'takeout']) assert.equal((await store.listOrders({ localOnly: true, order_type: type })).length, 1);
      assert.equal((await store.listOrders({ localOnly: true, payment_method: 'gcash' })).length, 0);
      assert.equal((await store.order(saved[0].receipt.id)).seating_reference, 'Window seat');
    });
    await t.test('sync validates matching metadata and commits the original details exactly once', async () => {
      const rows = await store.deliveryRows();
      const altered = structuredClone(rows[0].payload); altered.receipt.order_type = 'takeout'; altered.receipt.seating_reference = null;
      await req('/offline/sales', altered, auth.offline_authorization, 400);
      for (const row of rows) {
        const ack = await req('/offline/sales', row.payload, auth.offline_authorization);
        assert.equal((await req('/offline/sales', row.payload, auth.offline_authorization)).server_order_id, ack.server_order_id);
        await store.acknowledge(row.order_id, ack);
        const receipt = await req('/orders/' + ack.server_order_id, undefined, cashier.token);
        assert.equal(receipt.order_type, row.payload.receipt.order_type); assert.equal(receipt.seating_reference, row.payload.receipt.seating_reference); assert.equal(receipt.order_notes, 'Offline note');
      }
      assert.equal((await store.syncStatus()).pending, 0);
      const dash = await req('/reports/dashboard', undefined, admin.token);
      assert.equal(dash.order_types_today.find(r => r.order_type === 'dine_in').orders, 2); assert.equal(dash.order_types_today.find(r => r.order_type === 'takeout').orders, 2);
      assert.equal(Number(dash.today_sales), 219);
      assert.equal((await db.query('SELECT stock FROM products WHERE id=10001')).rows[0].stock, 20);
    });
  } finally {
    try { driver?.close(); } catch {}
    if (server) await new Promise(resolve => server.close(resolve));
    await pool?.end(); await db?.end();
    if (created) await maintenance.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await maintenance.end();
    const target = path.resolve(dir); assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('snacktime-order-types-'));
    fs.rmSync(target, { recursive: true, force: true });
  }
});
