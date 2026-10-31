const {chromium}=require('playwright'),{spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),site='http://127.0.0.1:15181';
async function wait(url){for(let i=0;i<160;i++){try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw Error('Startup: '+url);}
(async()=>{
 const {OfflineStore}=await import('../src/offline/store.js'),{openTestDatabase}=await import('./offline/node-driver.mjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'snacktime-offline-ui-')),file=path.join(dir,'pos.sqlite');
 const publicKey=JSON.parse(fs.readFileSync(path.join(root,'frontend/src/offline/server-public-key.json')));
 let driver=openTestDatabase(file),store=new OfflineStore(driver,publicKey);await store.initialize();
 const express=require('../../backend/node_modules/express'),app=express();app.use(require('../../backend/node_modules/cors')({origin:site}));app.use(express.json({limit:'12mb'}));app.get('/health',(_,r)=>r.json({ok:true}));
 const allowed=new Set(['status','mode','enroll','renew','login','revoke','token','catalog','draft','listOrders','order','checkout','lock','identity']);
 app.post('/sqlite',async(req,res)=>{try{const {method,args=[]}=req.body;if(!allowed.has(method))throw Error('Forbidden test method');const value=method==='identity'?await store.exclusive(()=>store.actor()):await store[method](...args);res.json({value:value??null});}catch(e){res.status(e.status||400).json({error:e.message,status:e.status||400});}});
 const bridge=await new Promise(r=>{const server=app.listen(14804,'127.0.0.1',()=>r(server));});
 const backend=spawn(process.execPath,[path.join(root,'backend/server.js')],{cwd:root,env:{...process.env,PORT:'14803',CLIENT_ORIGIN:site},stdio:'ignore',windowsHide:true});
 const vite=spawn(process.execPath,[path.join(root,'frontend/node_modules/vite/bin/vite.js'),'--config',path.join(root,'frontend/tests/offline/vite.config.mjs'),'--host','127.0.0.1','--port','15181','--strictPort'],{cwd:path.join(root,'frontend'),env:{...process.env,VITE_API_URL:'https://pos.test/api'},stdio:'ignore',windowsHide:true});
 const {Pool,options}=require('../../backend/config/postgresql'),pg=new Pool(options());const {rows:[before]}=await pg.query('SELECT COUNT(*) n FROM orders');
 let browser,online=true;const errors=[];
 try{
  await Promise.all([wait(site),wait('http://127.0.0.1:14803/api/health')]);browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  async function page(){const c=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});const p=await c.newPage();p.setDefaultTimeout(60000);p.on('pageerror',e=>{errors.push(e.message);console.error('UI error:',e.message);});await p.route('https://pos.test/**',async r=>{if(!online)return r.abort();const response=await r.fetch({url:r.request().url().replace('https://pos.test','http://127.0.0.1:14803')});return r.fulfill({response});});await p.goto(site+'/login',{waitUntil:'commit',timeout:60000});await p.locator('#username').waitFor();return p;}
  async function login(p){await p.locator('#username').fill('admin');await p.locator('#password').fill(process.env.TEST_ADMIN_PASSWORD||'admin123');await p.getByRole('button',{name:'Log in',exact:true}).click();await p.waitForURL(/\/(dashboard|pos)$/);}
  let p=await page();await login(p);assert.ok((await store.status()).preparedAt);console.log('PASS Android-flow online authorization and local catalog preparation');
  await p.getByRole('button',{name:'Use offline POS',exact:true}).click();await p.waitForURL('**/login');online=false;await login(p);await p.locator('.product-card').first().waitFor();
  await p.getByPlaceholder('Search products...').fill('Plain Burger');await p.locator('.product-card').first().click();await p.locator('.cart-fab').click();await p.getByLabel('Discount',{exact:true}).selectOption('2');await p.getByRole('button',{name:'Close order'}).click();
  await store.tail;const draft=await store.draft();assert.equal(draft.items.length,1);await p.context().close();driver.close();driver=openTestDatabase(file);store=new OfflineStore(driver,publicKey);await store.initialize();
  p=await page();await login(p);await p.locator('.cart-fab').click();await p.locator('.cart-item').waitFor();assert.equal(await p.getByLabel('Discount',{exact:true}).inputValue(),'2');
  await p.getByRole('button',{name:'Complete Order'}).click();await p.locator('.payment-modal').waitFor();assert.equal(await p.locator('.payment-method-btn').count(),1);await p.getByLabel('Cash Received',{exact:true}).fill('100');await p.getByRole('button',{name:'Confirm Payment',exact:false}).click();await p.getByText('Sale saved on this device',{exact:true}).waitFor();
  const saved=(await store.listOrders({localOnly:true}))[0];assert.ok(saved.offline);assert.equal(saved.payment_method,'cash');console.log('PASS offline search, restored cart, discount and atomic cash checkout');
  await p.context().close();driver.close();driver=openTestDatabase(file);store=new OfflineStore(driver,publicKey);await store.initialize();
  p=await page();await login(p);await p.getByRole('button',{name:'Open menu',exact:true}).click();await p.getByRole('link',{name:'My Transactions',exact:true}).click();await p.locator('.filter-row select').selectOption('all');await p.getByRole('button',{name:'View',exact:true}).first().click();await p.locator('.receipt').waitFor();assert.ok((await p.locator('.receipt').innerText()).includes(saved.order_number));assert.ok((await p.locator('.receipt').innerText()).includes('Not uploaded'));console.log('PASS receipt and transaction history after a second SQLite/application restart');
  const {rows:[after]}=await pg.query('SELECT COUNT(*) n FROM orders');assert.equal(after.n,before.n);assert.equal((await store.listOrders({localOnly:true})).length,1);assert.deepEqual(errors,[]);console.log('Offline UI passed; no local sale was uploaded to PostgreSQL.');
 }finally{if(browser)await browser.close();await store.tail;driver.close();await new Promise(r=>bridge.close(r));backend.kill();vite.kill();await pg.end();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
