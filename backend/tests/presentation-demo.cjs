// Explicit presentation-data writes. Refuses every other database identity.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),env=require('dotenv').parse(fs.readFileSync(path.join(root,'backend/.env.demo')));
if(env.POS_DATABASE_ID!=='demo:bitter-salad-90425468'||!new URL(env.DATABASE_URL).hostname.startsWith('ep-spring-wave-benqsh0o'))throw Error('Refusing a non-demo target');
const remote=process.env.DEMO_API_ORIGIN;
if(remote&&remote!=='https://snack-time-pos.onrender.com')throw Error('Unexpected demo API origin');
const site=remote||'http://127.0.0.1:14806',api=site+'/api',artifacts=path.join(root,'database/backups/presentation-demo');fs.mkdirSync(artifacts,{recursive:true});
const accounts=require('../utils/ownerCredentialVault').readVault(path.join(root,'backend/.credentials.demo.dpapi.json')).accounts;
async function request(route,method='GET',body,token,status=200){const r=await fetch(api+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(90000)});assert.equal(r.status,status,method+' '+route+' status');return r.json();}
(async()=>{
 let server,browser,driver,store;const dir=fs.mkdtempSync(path.join(os.tmpdir(),'snacktime-demo-proof-')),checks=[];
 try{
  if(!remote)server=spawn(process.execPath,[path.join(root,'backend/scripts/cloud-start.js')],{cwd:root,env:{...process.env,...env,PORT:'14806'},stdio:'ignore',windowsHide:true});
  let healthy=false;for(let n=0;n<120;n++){try{const status=await request('/health');assert.equal(status.database_id,env.POS_DATABASE_ID);healthy=true;break;}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(healthy,'Demo API must start');
  const login=async(username,device)=>{const account=accounts.find(a=>a.username===username);return request('/auth/login','POST',{username,password:account.password,...(device?{offline_device_id:device}:{})});};
  const a=(await login('admin')).token,c=(await login('juan')).token;
  await request('/users','GET',undefined,c,403);for(const route of ['/auth/me','/categories','/products','/inventory','/orders','/users','/discounts','/settings','/reports/dashboard','/reports/daily','/reports/weekly','/reports/monthly'])await request(route,'GET',undefined,a);
  checks.push('actual administrator and cashier passwords, roles and every major read endpoint');
  const suffix=crypto.randomUUID().slice(0,6),category=await request('/categories','POST',{name:'Presentation treats '+suffix},a,201);
  const ingredient=await request('/inventory','POST',{name:'Demo cups '+suffix,unit:'pcs',current_stock:30,min_stock:5,cost_per_unit:0.50},a,201);
  await request('/inventory/adjust','POST',{ingredient_id:ingredient.id,type:'add',quantity:5,reason:'Presentation stock preparation'},a);
  const product=await request('/products','POST',{category_id:category.id,name:'Demo dessert '+suffix,price:'12.50',track_stock:true,stock:10},a,201);
  await request('/products/'+product.id+'/recipe','PUT',{items:[{ingredient_id:ingredient.id,quantity_required:1}]},a);
  await request('/products/'+product.id,'PUT',{name:'Demo dessert '+suffix,price:'12.50',category_id:category.id,available:1,track_stock:true,stock:10},a);
  checks.push('category/product create and update, inventory adjustment and recipe management');
  const payload={request_id:crypto.randomUUID(),items:[{product_id:product.id,quantity:2,selected_option_ids:[]}],discount_id:1,payment_method:'cash',cash_received:'50.00',expected_total:'20.00'};
  const cash=await request('/orders','POST',payload,c,201);assert.equal(cash.total,20);assert.equal(cash.discount_amount,5);assert.equal(cash.change_amount,30);
  const replay=await request('/orders','POST',payload,c,201);assert.equal(replay.id,cash.id);await request('/orders','POST',{...payload,cash_received:'60.00'},c,409);
  for(const payment_method of ['gcash','other'])await request('/orders','POST',{request_id:crypto.randomUUID(),items:[{product_id:11,quantity:1,selected_option_ids:[]}],payment_method,expected_total:'20.00'},c,201);
  await request('/orders/'+cash.id,'GET',undefined,c);checks.push('cash/gcash/other checkout, exact discounts/change, receipt/history and online replay protection');
  const {OfflineStore}=await import('../../frontend/src/offline/store.js'),{SyncManager}=await import('../../frontend/src/offline/sync-manager.js'),{openTestDatabase}=await import('../../frontend/tests/offline/node-driver.mjs');
  const file=path.join(dir,'demo.sqlite'),key=JSON.parse(fs.readFileSync(path.join(root,'frontend/src/offline/server-public-key.json')));
  driver=openTestDatabase(file);store=new OfflineStore(driver,key);await store.initialize();const device=(await store.status()).deviceId,authorization=await login('juan',device),account=accounts.find(x=>x.username==='juan');
  const snapshot=await request('/offline/catalog','POST',{device_id:device},authorization.token),stockAfterSale=Number(snapshot.products.find(p=>p.id===14).stock)-2;await store.enroll({password:account.password,alias:'juan',grant:authorization.offline_authorization,snapshot});await store.mode(true);store.lock();await store.login('juan',account.password);
  const id=crypto.randomUUID();await store.draft({request_id:id,items:[],discount:null});const receipt=await store.checkout({request_id:id,items:[{product_id:14,quantity:2,selected_option_ids:[]}],discount_id:2,payment_method:'cash',cash_received:'50.00',expected_total:'10.00'});
  const queue=await store.deliveryRows(),originalPayload=JSON.stringify(queue[0].payload);assert.equal(receipt.total,10);assert.equal((await store.catalog('products')).find(p=>p.id===14).stock,stockAfterSale);
  await store.tail;driver.close();driver=openTestDatabase(file);store=new OfflineStore(driver,key);await store.initialize();await store.login('juan',account.password);assert.equal((await store.listOrders({localOnly:true}))[0].id,receipt.id);
  const claims=require('jsonwebtoken').decode(authorization.offline_authorization);const wrong=require('jsonwebtoken').sign({...claims,database_id:'original:old-database'},env.OFFLINE_AUTH_PRIVATE_KEY,{algorithm:'RS256'});
  await request('/offline/catalog','POST',{device_id:device},wrong,401);await request('/offline/sales','POST',{...queue[0].payload,proof_grant:wrong},authorization.offline_authorization,401);
  let dropReply=true,uploads=0;
  const manager=()=>new SyncManager(store,{baseUrl:'https://snack-time-pos.onrender.com/api',fetcher:async(url,options)=>{const r=await fetch(url.replace('https://snack-time-pos.onrender.com/api',api),options);if(url.endsWith('/offline/sales')){uploads++;if(dropReply&&r.ok){dropReply=false;throw Error('Injected lost acknowledgement');}}return r;},schedule:(fn,ms)=>({fn,ms}),cancel:()=>{},random:()=>0.5});
  await manager().kick();assert.equal((await store.syncStatus()).pending,1);
  await store.tail;driver.close();driver=openTestDatabase(file);store=new OfflineStore(driver,key);await store.initialize();await store.login('juan',account.password);await manager().kick({retry:true});assert.equal((await store.syncStatus()).pending,0);assert.equal(uploads,2);
  assert.equal((await driver.query('SELECT payload_json FROM sync_outbox WHERE order_id=?',[receipt.id]))[0].payload_json,originalPayload);
  const {Pool,options}=require('../config/postgresql');const prior=process.env.DATABASE_URL;process.env.DATABASE_URL=env.DATABASE_URL;const pool=new Pool(options());if(prior)process.env.DATABASE_URL=prior;else delete process.env.DATABASE_URL;
  try{
   const {rows:[saved]}=await pool.query('SELECT COUNT(*)::int count FROM offline_sales WHERE device_id=$1 AND client_id=$2',[device,id]);assert.equal(saved.count,1);
   assert.equal((await pool.query('SELECT stock FROM products WHERE id=14')).rows[0].stock,stockAfterSale);
   const totals=(await pool.query('SELECT COUNT(*)::int orders,SUM(total)::text total FROM orders')).rows[0];
   const constraints=(await pool.query("SELECT COUNT(*)::int count FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='f' AND NOT convalidated")).rows[0].count;assert.equal(constraints,0);
   fs.writeFileSync(path.join(artifacts,remote?'live-data.json':'local-api-data.json'),JSON.stringify({totals,offlineOrderId:receipt.id,serverCopies:saved.count,namespace:env.POS_DATABASE_ID,constraintsValid:true},null,2));
  }finally{await pool.end();}
  checks.push('SQLite offline cash/discount/stock, two restart recoveries, real Neon upload, lost-ACK replay once and cross-database proof rejection');
  // Browser checks are deliberately bounded: two layouts and the real demo users.
  const {chromium}=require('../../frontend/node_modules/playwright');browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const errors=[];
  for(const [username,width,height] of [['admin',393,852],['juan',1024,768]]){
   const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true}),p=await context.newPage();p.setDefaultTimeout(90000);p.on('pageerror',()=>errors.push('Page JavaScript error'));
   // Only the explicit API checks above create demo transactions.
   await context.route('**/api/**',r=>!['GET','OPTIONS'].includes(r.request().method())&&!r.request().url().endsWith('/auth/login')?r.abort():r.continue());
   await p.goto(site+'/login',{waitUntil:'domcontentloaded'});await p.locator('#username').fill(username);await p.locator('#password').fill(accounts.find(x=>x.username===username).password);await p.getByRole('button',{name:'Log in',exact:true}).click();await p.waitForURL(username==='admin'?'**/dashboard':'**/pos');
   if(username==='admin'){await p.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'POS',exact:true}).click();await p.locator('.product-card').first().waitFor();await p.getByRole('button',{name:'More',exact:true}).click();assert.equal(await p.locator('.mobile-more-sheet a').count(),4);await p.getByRole('button',{name:'Close More menu'}).click();}
   else{await p.locator('.product-card').first().waitFor();assert.equal(await p.locator('.mobile-bottom-nav a').count(),2);}
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await p.screenshot({path:path.join(artifacts,(remote?'live-':'local-')+username+'-pos.png')});await context.close();
  }
  assert.deepEqual(errors,[]);checks.push('real web administrator/cashier login and role-aware phone/tablet POS rendering');
  const result={target:site,databaseId:env.POS_DATABASE_ID,checks,passed:true,physicalAndroid:'NOT TESTED'};fs.writeFileSync(path.join(artifacts,remote?'live-acceptance.json':'local-acceptance.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{if(browser)await browser.close();if(store)await store.tail;if(driver)driver.close();server?.kill();if(path.dirname(dir)===os.tmpdir()&&path.basename(dir).startsWith('snacktime-demo-proof-'))fs.rmSync(dir,{recursive:true,force:true});}
})().catch(error=>{console.error('Presentation acceptance failed: '+require('../../frontend/tests/safe-error.cjs')(error));const frame=String(error.stack||'').split('\n').find(line=>/^\s+at /.test(line)&&/presentation-demo\.cjs:\d+/.test(line));if(frame)console.error(frame);process.exitCode=1;});
