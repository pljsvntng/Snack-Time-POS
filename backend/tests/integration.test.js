// PostgreSQL regression writes are isolated in a disposable database.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Pool, options } = require('../config/postgresql');

test('PostgreSQL POS API regression suite', async (t) => {
  assert.ok(!process.env.DATABASE_URL,'Regression writes require local PostgreSQL, never a cloud DATABASE_URL');
  assert.ok(['localhost','127.0.0.1','::1'].includes(options().host),'Regression writes require a loopback PostgreSQL host');
  const offlinePair=require('crypto').generateKeyPairSync('rsa',{modulusLength:2048});
  process.env.OFFLINE_AUTH_PRIVATE_KEY=offlinePair.privateKey.export({type:'pkcs8',format:'pem'});
  const database = 'snacktime_test_' + Date.now();
  assert.match(database, /^snacktime_test_\d+$/);
  const maintenance = new Pool(options(process.env.PG_ADMIN_DATABASE || 'postgres'));
  const source = new Pool(options());
  let admin, pool, server, created = false;
  try {
    const {rows:[actual]} = await source.query('SELECT COUNT(*) AS count FROM orders');
    await maintenance.query('CREATE DATABASE "' + database + '"'); created = true;
    admin = new Pool({...options(database), max:1});
    await admin.query(fs.readFileSync(path.join(__dirname, '../../database/schema.postgresql.sql'), 'utf8'));
    await require('../utils/syncSchema').ensureSyncSchema(admin);
    const seed = fs.readFileSync(path.join(__dirname, '../../database/seed.sql'), 'utf8').replace(/USE foodtrip_house_pos;/, '');
    await admin.query(seed);
    const hash = await require('bcrypt').hash('test-password', 4);
    await admin.query("INSERT INTO users(id,role_id,full_name,username,email,password_hash,active) VALUES (1,1,'Test Admin','admin','admin@test.invalid',$1,1),(2,2,'Test Cashier','juan','cashier@test.invalid',$1,1)",[hash]);
    const {rows:identities} = await admin.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND is_identity='YES'");
    for (const col of identities) await admin.query('SELECT setval(pg_get_serial_sequence($1,$2),COALESCE((SELECT MAX("' + col.column_name + '") FROM "' + col.table_name + '"),0)+1,false)',[col.table_name,col.column_name]);
    process.env.PG_DATABASE = database;
    pool = require('../config/db');
    const express = require('express');
    const app = express(); app.use(express.json());
    app.use('/images',require('../utils/productImages').serveImage);
    for (const route of ['offline','auth','categories','products','inventory','orders','users','reports','discounts','settings']) app.use(`/api/${route}`, require(`../routes/${route}`));
    app.use(require('../middleware/errorHandler').errorHandler);
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    async function request(url, method = 'GET', body, token, status = 200) {
      const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = await res.json(); assert.equal(res.status, status, `${method} ${url}: HTTP ${res.status}`); return data;
    }
    const login = name => request('/auth/login', 'POST', {username: name, password: 'test-password'});
    const a = (await login('admin')).token, c = (await login('juan')).token;
    await t.test('administrator password policy and database role authority',async()=>{
      await request('/users','POST',{full_name:'Weak admin',username:'weak-admin',password:'short-password',role:'admin'},a,400);
      await request('/users','POST',{full_name:'Weak admin',username:'weak-admin',password:'short-password',role:'ADMIN'},a,400);
      await request('/users/2','PUT',{role:'admin'},a,400);
      await request('/users/2','PUT',{role:'ADMIN'},a,400);
      const password=require('crypto').randomBytes(24).toString('base64url');
      const created=await request('/users','POST',{full_name:'Strong admin',username:'strong-admin',password,role:'admin'},a,201);
      const {rows:[record]}=await admin.query('SELECT password_hash FROM users WHERE id=$1',[created.id]);assert.equal(require('bcrypt').getRounds(record.password_hash),12);assert.equal(await require('bcrypt').compare(password,record.password_hash),true);
      const {rows:[cashier]}=await admin.query('SELECT password_hash FROM users WHERE id=2');
      const forgedRole=require('jsonwebtoken').sign({id:2,role:'admin',credentialVersion:require('crypto').createHash('sha256').update(cashier.password_hash).digest('hex')},process.env.JWT_SECRET,{expiresIn:'1m'});
      await request('/users','GET',undefined,forgedRole,403);
    });
    await t.test('authentication and authorization', async () => {
      await request('/auth/login', 'POST', {username: 'admin', password: 'wrong'}, null, 401);
      await request('/products', 'GET', undefined, null, 401);
      await request('/reports/dashboard', 'GET', undefined, c, 403);
      assert.equal((await request('/auth/me', 'GET', undefined, a)).user.role, 'admin');
      await admin.query('UPDATE users SET active = 0 WHERE id = 2');
      await request('/products', 'GET', undefined, c, 401);
      await admin.query('UPDATE users SET active = 1 WHERE id = 2');
      await admin.query('UPDATE users SET role_id = 2 WHERE id = 1');
      await request('/reports/dashboard', 'GET', undefined, a, 403);
      await admin.query('UPDATE users SET role_id = 1 WHERE id = 1');
    });
    await t.test('PostgreSQL catalog, product validation and stock toggles', async () => {

      assert.ok((await request('/products', 'GET', undefined, a)).length > 0);
      await request('/products/1', 'GET', undefined, a);
      await request('/products','POST',{category_id:1,name:' ',price:5},a,400);
      await request('/products','POST',{category_id:1,name:'bad',price:'NaN'},a,400);
      const product = await request('/products','POST',{category_id:1,name:'Test piece',price:12.5,track_stock:true,stock:5,low_stock_threshold:0},a,201);
      await request(`/products/${product.id}`,'PUT',{name:'Edited',price:15,stock:4},a);
      assert.equal((await request(`/products/${product.id}`,'GET',undefined,a)).stock,4);
      await request(`/products/${product.id}`,'PUT',{track_stock:false},a);
      assert.equal((await request(`/products/${product.id}`,'GET',undefined,a)).stock,null);
      await request(`/products/${product.id}`,'PUT',{track_stock:true},a);
      assert.equal((await request(`/products/${product.id}`,'GET',undefined,a)).stock,0);
      await request(`/products/${product.id}`,'DELETE',undefined,a);
      await request(`/products/${product.id}`,'GET',undefined,a,404);
      await request(`/products/${product.id}/restore`,'PATCH',{},a);
    });
    await t.test('inventory adjustments, recipes and validation', async () => {
      await request('/inventory/adjust','POST',{ingredient_id:1,type:'deduct',quantity:999999},a,400);
      await request('/inventory/adjust','POST',{ingredient_id:1,type:'add',quantity:'NaN'},a,400);
      await request('/inventory','POST',{name:'Bad',current_stock:-1},a,400);
      await request('/inventory/adjust','POST',{ingredient_id:1,type:'adjust',quantity:200},a);
      await request('/products/1/recipe','PUT',{items:[{ingredient_id:1,quantity_required:-1}]},a,400);
      await request('/products/1/recipe','PUT',{items:[{ingredient_id:1,quantity_required:1},{ingredient_id:1,quantity_required:2}]},a,400);
      assert.ok((await request('/inventory/transactions','GET',undefined,a)).length);
    });
    const sale = (extra={}) => ({items:[{product_id:1,quantity:2,selected_option_ids:[]}],payment_method:'cash',cash_received:100,...extra});
    await t.test('checkout validation and rollback', async () => {
      for(const body of [sale({cash_received:'NaN'}),sale({cash_received:1}),sale({discount_id:999}),sale({expected_total:1}),sale({items:[{product_id:1,quantity:1,selected_option_ids:[999]}]}),sale({items:[null]}),sale({items:[{product_id:2,quantity:1,selected_option_ids:[]}]})]) await request('/orders','POST',body,c,body.expected_total ? 409 : 400);
      const {rows:[row]} = await pool.query('SELECT COUNT(*) n FROM orders'); assert.equal(row.n,0);
    });
    let order;
    await t.test('discounts, totals, change, ingredient deduction and receipt snapshots', async () => {
      const {rows:[before]} = await pool.query('SELECT current_stock stock FROM ingredients WHERE id = 1');
      order = await request('/orders','POST',sale({discount_id:1,expected_total:40}),c,201);
      assert.equal(order.subtotal,50); assert.equal(order.discount_amount,10);assert.equal(order.total,40);assert.equal(order.change_amount,60);
      const {rows:[after]} = await pool.query('SELECT current_stock stock FROM ingredients WHERE id = 1');assert.equal(before.stock-after.stock,2);
      const detail=await request(`/orders/${order.id}`,'GET',undefined,c);assert.equal(detail.items[0].product_name,'Plain Burger');
      await request('/orders','POST',sale({discount_id:2,payment_method:'gcash',expected_total:40}),c,201);
      const products=await request('/products','GET',undefined,c); const customized=products.find(p=>p.id===2);const option=customized.option_groups[0].options[0];
      const custom=await request('/orders','POST',sale({items:[{product_id:2,quantity:1,selected_option_ids:[option.id]}]}),c,201);
      const receipt=await request(`/orders/${custom.id}`,'GET',undefined,c);assert.equal(receipt.items[0].options[0].option_name,option.name);
    });
    await t.test('concurrent checkout numbering and stock exhaustion', async () => {
      const orders=await Promise.all(Array.from({length:6},()=>request('/orders','POST',sale({items:[{product_id:1,quantity:1}]}),c,201)));
      assert.equal(new Set(orders.map(o=>o.order_number)).size,6);
      await admin.query('UPDATE ingredients SET current_stock = 1 WHERE id = 1');
      const results=await Promise.all(Array.from({length:2},()=>fetch(base+'/orders',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${c}`},body:JSON.stringify(sale({items:[{product_id:1,quantity:1}]}))})));
      assert.deepEqual(results.map(r=>r.status).sort(),[201,400]);
      const {rows:[stock]} = await pool.query('SELECT current_stock stock FROM ingredients WHERE id = 1');assert.equal(stock.stock,'0.00');
    });
    await t.test('history ownership, reports, settings and invalid ranges', async () => {
      const other=await request('/orders','POST',sale({items:[{product_id:11,quantity:1}]}),a,201);
      await request(`/orders/${other.id}`,'GET',undefined,c,404);
      await request('/orders?from=2026-02-30','GET',undefined,a,400);
      await request('/inventory/transactions?from=2026-10-31%2025:00:00','GET',undefined,a,400);
      await request('/orders?limit=-1','GET',undefined,a,400);
      await request('/reports/daily?date=2026-02-30','GET',undefined,a,400);
      await request('/reports/monthly?year=2026&month=13','GET',undefined,a,400);
      const weekly=await request('/reports/weekly?date=2026-10-31','GET',undefined,a);assert.equal(weekly.week_start,'2026-10-26');assert.equal(weekly.week_end,'2026-11-01');
      const dashboard=await request('/reports/dashboard','GET',undefined,a);const daily=await request('/reports/daily','GET',undefined,a);
      const {rows:[sum]} = await pool.query('SELECT SUM(total) total, COUNT(*) n FROM orders');assert.equal(daily.total_sales,sum.total);assert.equal(dashboard.today_sales,sum.total);assert.equal(daily.transactions,sum.n);
      await request('/reports/monthly','GET',undefined,a);
      await request('/settings','PUT',{business_name:'Test POS'},a);assert.equal((await request('/settings','GET',undefined,a)).business_name,'Test POS');
    });
    await t.test('user creation and uploaded image lifecycle', async () => {
      await request('/users','POST',{full_name:'New Cashier',username:'new-cashier',password:'test-password',role:'cashier'},a,201);
      await request('/users','POST',{full_name:'New Cashier',username:'new-cashier',password:'test-password',role:'cashier'},a,409);
      const newUser=await login('new-cashier');assert.equal(newUser.user.role,'cashier');
      const form=new FormData();form.append('image',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'test.png');
      const product=await request('/products','POST',{category_id:1,name:'Image test',price:5},a,201);
      const uploaded=await fetch(base+'/products/'+product.id+'/image',{method:'POST',headers:{Authorization:'Bearer '+a},body:form});assert.equal(uploaded.status,200);
      const image=await uploaded.json();assert.ok(fs.existsSync(path.join(__dirname,'../../frontend/public',image.image)));
      await request('/products/'+product.id+'/image','DELETE',undefined,a);
      assert.equal((await request('/products/'+product.id,'GET',undefined,a)).image,null);
    });
    await t.test('search filters, categories, valid recipes and direct stock sales', async () => {
      const category = await request('/categories','POST',{name:'Regression Category',display_order:99},a,201);
      await request('/categories/'+category.id,'PUT',{name:'Updated category',active:1},a);
      const ingredient = await request('/inventory','POST',{name:'Regression ingredient',unit:'pcs',current_stock:10,min_stock:1,cost_per_unit:0.10},a,201);
      await request('/inventory/'+ingredient.id,'PUT',{min_stock:2,cost_per_unit:0.20},a);
      const product = await request('/products','POST',{category_id:category.id,name:'Regression piece',price:2.50,track_stock:true,stock:2},a,201);
      await request('/products/'+product.id+'/recipe','PUT',{items:[{ingredient_id:ingredient.id,quantity_required:1}]},a);
      const recipe = await request('/products/'+product.id+'/recipe','GET',undefined,a);assert.equal(recipe[0].quantity_required,'1.00');
      const catalog=await request('/products?category=regression-category&search=REGRESSION','GET',undefined,a);assert.equal(catalog.length,1);
      const order=await request('/orders','POST',sale({items:[{product_id:product.id,quantity:2}],payment_method:'other'}),c,201);assert.equal(order.total,5);
      await request('/orders','POST',sale({items:[{product_id:product.id,quantity:1}]}),c,400);
      const history=await request('/orders?search='+order.order_number+'&cashier_id=2&status=completed','GET',undefined,a);assert.equal(history.length,1);
      const ledger=await request('/inventory/transactions?ingredient_id='+ingredient.id,'GET',undefined,a);assert.equal(ledger[0].quantity,'2.00');
    });
    await t.test('decimal money, fractional inventory and rollback after partial writes', async () => {
      const product=await request('/products','POST',{category_id:1,name:'Decimal sale',price:0.10},a,201);
      const order=await request('/orders','POST',sale({items:[{product_id:product.id,quantity:3}],discount_id:1,cash_received:1,expected_total:0.24}),c,201);
      assert.equal(order.total,0.24);assert.equal(order.change_amount,0.76);
      const {rows:[stored]}=await pool.query('SELECT subtotal,discount_amount,total FROM orders WHERE id=$1',[order.id]);
      assert.deepEqual(stored,{subtotal:'0.30',discount_amount:'0.06',total:'0.24'});
      await request('/inventory/adjust','POST',{ingredient_id:1,type:'adjust',quantity:1.10},a);
      await request('/inventory/adjust','POST',{ingredient_id:1,type:'add',quantity:0.20},a);
      const {rows:[stock]}=await pool.query('SELECT current_stock FROM ingredients WHERE id=1');assert.equal(stock.current_stock,'1.30');
      const {rows:[before]}=await pool.query('SELECT COUNT(*) n FROM orders');
      await admin.query("CREATE FUNCTION reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Regression rollback injection'; END; $$; CREATE TRIGGER reject_audit BEFORE INSERT ON inventory_transactions FOR EACH ROW EXECUTE FUNCTION reject_audit();");
      try { await request('/orders','POST',sale({items:[{product_id:1,quantity:1}]}),c,500); }
      finally { await admin.query('DROP TRIGGER reject_audit ON inventory_transactions; DROP FUNCTION reject_audit()'); }
      const {rows:[after]}=await pool.query('SELECT COUNT(*) n FROM orders');assert.equal(after.n,before.n);
      const {rows:[unchanged]}=await pool.query('SELECT current_stock FROM ingredients WHERE id=1');assert.equal(unchanged.current_stock,'1.30');
    });
    await t.test('signed device-bound offline authorization and consistent private bootstrap',async()=>{
      const device=require('crypto').randomUUID();
      const auth=await request('/auth/login','POST',{username:'admin',password:'test-password',offline_device_id:device});
      const grant=require('jsonwebtoken').verify(auth.offline_authorization,offlinePair.publicKey,{algorithms:['RS256'],issuer:'snacktime-pos',audience:'snacktime-offline'});
      assert.equal(grant.device_id,device);assert.equal(grant.user.id,1);assert.equal(grant.exp-grant.iat,7*86400);
      const snapshot=await request('/offline/bootstrap','GET',undefined,a);
      assert.equal(snapshot.user_id,1);assert.equal(snapshot.schema_version,1);assert.ok(snapshot.products.length);assert.ok(snapshot.ingredients.length);
      assert.ok(snapshot.orders.every(o=>o.user_id===1));assert.equal(JSON.stringify(snapshot).includes('password_hash'),false);
      const cashier=await request('/offline/bootstrap','GET',undefined,c);assert.ok(cashier.orders.every(o=>o.user_id===2));
      await request('/offline/bootstrap','GET',undefined,null,401);
    });
    await t.test('cloud product photos persist in PostgreSQL and preserve upload permissions',async()=>{
      await admin.query(fs.readFileSync(path.join(__dirname,'../../database/cloud-storage.postgresql.sql'),'utf8'));
      process.env.PRODUCT_IMAGE_STORAGE='postgres';
      const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=','base64');
      const upload=async(token,bytes=png)=>{const form=new FormData();form.append('image',new Blob([bytes],{type:'image/png'}),'photo.png');return fetch(base+'/products/1/image',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});};
      try{
        assert.equal((await upload(c)).status,403);
        const result=await upload(a);assert.equal(result.status,200);const {image}=await result.json();
        const photo=await fetch(base.replace(/\/api$/,'')+image);assert.equal(photo.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await photo.arrayBuffer()),png);
        const {rows:[stored]}=await admin.query('SELECT contents FROM product_images WHERE path=$1',[image]);assert.deepEqual(stored.contents,png);
        assert.equal((await upload(a,Buffer.from('invalid image'))).status,400);
        assert.equal((await request('/products/1','GET',undefined,a)).image,image);
        const replacement=await (await upload(a)).json();assert.notEqual(replacement.image,image);
        assert.equal((await admin.query('SELECT 1 FROM product_images WHERE path=$1',[image])).rowCount,0);
        await request('/products/1/image','DELETE',undefined,a);
        assert.equal((await admin.query('SELECT 1 FROM product_images WHERE path=$1',[replacement.image])).rowCount,0);
        assert.equal((await request('/products/1','GET',undefined,a)).image,null);
      }finally{delete process.env.PRODUCT_IMAGE_STORAGE;}
    });
    await t.test('online checkout retries and concurrent submissions save one sale and one stock deduction',async()=>{
      const product=await request('/products','POST',{category_id:1,name:'Idempotency fixture',price:'5.00',track_stock:true,stock:1},a,201);
      const payload={request_id:require('crypto').randomUUID(),items:[{product_id:product.id,quantity:1,selected_option_ids:[]}],payment_method:'cash',cash_received:'10.00',expected_total:'5.00'};
      const before=(await admin.query('SELECT COUNT(*)::int n FROM orders')).rows[0].n;
      const saved=await request('/orders','POST',payload,c,201);
      const retried=await request('/orders','POST',payload,c,201);
      assert.equal(retried.id,saved.id,'Lost checkout replies must not create another sale');
      const concurrent=await Promise.all([request('/orders','POST',payload,c,201),request('/orders','POST',payload,c,201)]);
      assert.ok(concurrent.every(order=>order.id===saved.id));
      assert.equal((await admin.query('SELECT COUNT(*)::int n FROM orders')).rows[0].n,before+1);
      assert.equal((await admin.query('SELECT stock FROM products WHERE id=$1',[product.id])).rows[0].stock,0);
      await request('/orders','POST',{...payload,cash_received:'20.00'},c,409);
      await request('/orders','POST',{...payload,request_id:'not-a-uuid'},c,400);
    });

    await t.test('password reset invalidates issued session',async()=>{
      await request('/users/2','PUT',{password:'replacement-password'},a);
      await request('/products','GET',undefined,c,401);
    });
    const {rows:[unchanged]} = await source.query('SELECT COUNT(*) AS count FROM orders'); assert.equal(unchanged.count,actual.count);
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    if(pool) await pool.end();
    if(admin) await admin.end();
    await source.end();
    if(created) await maintenance.query('DROP DATABASE "' + database + '"');
    await maintenance.end();
  }
});
