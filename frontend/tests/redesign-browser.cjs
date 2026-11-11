// Real browser/API acceptance. All writes go to a disposable local PostgreSQL database.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const { Pool, options } = require('../../backend/config/postgresql');
const site = 'http://127.0.0.1:15185';
const artifacts = path.join(root, 'database/backups/ui-redesign');
const database = 'snacktime_ui_test_' + Date.now();
const sizes = [[320, 640], [360, 800], [393, 852], [600, 960], [768, 1024], [800, 1280], [1024, 768], [1280, 800], [852, 393], [1440, 900], [1920, 1080]];
const routes = ['dashboard', 'products', 'inventory', 'transactions', 'reports', 'users', 'settings'];
const password = 'Isolated-UI-test-passphrase';
let maintenance, db, apiServer, vite, browser, created = false;
const errors = [], warnings = [], result = [];

async function contained(page, label) {
  const dims = await page.evaluate(() => {
    const p = document.querySelector('.page-body');
    return { width: innerWidth, document: document.documentElement.scrollWidth, page: p?.scrollWidth, client: p?.clientWidth };
  });
  assert.ok(dims.document <= dims.width + 1, `${label}: document overflow ${JSON.stringify(dims)}`);
  assert.ok(!dims.page || dims.page <= dims.client + 1, `${label}: content overflow ${JSON.stringify(dims)}`);
}
async function reachable(locator) {
  await locator.scrollIntoViewIfNeeded();
  assert.ok(await locator.evaluate(e => { const r = e.getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1; }), 'Control is outside viewport');
}
async function login(page, username = 'ui-admin') {
  await page.goto(site + '/login');
  await page.locator('#username').waitFor();
  await page.locator('.store-photo img').evaluate(img => img.decode());
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'SIGN IN', exact: true }).click();
  await page.waitForURL(username === 'ui-admin' ? '**/dashboard' : '**/pos');
}
async function openRoute(page, route) {
  const tabs = page.locator('.mobile-bottom-nav');
  if (await tabs.isVisible()) {
    const direct = tabs.locator(`a[href="/${route}"]`);
    if (await direct.count()) await direct.click();
    else {
      await tabs.getByRole('button', { name: 'More', exact: true }).click();
      await page.locator(`.mobile-more-sheet a[href="/${route}"]`).click();
    }
  } else await page.locator(`.workspace-top-nav a[href="/${route}"]`).click();
  await page.waitForURL('**/' + route);
  const ready = route === 'dashboard' || route === 'reports' ? '.stat-card' : route === 'settings' ? '.settings-form-card' : route === 'pos' ? '.product-card' : '.data-table';
  await page.locator(ready).first().waitFor();
}
async function verifyCompactCart(page) {
  const output = path.join(root, 'database/backups/compact-cart');
  fs.mkdirSync(output, { recursive: true });
  await login(page);
  await openRoute(page, 'pos');
  for (let index = 0; index < 6; index++) {
    await page.locator('.product-card:not(.unavailable)').nth(index).click();
    if (await page.locator('.customization-modal').count()) {
      const groups = page.locator('.option-group');
      for (let i = 0; i < await groups.count(); i++) await groups.nth(i).locator('.option-choice:not(.disabled)').first().click();
      await page.getByRole('button', { name: /Add to Order/ }).click();
    }
  }
  assert.equal(await page.locator('.cart-item').count(), 6);
  assert.equal(await page.locator('.order-notes-control').getAttribute('open'), null);
  const discountOptions = await page.locator('#order-discount option').allTextContents();
  assert.ok(discountOptions.length > 1);
  assert.ok(discountOptions.some(label => label.includes('Senior Citizen / PWD')), 'Senior Citizen / PWD discount remains available');
  const measurements = [];
  for (const [width, height] of [[1440, 900], [1280, 600], [1024, 600], [768, 1024], [393, 852], [360, 640], [320, 568], [852, 393]]) {
    await page.setViewportSize({ width, height });
    const drawer = width < 760 || (width < 1200 && height < 560);
    if (drawer && !(await page.locator('.cart-panel').getAttribute('class')).includes('open')) await page.locator('.cart-fab').click();
    await page.locator('.cart-panel').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Dine-In', exact: true }).click();
    await page.locator('#order-customer').fill('Customer with a longer name');
    await page.locator('#order-seating').fill('Window seat');
    await page.locator('#order-discount').selectOption({ index: 1 });
    const measure = async () => page.evaluate(() => {
      const panel = document.querySelector('.cart-panel'), list = panel.querySelector('.cart-items'), footer = panel.querySelector('.cart-summary'), header = panel.querySelector('.order-setup');
      const rect = e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; };
      return { panel: rect(panel), list: rect(list), footer: rect(footer), setup: rect(header), overflow: panel.scrollHeight - panel.clientHeight, horizontal: panel.scrollWidth - panel.clientWidth, documentOverflow: document.documentElement.scrollWidth - innerWidth, listScrollHeight: list.scrollHeight, listClientHeight: list.clientHeight, panelScroll: panel.scrollTop, footerScroll: footer.scrollTop, visibleItems: [...list.querySelectorAll('.cart-item')].filter(e => { const r=e.getBoundingClientRect(),l=list.getBoundingClientRect();return r.top>=l.top-1&&r.bottom<=l.bottom+1; }).length };
    });
    await page.locator('.cart-items').evaluate(e => { e.scrollTop = 0; });
    const before = await measure();
    assert.ok(before.overflow <= 1, `Panel does not scroll at ${width}x${height}: ${JSON.stringify(before)}`);
    assert.ok(before.horizontal <= 1 && before.documentOverflow <= 1, 'No horizontal overflow');
    assert.ok(before.list.height >= 80, `Usable product viewport at ${width}x${height}: ${JSON.stringify(before)}`);
    assert.ok(before.list.bottom <= before.footer.top + 1, 'Footer never overlaps products');
    assert.ok(before.footer.bottom <= before.panel.bottom + 1 && before.footer.bottom <= height + 1, 'Footer stays in viewport');
    assert.ok(before.listScrollHeight > before.listClientHeight, 'Multiple products overflow only their list');
    if (height >= 640) assert.ok(before.visibleItems >= 2, `At least two complete products immediately visible at ${width}x${height}`);
    await page.locator('.cart-items').evaluate(e => { e.scrollTop = e.scrollHeight; });
    const after = await measure();
    assert.ok(Math.abs(after.footer.top - before.footer.top) < 1 && Math.abs(after.setup.top - before.setup.top) < 1, 'Scrolling products leaves customer controls and footer fixed');
    assert.equal(after.panelScroll, 0); assert.equal(after.footerScroll, 0);
    await page.locator('.order-notes-control summary').click();
    await page.locator('#order-notes').fill('Pack the drinks separately.');
    const expanded = await measure();
    assert.ok(expanded.overflow <= 1 && expanded.list.height >= 40, `Expanded notes preserve the footer and product space at ${width}x${height}: ${JSON.stringify(expanded)}`);
    await page.locator('.order-notes-control summary').click();
    assert.deepEqual(await page.locator('#order-discount option').allTextContents(), discountOptions, 'Every original discount remains available');
    await page.locator('.cart-items').evaluate(e => { e.scrollTop = 0; });
    await page.screenshot({ path: path.join(output, `cart-${width}x${height}.png`) });
    measurements.push({ width, height, ...before });
    console.log(`PASS compact cart ${width}x${height}: independent products, fixed footer, customer fields, notes and discounts`);
    if (drawer) await page.locator('.cart-close').click();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const first = page.locator('.cart-item').first();
  await first.getByRole('button', { name: 'Increase quantity' }).click();
  assert.equal(await first.locator('.qty-value').textContent(), '2');
  await first.getByRole('button', { name: 'Decrease quantity' }).click();
  assert.equal(await first.locator('.qty-value').textContent(), '1');
  await first.getByRole('button', { name: /^Remove / }).click();
  assert.equal(await page.locator('.cart-item').count(), 5);
  const amount = text => Number(text.replace(/[^0-9.]/g, ''));
  const subtotal = amount(await page.locator('.summary-row').nth(0).locator('span').last().textContent());
  const reduction = amount(await page.locator('.summary-row').nth(1).locator('span').last().textContent());
  const total = amount(await page.locator('.summary-row.total span').last().textContent());
  assert.equal(Math.round((subtotal - reduction) * 100), Math.round(total * 100));
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ measurements, discountOptions, quantityAndRemoval: true, totals: true, runtimeErrors: errors }, null, 2));
}
async function verifyLoginDesign(page) {
  const output = path.join(root, 'database/backups/login-redesign');
  fs.mkdirSync(output, { recursive: true });
  const layouts = [[936, 527], [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [768, 1024], [900, 1200], [320, 640], [360, 800], [393, 852], [412, 915], [852, 393]];
  const layoutResults = [];
  let requests = 0;
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/auth/login')) requests++; });
  await page.goto(site + '/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#username').waitFor();
  assert.equal(await page.locator('#username').evaluate(e => e === document.activeElement), true, 'Desktop username autofocus');
  await page.locator('.store-photo img').evaluate(img => img.decode());
  await page.evaluate(() => document.fonts.ready);
  for (const [width, height] of layouts) {
    await page.setViewportSize({ width, height });
    await page.locator('#username').evaluate(e => e.blur());
    await contained(page, `login ${width}x${height}`);
    await reachable(page.getByRole('button', { name: 'SIGN IN', exact: true }));
    const dims = await page.evaluate(() => {
      const hero = document.querySelector('.login-hero'), panel = document.querySelector('.login-form-panel'), img = document.querySelector('.store-photo img');
      return { imageRatio: hero.getBoundingClientRect().width / innerWidth, imageHeight: hero.getBoundingClientRect().height, panelBackground: getComputedStyle(panel).backgroundColor, imageLoaded: img.complete && img.naturalWidth > 0, fit: getComputedStyle(img).objectFit, inputs: [...document.querySelectorAll('.login-form input')].map(e => e.getBoundingClientRect().height) };
    });
    assert.ok(dims.imageLoaded); assert.equal(dims.fit, 'cover'); assert.equal(dims.panelBackground, 'rgb(255, 249, 242)');
    assert.ok(dims.inputs.every(height => height >= 44));
    if (width >= 1440) { assert.ok(Math.abs(dims.imageRatio - .58) < .01); assert.ok(dims.imageHeight >= height); }
    assert.equal(await page.getByText('Forgot password?', { exact: true }).count(), 0, 'No unsupported recovery link');
    assert.equal(await page.getByRole('checkbox').count(), 0, 'No unsupported Remember Me control');
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, `login-${width}x${height}.png`), fullPage: true });
    layoutResults.push({ width, height, overflow: false, ...dims });
    console.log(`PASS login layout ${width}x${height}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'SIGN IN', exact: true }).click();
  assert.equal(requests, 0, 'Required-field validation prevents an empty login');
  await page.locator('#username').fill('ui-admin');
  await page.locator('#password').fill('incorrect-password');
  await page.locator('#username').focus(); await page.keyboard.press('Tab');
  assert.equal(await page.locator('#password').evaluate(e => e === document.activeElement), true);
  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('button', { name: 'Show password' }).evaluate(e => e === document.activeElement), true, 'Visibility toggle is in keyboard order');
  await page.keyboard.press('Space'); assert.equal(await page.locator('#password').getAttribute('type'), 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await page.locator('#password').press('Enter'); await page.locator('#login-error').waitFor();
  assert.ok((await page.locator('#login-error').innerText()).includes('Invalid username or password'));
  assert.equal(await page.locator('#login-error').evaluate(e => e === document.activeElement), true, 'Error receives focus');
  await page.route('**/api/auth/login', route => route.abort('failed'));
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'SIGN IN', exact: true }).click();
  await page.locator('#login-error').waitFor();
  assert.ok((await page.locator('#login-error').innerText()).includes('Cannot reach the POS server'));
  await page.unroute('**/api/auth/login');
  let release, intercepted;
  const hold = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { intercepted = resolve; });
  await page.route('**/api/auth/login', async route => { intercepted(); await hold; await route.continue(); });
  await page.locator('#username').fill('ui-admin@test.invalid');
  await page.getByRole('button', { name: 'SIGN IN', exact: true }).click(); await started;
  const count = requests;
  assert.equal(await page.getByRole('button', { name: 'Signing in…', exact: true }).isDisabled(), true);
  assert.equal(await page.locator('.login-form').getAttribute('aria-busy'), 'true');
  await page.evaluate(() => { const form = document.querySelector('.login-form'); form.requestSubmit(); form.requestSubmit(); });
  await page.waitForTimeout(150);
  assert.equal(requests, count, 'Repeated submit does not send duplicate sign-ins');
  release(); await page.waitForURL('**/dashboard'); await page.unroute('**/api/auth/login');
  await page.reload(); await page.locator('.stat-card').first().waitFor();
  assert.ok(await page.evaluate(() => Boolean(localStorage.getItem('fh_token'))));
  assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes(password), 'No password stored in localStorage');
  await page.getByRole('button', { name: 'Log out', exact: true }).click(); await page.waitForURL('**/login');
  await page.setViewportSize({ width: 393, height: 852 });
  await login(page, 'ui-cashier'); await page.locator('.mobile-bottom-nav').waitFor();
  await page.goto(site + '/dashboard'); await page.waitForURL('**/pos');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click(); await page.waitForURL('**/login');
  assert.equal(await page.evaluate(() => localStorage.getItem('fh_token')), null);
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ layouts: layoutResults, runtimeErrors: errors, validAdminEmail: true, validCashierUsername: true, retainedSession: true, logout: true, requiredValidation: true, passwordToggle: true, invalidCredentials: true, networkFeedback: true, duplicateSubmissionGuard: true }, null, 2));
  console.log('PASS administrator email and cashier username authentication, role routing, session/reload, logout, validation, errors, keyboard, password visibility and duplicate submission guard');
}
async function run() {
  assert.ok(!process.env.DATABASE_URL, 'UI tests require local PostgreSQL');
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(options().host), 'Never write UI fixtures to cloud PostgreSQL');
  assert.match(database, /^snacktime_ui_test_\d+$/);
  maintenance = new Pool(options(process.env.PG_ADMIN_DATABASE || 'postgres'));
  await maintenance.query(`CREATE DATABASE "${database}"`); created = true;
  db = new Pool(options(database));
  await db.query(fs.readFileSync(path.join(root, 'database/schema.postgresql.sql'), 'utf8'));
  await require('../../backend/utils/syncSchema').ensureSyncSchema(db);
  await db.query(fs.readFileSync(path.join(root, 'database/seed.sql'), 'utf8').replace(/USE foodtrip_house_pos;/, ''));
  const hash = await require('../../backend/node_modules/bcrypt').hash(password, 4);
  await db.query("INSERT INTO users(id,role_id,full_name,username,email,password_hash,active) VALUES (1,1,'UI Administrator','ui-admin','ui-admin@test.invalid',$1,1),(2,2,'UI Cashier','ui-cashier','ui-cashier@test.invalid',$1,1)", [hash]);
  process.env.PG_DATABASE = database;
  process.env.JWT_SECRET = crypto.randomBytes(40).toString('hex');
  if (process.argv.includes('--offline-only')) {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(__dirname, 'offline-browser.cjs')], { cwd: path.join(root, 'frontend'), env: { ...process.env, TEST_ADMIN_USER: 'ui-admin', TEST_ADMIN_PASSWORD: password, TEST_CASHIER_PASSWORD: password }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
      child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error('Isolated offline UI acceptance failed.')));
    });
    return;
  }
  const express = require('../../backend/node_modules/express');
  const app = express();
  app.use(require('../../backend/node_modules/cors')({ origin: site }));
  app.use(express.json());
  app.use('/images', express.static(path.join(root, 'frontend/public/images')));
  for (const route of ['offline', 'auth', 'categories', 'products', 'inventory', 'orders', 'users', 'reports', 'discounts', 'settings']) app.use('/api/' + route, require('../../backend/routes/' + route));
  app.use(require('../../backend/middleware/errorHandler').errorHandler);
  apiServer = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const api = `http://127.0.0.1:${apiServer.address().port}/api`;
  vite = spawn(process.execPath, [path.join(root, 'frontend/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '15185', '--strictPort'], { cwd: path.join(root, 'frontend'), env: { ...process.env, VITE_API_URL: api }, windowsHide: true, stdio: 'ignore' });
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(site)).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 200)); }
  assert.ok(ready, 'Vite started');
  fs.mkdirSync(artifacts, { recursive: true });
  browser = await chromium.launch({ headless: true, executablePath: process.env.TEST_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(120000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error' || msg.type() === 'warning') warnings.push(msg.text()); });
  if (process.argv.includes('--login-only')) { await verifyLoginDesign(page); return; }
  if (process.argv.includes('--cart-only')) { await verifyCompactCart(page); return; }
  await page.goto(site + '/login');
  await page.locator('.store-photo img').evaluate(img => img.decode());
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(artifacts, 'login-desktop.png'), fullPage: true });
  await page.locator('#username').fill('ui-admin');
  await page.locator('#password').fill('incorrect-password');
  await page.getByRole('button', { name: 'Show password' }).click();
  assert.equal(await page.locator('#password').getAttribute('type'), 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await page.getByRole('button', { name: 'SIGN IN', exact: true }).click();
  await page.locator('.login-error').waitFor();
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'SIGN IN', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await openRoute(page, 'pos');
  const menuCount = await page.locator('.product-card').count();
  await page.getByRole('textbox', { name: 'Search products', exact: true }).fill('no-such-snack');
  await page.getByText('No food found', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Clear product search' }).click();
  assert.equal(await page.locator('.product-card').count(), menuCount);
  await page.locator('.category-tab').nth(1).click();
  assert.ok(await page.locator('.product-card').count() < menuCount);
  await page.getByRole('button', { name: 'All items', exact: true }).click();
  await page.locator('.product-card:not(.unavailable)').first().click();
  if (await page.locator('.customization-modal').count()) {
    const groups = page.locator('.option-group');
    for (let i = 0; i < await groups.count(); i++) await groups.nth(i).locator('.option-choice:not(.disabled)').first().click();
    await page.getByRole('button', { name: /Add to Order/ }).click();
  }
  await page.locator('.cart-item').waitFor();
  assert.equal(await page.locator('.product-card.is-selected').count(), 1);
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  assert.equal(await page.locator('.cart-item .qty-value').textContent(), '2');
  await page.getByRole('button', { name: 'Decrease quantity' }).click();
  if (await page.locator('#order-discount option').count() > 1) await page.locator('#order-discount').selectOption({ index: 1 });
  const money = text => Number(text.replace(/[^0-9.]/g, ''));
  const total = money(await page.locator('.summary-row.total span').last().textContent());
  await page.getByRole('button', { name: 'Dine-In', exact: true }).click();
  await page.locator('#order-customer').fill('Ana');
  await page.locator('#order-seating').fill('Window seat');
  await page.locator('.order-notes-control summary').click();
  await page.locator('#order-notes').fill('Serve together');
  await page.getByRole('button', { name: 'Takeout', exact: true }).click();
  assert.equal(await page.locator('#order-seating').count(), 0);
  assert.equal(money(await page.locator('.summary-row.total span').last().textContent()), total);
  assert.equal(await page.locator('.cart-item').count(), 1);
  await page.getByRole('button', { name: 'Dine-In', exact: true }).click();
  assert.equal(await page.locator('#order-seating').inputValue(), '');
  await page.locator('#order-seating').fill('Window seat');
  await page.screenshot({ path: path.join(artifacts, 'pos-desktop.png') });
  await page.getByRole('button', { name: /Process Transaction/ }).click();
  await page.locator('#cash-received').fill('0');
  await page.getByRole('button', { name: 'Confirm Payment' }).click();
  assert.ok(await page.locator('.payment-modal .login-error').first().isVisible());
  await page.locator('#cash-received').fill(String(total + 100));
  assert.equal(money(await page.locator('.change-display .amount').textContent()), 100);
  await page.screenshot({ path: path.join(artifacts, 'payment-desktop.png') });
  await page.getByRole('button', { name: 'Confirm Payment' }).click();
  await page.locator('.receipt').waitFor();
  const { rows: [saved] } = await db.query('SELECT * FROM orders');
  assert.equal(Number(saved.total), total);
  assert.equal(Number(saved.change_amount), 100);
  assert.equal(saved.order_type, 'dine_in');
  assert.equal(saved.seating_reference, 'Window seat');
  assert.equal(saved.customer_name, 'Ana');
  assert.ok((await page.locator('.receipt').textContent()).includes('DINE-IN'));
  assert.ok((await page.locator('.receipt').textContent()).includes('Window seat'));
  assert.equal(await page.locator('.receipt .brand-mark').count(), 1);
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(artifacts, 'receipt.pdf'), width: '80mm', height: '230mm' });
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: 'New Order' }).click();
  assert.equal(await page.locator('.cart-item').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Takeout', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.locator('.product-card:not(.unavailable)').first().click();
  if (await page.locator('.customization-modal').count()) {
    const groups = page.locator('.option-group');
    for (let i = 0; i < await groups.count(); i++) await groups.nth(i).locator('.option-choice:not(.disabled)').first().click();
    await page.getByRole('button', { name: /Add to Order/ }).click();
  }
  await page.getByRole('button', { name: 'Dine-In', exact: true }).click();
  await page.locator('#order-seating').fill('Obsolete seating');
  await page.getByRole('button', { name: 'Takeout', exact: true }).click();
  await page.locator('#order-customer').fill('Ben');
  await page.getByRole('button', { name: /Process Transaction/ }).click();
  await page.getByRole('button', { name: 'GCash', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Payment' }).click();
  await page.locator('.receipt').waitFor();
  assert.ok((await page.locator('.receipt').textContent()).includes('TAKEOUT'));
  assert.ok(!(await page.locator('.receipt').textContent()).includes('Obsolete seating'));
  const { rows: [second] } = await db.query('SELECT * FROM orders WHERE id<>$1', [saved.id]);
  assert.equal(second.order_type, 'takeout'); assert.equal(second.seating_reference, null); assert.equal(second.payment_method, 'gcash');
  await page.getByRole('button', { name: 'New Order' }).click();
  await openRoute(page, 'dashboard');
  assert.equal(await page.locator('.stat-card').filter({ hasText: 'Dine-In Orders' }).locator('.value').textContent(), '1');
  assert.equal(await page.locator('.stat-card').filter({ hasText: 'Takeout Orders' }).locator('.value').textContent(), '1');
  assert.equal(await page.locator('.type-metric.dine_in .type-metric-title > span').textContent(), '50.0%');
  await page.getByRole('combobox', { name: 'Revenue chart period' }).selectOption('month');
  await page.getByRole('combobox', { name: 'Revenue chart period' }).selectOption('halfyear');
  await page.getByRole('combobox', { name: 'Revenue chart period' }).selectOption('week');
  await openRoute(page, 'transactions');
  for (const type of ['dine_in', 'takeout']) {
    const response = page.waitForResponse(r => r.url().includes('/orders?') && r.url().includes('order_type=' + type));
    await page.getByRole('combobox', { name: 'Order type filter' }).selectOption(type);
    await response;
    await page.waitForFunction(() => !document.querySelector('.data-table tbody')?.textContent.includes('Loading...'));
    assert.equal(await page.locator('.data-table tbody .order-type-badge.' + type).count(), 1);
    await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.locator('.receipt').waitFor();
    assert.ok((await page.locator('.receipt').textContent()).includes(type === 'dine_in' ? 'DINE-IN' : 'TAKEOUT'));
    await page.locator('.modal-close').click();
  }
  const state = await page.context().storageState();
  console.log('PASS Dine-In and Takeout checkout, switching, seating cleanup, receipts, dashboard counts/shares and real history filters');
  for (const [width, height] of sizes) {
    const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, storageState: state });
    const p = await ctx.newPage(); p.setDefaultTimeout(60000); p.setDefaultNavigationTimeout(120000); p.on('pageerror', e => errors.push(e.message));
    await p.goto(site + '/pos'); await p.locator('.product-card').first().waitFor();
    await contained(p, `${width} POS`);
    const drawer = width < 760 || (width < 1200 && height < 560);
    assert.equal(await p.locator('.cart-fab').isVisible(), drawer);
    assert.ok(await p.locator('.product-grid').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length >= 2));
    if (width >= 1200) {
      assert.equal(await p.locator('.product-grid').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length), 4, 'Four desktop menu columns');
      const ratio = await p.evaluate(() => { const menu = document.querySelector('.pos-menu').getBoundingClientRect().width, panel = document.querySelector('.cart-panel').getBoundingClientRect().width; return panel / (menu + panel); });
      assert.ok(ratio >= .30 && ratio <= .35, 'Desktop order panel uses 30–35% of workspace');
      await p.locator('.workspace-top-nav').waitFor();
    }
    if (drawer) { await p.locator('.cart-fab').click(); await reachable(p.locator('.checkout-btn')); await p.locator('.cart-close').click(); }
    for (const route of routes) {
      await openRoute(p, route); await contained(p, `${width} ${route}`);
      if (route === 'products' || route === 'users' || route === 'inventory') {
        const name = route === 'products' ? 'Add Product' : route === 'users' ? 'Add User' : 'Add Ingredient';
        await p.getByRole('button', { name, exact: true }).click();
        const dialog = p.getByRole('dialog', { name, exact: true });
        await dialog.waitFor(); await reachable(dialog.locator('button[type="submit"]'));
        await p.keyboard.press('Tab');
        assert.ok(await dialog.evaluate(e => e.contains(document.activeElement)), 'Dialog retains keyboard focus');
        await p.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      }
      if (route === 'settings') await reachable(p.getByRole('button', { name: 'Save Settings' }));
      if ([393, 1440].includes(width) && ['dashboard', 'products', 'settings'].includes(route)) await p.screenshot({ path: path.join(artifacts, `${route}-${width}.png`) });
    }
    await p.goto(site + '/login'); // authenticated sessions redirect; clear only this disposable browser context
    await ctx.clearCookies(); await p.evaluate(() => localStorage.clear()); await p.goto(site + '/login');
    await contained(p, `${width} login`); await reachable(p.getByRole('button', { name: 'SIGN IN', exact: true }));
    if (width === 393) await p.screenshot({ path: path.join(artifacts, 'login-mobile.png'), fullPage: true });
    result.push({ width, height, routes: routes.length + 1, cart: drawer ? 'sheet' : 'panel', overflow: false });
    console.log(`PASS ${width}x${height}: all screens, dialogs, navigation and login`);
    await ctx.close();
  }
  const cashier = await browser.newPage({ viewport: { width: 393, height: 852 } });
  cashier.setDefaultTimeout(60000); cashier.setDefaultNavigationTimeout(120000);
  await login(cashier, 'ui-cashier');
  await cashier.locator('.mobile-bottom-nav').waitFor();
  assert.deepEqual(await cashier.locator('.mobile-bottom-nav a').allTextContents(), ['POS', 'History']);
  for (const [width, height] of [[393, 852], [768, 1024], [1440, 900]]) {
    await cashier.setViewportSize({ width, height });
    await contained(cashier, 'cashier ' + width);
    if (width === 1440) { await cashier.locator('.workspace-top-nav').waitFor(); assert.equal(await cashier.locator('.sidebar').isVisible(), false); }
    await cashier.screenshot({ path: path.join(artifacts, `cashier-${width}.png`) });
  }
  await cashier.setViewportSize({ width: 393, height: 852 });
  await cashier.goto(site + '/users'); await cashier.waitForURL('**/pos');
  await cashier.getByRole('button', { name: 'More', exact: true }).click();
  await cashier.getByRole('button', { name: 'Log out', exact: true }).click(); await cashier.waitForURL('**/login');
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify({ result, runtimeErrors: errors, consoleMessages: warnings, checkout: 'passed; disposable local database' }, null, 2));
  console.log('PASS cashier permissions, logout and no JavaScript runtime errors');
}
run().catch(error => { console.error(require('./safe-error.cjs')(error)); process.exitCode = 1; }).finally(async () => {
  await browser?.close(); vite?.kill();
  if (apiServer) await new Promise(r => apiServer.close(r));
  await require('../../backend/config/db').end().catch(() => {});
  await db?.end();
  if (created) await maintenance.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await maintenance?.end();
});
