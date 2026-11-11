// Read-only browser verification against the migrated PostgreSQL database.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const qa=process.env.TEST_QA_SITE;
const remote=process.env.TEST_REMOTE_SITE || qa;
if(remote){
  const url=new URL(remote);if(qa?remote!=='http://127.0.0.1:14815':url.protocol!=='https:'||!url.hostname.endsWith('.onrender.com'))throw Error('Remote acceptance requires the actual Render HTTPS origin or the isolated local QA listener.');
  const dotenv=require('../../backend/node_modules/dotenv');
  const accounts=require('../../backend/utils/ownerCredentialVault').ownerAccounts();
  process.env.TEST_ADMIN_PASSWORD=accounts.find(a=>a.username==='admin').password;
  process.env.TEST_CASHIER_PASSWORD=accounts.find(a=>a.username==='juan').password;
}
const api = remote || 'http://127.0.0.1:14800';
const site = remote || 'http://127.0.0.1:15179';
const artifacts = path.join(root, 'database/backups',qa?'release-20261111/qa-browser-verification':remote?'cloud-browser-verification':'browser-verification');
async function wait(url) {
  for(let i=0;i<120;i++){try{if((await fetch(url)).ok)return;}catch{} await new Promise(r=>setTimeout(r,250));}
  throw Error('Server did not start: '+url);
}
(async()=>{
 if(!process.env.TEST_ADMIN_PASSWORD)process.env.TEST_ADMIN_PASSWORD=await require('../../backend/utils/hiddenPrompt').hiddenPrompt('Administrator test password (hidden): ');
 if(!process.env.TEST_CASHIER_PASSWORD)process.env.TEST_CASHIER_PASSWORD=await require('../../backend/utils/hiddenPrompt').hiddenPrompt('Cashier test password (hidden): ');
  fs.mkdirSync(artifacts,{recursive:true});
  const backend=remote?null:spawn(process.execPath,[path.join(root,'backend/server.js')],{cwd:root,env:{...process.env,PORT:'14800',CLIENT_ORIGIN:site},stdio:'ignore',windowsHide:true});
  const vite=remote?null:spawn(process.execPath,[path.join(root,'frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','15179','--strictPort'],{cwd:path.join(root,'frontend'),env:{...process.env,VITE_API_URL:api+'/api'},stdio:'ignore',windowsHide:true});
  let browser;
  try{
    await Promise.all([wait(api+'/api/health'),wait(site)]);
    const health=await (await fetch(api+'/api/health')).json();assert.equal(health.database,'postgresql');
    if(qa)assert.match(health.database_id,/^qa:/,'Local release listener must use an isolated database identity');
    browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    page.setDefaultTimeout(60000);
    await page.route('https://fonts.googleapis.com/**',route=>route.abort());
    await page.route('https://fonts.gstatic.com/**',route=>route.abort());
    const errors=[],apiFailures=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/api/') && r.status()>=400)apiFailures.push(r.status()+' '+r.url());});
    // Prevent accidental writes by this smoke test. Login is the only permitted POST.
    await page.route('**/api/**',route=>{
      const req=route.request();
      if(req.method()!=='GET' && req.method()!=='OPTIONS' && !req.url().endsWith('/auth/login'))return route.abort();
      return route.continue();
    });
    await page.goto(site+'/login',{waitUntil:'domcontentloaded'});
    await page.locator('#username').fill(process.env.TEST_ADMIN_USER || 'admin');
    await page.locator('#password').fill(process.env.TEST_ADMIN_PASSWORD);
    await page.getByRole('button',{name:'SIGN IN',exact:true}).click();
    await page.waitForURL('**/dashboard');
    await page.locator('.recharts-pie-sector').first().waitFor();
    assert.ok(await page.locator('.recharts-pie-sector').count()>0,'Dashboard category pie must render NUMERIC values');
    await page.screenshot({path:path.join(artifacts,'dashboard.png'),fullPage:true});
    console.log('PASS: real login and dashboard charts');
    for(const section of ['products','inventory','users']){
      await page.goto(site+'/'+section,{waitUntil:'domcontentloaded'});
      await page.locator('.data-table tbody tr').first().waitFor();
      await page.waitForFunction(()=>!document.querySelector('.data-table tbody')?.textContent.includes('Loading...'));
      assert.ok(await page.locator('.data-table tbody tr').count()>0);
      if(section==='products' || section==='users'){
        await page.getByRole('button',{name:'Edit',exact:true}).first().click();
        await page.locator('.modal-box').waitFor();
        await page.getByRole('button',{name:'Close',exact:true}).click();
      }
      if(section==='inventory')await page.getByRole('button',{name:'Transaction History',exact:true}).click();
      console.log('PASS: '+section+' screen');
    }
    await page.goto(site+'/settings',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Save Settings'}).waitFor();
    assert.ok(await page.locator('input').first().inputValue());console.log('PASS: settings');
    await page.goto(site+'/transactions',{waitUntil:'domcontentloaded'});await page.getByRole('combobox',{name:'Transaction period',exact:true}).selectOption('all');
    await page.getByRole('button',{name:'View',exact:true}).first().click();await page.locator('.receipt').waitFor();
    assert.ok((await page.locator('.receipt').innerText()).includes('Order #: FH-'));
    await page.emulateMedia({media:'print'});assert.equal(await page.locator('.receipt').evaluate(e=>getComputedStyle(e).visibility),'visible');
    await page.pdf({path:path.join(artifacts,'historical-receipt.pdf'),width:'80mm',height:'250mm'});await page.emulateMedia({media:'screen'});
    console.log('PASS: historical receipt and print rendering');
    await page.goto(site+'/reports',{waitUntil:'domcontentloaded'});await page.locator('input[type=date]').fill('2026-10-01');await page.locator('.filter-row select').selectOption('monthly');
    await page.locator('.stat-card').first().waitFor();
    await page.emulateMedia({media:'print'});assert.equal(await page.locator('.report-print h2').evaluate(e=>getComputedStyle(e).visibility),'visible');
    await page.pdf({path:path.join(artifacts,'monthly-report.pdf'),format:'A4'});await page.emulateMedia({media:'screen'});console.log('PASS: reports and print rendering');
    await page.goto(site+'/pos',{waitUntil:'domcontentloaded'});await page.locator('.product-card').first().waitFor();
    await page.getByPlaceholder('Search products...').fill('Milk Tea');
    await page.locator('.product-card').first().click();await page.locator('.modal-box').waitFor();
    const groups=page.locator('.option-group');for(let i=0;i<await groups.count();i++)await groups.nth(i).locator('.option-choice:not(.disabled)').first().click();
    await page.getByRole('button',{name:/Add to Order/}).click();assert.equal(await page.locator('.cart-item').count(),1);
    await page.getByRole('button',{name:'Dine-In',exact:true}).click();await page.locator('#order-customer').fill('Browser verification only');await page.locator('#order-seating').fill('Unsubmitted draft');
    await page.getByRole('button',{name:'Takeout',exact:true}).click();assert.equal(await page.locator('#order-seating').count(),0);
    const senior=page.locator('#order-discount option').filter({hasText:'Senior Citizen / PWD'});assert.equal(await senior.count(),1);await page.locator('#order-discount').selectOption(await senior.getAttribute('value'));
    const money=text=>Number(text.replace(/[^0-9.]/g,''));const subtotalCents=Math.round(money(await page.locator('.summary-row').first().locator('span').last().textContent())*100);
    assert.equal(Math.round(money(await page.locator('.summary-row.total span').last().textContent())*100),subtotalCents-Math.round(subtotalCents*.2));
    for(const [width,height] of [[1440,1000],[768,1024],[393,852],[852,393]]){
      await page.setViewportSize({width,height});const drawer=width<760||(width<1200&&height<560);if(drawer&&!(await page.locator('.cart-panel').getAttribute('class')).includes('open'))await page.locator('.cart-fab').click();
      if(drawer){await page.locator('.cart-panel.open').waitFor();await page.locator('.cart-panel').evaluate(async panel=>{await Promise.all(panel.getAnimations().map(animation=>animation.finished.catch(()=>{})));});}
      const layout=await page.locator('.cart-panel').evaluate(panel=>{const list=panel.querySelector('.cart-items'),footer=panel.querySelector('.cart-summary');return {overflow:panel.scrollHeight-panel.clientHeight,horizontal:document.documentElement.scrollWidth-innerWidth,listBottom:list.getBoundingClientRect().bottom,footerTop:footer.getBoundingClientRect().top,footerBottom:footer.getBoundingClientRect().bottom};});
      assert.ok(layout.overflow<=1&&layout.horizontal<=1,`Compact live panel fits ${width}x${height}`);assert.ok(layout.listBottom<=layout.footerTop+1&&layout.footerBottom<=height+1,`Payment footer remains visible without overlapping products at ${width}x${height}: ${JSON.stringify(layout)}`);
      await page.screenshot({path:path.join(artifacts,`compact-pos-${width}.png`)});if(drawer)await page.locator('.cart-close').click();
    }
    await page.setViewportSize({width:1440,height:1000});console.log('PASS: live service types, Senior/PWD calculation and compact panel at desktop/tablet/phone/landscape sizes');
    await page.getByRole('button',{name:'Process Transaction',exact:false}).click();await page.getByText('Cash Received',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Cancel',exact:true}).click();console.log('PASS: customized cart, discount control and payment dialog');
    await page.getByRole('button',{name:'Log out',exact:false}).click();await page.waitForURL('**/login');
    await page.locator('#username').fill(process.env.TEST_CASHIER_USER || 'juan');await page.locator('#password').fill(process.env.TEST_CASHIER_PASSWORD);await page.getByRole('button',{name:'SIGN IN',exact:true}).click();await page.waitForURL('**/pos');
    assert.equal(await page.locator('.cart-item').count(),0,'Cart must not leak across users');
    await page.goto(site+'/products',{waitUntil:'domcontentloaded'});await page.waitForURL('**/pos');console.log('PASS: cashier role restrictions and logout cart cleanup');
    assert.deepEqual(errors,[]);assert.deepEqual(apiFailures,[]);
    console.log('Browser smoke passed with no JavaScript or API errors; no production writes performed.');
    if(remote)console.log('Administrator and cashier used their existing protected credentials; no password was changed.');
  }finally{if(browser)await browser.close();backend?.kill();vite?.kill();}
})().catch(e=>{console.error(require('./safe-error.cjs')(e));process.exitCode=1;});
