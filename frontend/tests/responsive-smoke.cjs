// Read-only Android-size UI checks; no production writes or paid orders.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const remote=process.env.TEST_REMOTE_SITE,remoteApi=process.env.TEST_REMOTE_API;
if(remote||remoteApi){const url=new URL(remote||remoteApi);if(url.protocol!=='https:'||!url.hostname.endsWith('.onrender.com'))throw Error('Use the real Render HTTPS origin.');const accounts=require('../../backend/utils/ownerCredentialVault').ownerAccounts();process.env.TEST_ADMIN_PASSWORD=accounts.find(a=>a.username==='admin').password;process.env.TEST_CASHIER_PASSWORD=accounts.find(a=>a.username==='juan').password;}
const site=remote||'http://127.0.0.1:15180', api=remote||remoteApi||'http://127.0.0.1:14801';
const artifacts=path.join(root,'database/backups',remoteApi?'phase7-responsive':'responsive-verification');
const sizes=[['small-phone',320,640],['phone',360,800],['phone-large',393,852],['phone-wide',412,915],['small-tablet',600,960],['tablet-portrait',768,1024],['tablet-tall',800,1280],['tablet-landscape',1024,768],['tablet-wide',1280,800],['phone-landscape',852,393],['desktop',1440,900]];
const routes=['dashboard','products','inventory','transactions','reports','users','settings'];
async function wait(url){for(let i=0;i<160;i++){try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw Error('Startup failed: '+url);}
async function contained(page,label){
 const result=await page.evaluate(()=>{const p=document.querySelector('.page-body');return {doc:document.documentElement.scrollWidth,view:innerWidth,page:p?.scrollWidth,pageClient:p?.clientWidth};});
 assert.ok(result.doc<=result.view+1,label+' document overflow '+JSON.stringify(result));
 assert.ok(!result.page || result.page<=result.pageClient+1,label+' page overflow '+JSON.stringify(result));
}
async function reachable(locator,label){await locator.scrollIntoViewIfNeeded();assert.ok(await locator.isVisible(),label+' hidden');assert.ok(await locator.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1;}),label+' offscreen');}
(async()=>{
 if(!process.env.TEST_ADMIN_PASSWORD)process.env.TEST_ADMIN_PASSWORD=await require('../../backend/utils/hiddenPrompt').hiddenPrompt('Administrator test password (hidden): ');
 if(!process.env.TEST_CASHIER_PASSWORD)process.env.TEST_CASHIER_PASSWORD=await require('../../backend/utils/hiddenPrompt').hiddenPrompt('Cashier test password (hidden): ');
 fs.mkdirSync(artifacts,{recursive:true});
 const backend=remote||remoteApi?null:spawn(process.execPath,[path.join(root,'backend/server.js')],{cwd:root,env:{...process.env,PORT:'14801',CLIENT_ORIGIN:site},stdio:'ignore',windowsHide:true});
 const vite=remote?null:spawn(process.execPath,[path.join(root,'frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','15180','--strictPort'],{cwd:path.join(root,'frontend'),env:{...process.env,VITE_API_URL:api+'/api'},stdio:'ignore',windowsHide:true});
 let browser;const summary=[];
 try{
  await Promise.all([wait(api+'/api/health'),wait(site)]);
  browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  async function context(options={}){const c=await browser.newContext(options);await c.route('https://fonts.googleapis.com/**',r=>r.abort());await c.route('https://fonts.gstatic.com/**',r=>r.abort());await c.route('**/api/**',async r=>{try{if(!['GET','OPTIONS'].includes(r.request().method())&&!r.request().url().endsWith('/auth/login'))return await r.abort();if(!remoteApi)return await r.continue();const response=await r.fetch({headers:{...r.request().headers(),origin:'https://localhost'}});return await r.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':site}});}catch{try{await r.fulfill({status:503,contentType:'application/json',headers:{'access-control-allow-origin':site},body:JSON.stringify({error:'Browser acceptance proxy could not reach the API.'})});}catch{}}});return c;}
  const loginContext=await context({viewport:{width:393,height:852},isMobile:true,hasTouch:true});const login=await loginContext.newPage();login.setDefaultTimeout(120000);
  await login.goto(site+'/login',{waitUntil:'commit',timeout:120000});await login.locator('#username').waitFor();await contained(login,'phone login');
  await login.locator('#username').fill(process.env.TEST_ADMIN_USER||'admin');await login.locator('#password').fill(process.env.TEST_ADMIN_PASSWORD);
  await login.getByRole('button',{name:'Log in',exact:true}).click();await login.waitForURL('**/dashboard');const storageState=await loginContext.storageState();await loginContext.close();
  for(const [name,width,height] of sizes.filter(entry=>!process.env.RESPONSIVE_CASES || process.env.RESPONSIVE_CASES.split(',').includes(entry[0]))){
   const c=await context({viewport:{width,height},isMobile:width<1200,hasTouch:true,storageState});const p=await c.newPage();p.setDefaultTimeout(30000);const errors=[];
   p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=400)errors.push('API '+r.status()+' '+r.url());});
   await p.goto(site+'/pos',{waitUntil:'domcontentloaded'});await p.locator('.product-card').first().waitFor();await contained(p,name+' POS');
   const drawer=width<760||(width<1200&&height<560);
   const gridColumns=await p.locator('.product-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);assert.ok(gridColumns>=2,name+' needs at least two product columns');
   assert.equal(await p.locator('.cart-fab').isVisible(),drawer,name+' cart mode');
   if(width<1200){await p.getByRole('button',{name:'Open menu',exact:true}).click();const nav=p.locator('#navigation-drawer');await nav.waitFor({state:'visible'});assert.equal(await p.locator('.mobile-menu-btn').getAttribute('aria-expanded'),'true');
    for(const href of ['/pos','/dashboard','/products','/inventory','/transactions','/reports','/users','/settings'])assert.equal(await nav.locator('a[href="'+href+'"]').count(),1);
    await p.keyboard.press('Escape');await nav.waitFor({state:'hidden'});assert.equal(await p.getByRole('button',{name:'Open menu',exact:true}).getAttribute('aria-expanded'),'false');}
   if(!drawer){const bounds=await p.locator('.cart-panel').boundingBox(),menu=await p.locator('.pos-menu').boundingBox();assert.ok(bounds.x>=menu.x+menu.width-1,name+' must show products/cart side by side');}
   await p.getByPlaceholder('Search products...').fill('Milk Tea');await p.locator('.product-card').first().click();const dialog=p.locator('.customization-modal');await dialog.waitFor();await contained(p,name+' customization');
   const groups=dialog.locator('.option-group');for(let i=0;i<await groups.count();i++)await groups.nth(i).locator('.option-choice:not(.disabled)').first().click();
   await reachable(dialog.getByRole('button',{name:/Add to Order/}),name+' add action');await dialog.getByRole('button',{name:/Add to Order/}).click();
   if(drawer){await reachable(p.locator('.cart-fab'),name+' order bar');await p.locator('.cart-fab').click();await p.locator('.cart-panel.open').waitFor();}
   const cart=p.locator('.cart-panel');assert.equal(await cart.locator('.cart-item').count(),1);
   if(name==='phone-large') {
     await p.setViewportSize({width:1024,height:768});
     await p.waitForFunction(()=>getComputedStyle(document.querySelector('.cart-fab')).display==='none');
     assert.equal(await cart.locator('.cart-item').count(),1,'Rotation must preserve the cart');
     await reachable(cart.getByRole('button',{name:'Complete Order'}),'rotated checkout');
     await p.setViewportSize({width,height});
     await p.waitForFunction(()=>getComputedStyle(document.querySelector('.cart-fab')).display!=='none');
   }
   // Transformed bottom-sheet coordinates can round 44 CSS pixels fractionally.
   for(const target of [cart.getByRole('button',{name:'Increase quantity'}),cart.getByRole('button',{name:'Remove',exact:false})]){const b=await target.boundingBox();assert.ok(b.height>=43.99&&b.width>=43.99,name+' touch target too small: '+JSON.stringify(b));}
   await reachable(cart.getByLabel('Discount'),name+' discount');await cart.getByLabel('Discount').selectOption('2');
   await reachable(cart.getByRole('button',{name:'Complete Order'}),name+' checkout');await cart.getByRole('button',{name:'Complete Order'}).click();const payment=p.locator('.payment-modal');await payment.waitFor();
   await payment.getByLabel('Cash Received').fill('100');await reachable(payment.getByRole('button',{name:'Confirm Payment'}),name+' payment');
   await p.screenshot({path:path.join(artifacts,name+'-payment.png')});
   // Emulate the reduced visual viewport while Android's keyboard is open.
   if(name==='phone-large'){await p.setViewportSize({width,height:400});await reachable(payment.getByRole('button',{name:'Confirm Payment'}),'keyboard payment action');await contained(p,'keyboard');await p.setViewportSize({width,height});}
   if(name==='phone-large') {
     for(let i=0;i<12;i++) await p.keyboard.press('Tab');
     assert.ok(await payment.evaluate(e=>e.contains(document.activeElement)),'Focus must stay inside the payment dialog');
     await p.keyboard.press('Escape');await payment.waitFor({state:'hidden'});
   } else await payment.getByRole('button',{name:'Cancel',exact:true}).click();
   if(drawer){await cart.getByRole('button',{name:'Close order'}).click();await p.locator('.cart-panel').waitFor({state:'hidden'});}
   await p.getByPlaceholder('Search products...').fill('');await p.screenshot({path:path.join(artifacts,name+'-pos.png')});
   for(const route of routes){await p.goto(site+'/'+route,{waitUntil:'domcontentloaded'});const ready=route==='dashboard'?'.stat-card':route==='settings'?'.form-group':route==='reports'?'.stat-card':'.data-table tbody';await p.locator(ready).first().waitFor();await contained(p,name+' '+route);
    if(route==='products'||route==='users'){await p.getByRole('button',{name:'Add '+(route==='products'?'Product':'User'),exact:true}).click();const box=p.locator('.modal-box');await box.waitFor();await contained(p,name+' '+route+' form');await reachable(box.getByRole('button',{name:route==='products'?'Save Product':'Save',exact:true}),name+' '+route+' save');await box.getByRole('button',{name:'Close',exact:true}).click();}
    if(['small-phone','tablet-landscape'].includes(name) && route==='inventory') {
      await p.getByRole('button',{name:'Add Ingredient',exact:true}).click();let box=p.locator('.modal-box');await box.waitFor();await contained(p,name+' ingredient form');await reachable(box.getByRole('button',{name:'Save',exact:true}),name+' ingredient save');await box.locator('.modal-close').click();
      await p.getByRole('button',{name:'Adjust Stock',exact:false}).first().click();box=p.locator('.modal-box');await box.waitFor();await contained(p,name+' stock form');await reachable(box.getByRole('button',{name:'Confirm',exact:true}),name+' stock confirm');await box.locator('.modal-close').click();
    }
    if(['small-phone','tablet-landscape'].includes(name) && route==='transactions') {
      await p.locator('.filter-row select').selectOption('all');await p.getByRole('button',{name:'View',exact:true}).first().click();await p.locator('.receipt').waitFor();await contained(p,name+' receipt');await reachable(p.getByRole('button',{name:'Print Receipt',exact:false}),name+' print receipt');await p.locator('.modal-close').click();
    }
    if(route==='settings')await reachable(p.getByRole('button',{name:'Save Settings'}),name+' settings save');
    if(route==='dashboard'&&['small-phone','tablet-landscape'].includes(name))await p.screenshot({path:path.join(artifacts,name+'-dashboard.png')});
   }
   assert.deepEqual(errors,[],name+' runtime errors');summary.push({name,width,height,gridColumns,cart:drawer?'sheet':'side-by-side',routes:routes.length,overflow:false});console.log('PASS '+name+' '+width+'x'+height+' '+(drawer?'sheet':'side-by-side'));
   await c.close();
  }
  const cashierContext=await context({viewport:{width:393,height:852},isMobile:true,hasTouch:true});const cashier=await cashierContext.newPage();
  await cashier.goto(site+'/login',{waitUntil:'domcontentloaded'});
  if(remote||remoteApi){const session=await require('../../backend/tests/live-readonly-session.cjs')();await cashier.evaluate(s=>{localStorage.setItem('fh_token',s.token);localStorage.setItem('fh_user',JSON.stringify(s.user));},session);await cashier.goto(site+'/pos',{waitUntil:'domcontentloaded'});}
  else{await cashier.locator('#username').fill(process.env.TEST_CASHIER_USER||'juan');await cashier.locator('#password').fill(process.env.TEST_CASHIER_PASSWORD);await cashier.getByRole('button',{name:'Log in',exact:true}).click();await cashier.waitForURL('**/pos');}
  await cashier.getByRole('button',{name:'Open menu',exact:true}).click();const nav=cashier.locator('#navigation-drawer');await nav.waitFor({state:'visible'});
  assert.equal(await nav.locator('a').count(),2,'Cashier navigation keeps its existing role restrictions');
  await nav.getByRole('link',{name:'My Transactions',exact:true}).click();await cashier.waitForURL('**/transactions');await nav.waitFor({state:'hidden'});
  await contained(cashier,'cashier transactions');await cashierContext.close();console.log('PASS mobile cashier navigation');
  fs.writeFileSync(path.join(artifacts,process.env.RESPONSIVE_CASES?'additional-results.json':'results.json'),JSON.stringify(summary,null,2));console.log('Responsive checks passed at '+summary.length+' screen sizes; no production writes.');
 }finally{if(browser)await browser.close();backend?.kill();vite?.kill();}
})().catch(e=>{console.error(require('./safe-error.cjs')(e));process.exitCode=1;});
