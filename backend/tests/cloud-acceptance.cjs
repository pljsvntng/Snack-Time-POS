// Explicitly run against an isolated Neon QA endpoint, never production.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),dotenv=require('dotenv');
const root=path.resolve(__dirname,'../..');
const privateEnv=dotenv.parse(fs.readFileSync(path.join(root,'backend/.env.render')));
// Branches can retain older owner password hashes. Use isolated QA identities;
// verify actual production identities separately with read-only live tests.
const accounts=[];
const qaHost=process.env.POS_QA_HOST,productionUrl=new URL(privateEnv.DATABASE_URL);
if(!qaHost||!qaHost.endsWith('.neon.tech')||qaHost===productionUrl.hostname||qaHost.replace('-pooler','')===productionUrl.hostname.replace('-pooler',''))throw Error('A separate POS_QA_HOST Neon test branch is required.');
const qaUrl=new URL(productionUrl);qaUrl.hostname=qaHost;
const {Pool,options}=require('../config/postgresql');
process.env.DATABASE_URL=productionUrl.href;const production=new Pool(options());
process.env.DATABASE_URL=qaUrl.href;const qa=new Pool(options());
const base='http://127.0.0.1:14805',suffix=crypto.randomUUID().slice(0,8);
let server,log;
async function start(){
 const dir=path.join(root,'database/backups/cloud-acceptance');fs.mkdirSync(dir,{recursive:true});log=fs.openSync(path.join(dir,'qa-server.log'),'a');
 server=spawn(process.execPath,[path.join(root,'backend/scripts/cloud-start.js')],{cwd:root,env:{...process.env,...privateEnv,DATABASE_URL:qaUrl.href,PORT:'14805'},stdio:['ignore',log,log],windowsHide:true});
 for(let n=0;n<480;n++){if(server.exitCode!==null)throw Error('QA server failed; inspect the private qa-server.log.');try{if((await fetch(base+'/api/health',{signal:AbortSignal.timeout(1000)})).ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}
 throw Error('QA server did not become ready.');
}
async function stop(){if(server&&server.exitCode===null){server.kill();await new Promise(resolve=>{server.once('exit',resolve);setTimeout(resolve,3000);});}if(log!==undefined){fs.closeSync(log);log=undefined;}try{await fetch(base+'/api/health',{signal:AbortSignal.timeout(1000)});throw Error('QA listener survived process shutdown.');}catch(e){if(e.message==='QA listener survived process shutdown.')throw e;}}
async function request(route,method='GET',body,token,status=200){
 const response=await fetch(base+'/api'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 const data=await response.json();assert.equal(response.status,status,method+' '+route+': '+(data.error||response.status));return data;
}
async function snapshot(pool){const client=await pool.connect();try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const data=await require('../scripts/migrate-neon').fingerprint(client);await client.query('COMMIT');return data;}finally{client.release();}}
(async()=>{
 const before=await snapshot(production),checks=[];
 try{
  for(const role of ['admin','cashier']){const username='qa_'+role+'_'+suffix,password=crypto.randomBytes(24).toString('base64url'),hash=await require('bcrypt').hash(password,12);await qa.query('INSERT INTO users(role_id,full_name,username,password_hash) VALUES((SELECT id FROM roles WHERE name=$1),$2,$3,$4)',[role,'Cloud QA '+role,username,hash]);accounts.push({label:role==='admin'?'admin':'juan',username,password});}
  await start();
  const login=async username=>{const account=accounts.find(a=>a.label===username);assert.ok(account);return request('/auth/login','POST',{username:account.username,password:account.password});};
  const admin=(await login('admin')).token,cashier=(await login('juan')).token;
  await request('/auth/login','POST',{username:'admin',password:'wrong'},null,401);await request('/users','GET',undefined,cashier,403);
  for(const route of ['/auth/me','/categories','/products','/inventory','/inventory/transactions','/orders','/users','/discounts','/settings','/reports/dashboard','/reports/daily','/reports/weekly','/reports/monthly'])await request(route,'GET',undefined,admin);
  checks.push('online login, roles and every read-only POS/admin/report endpoint');
  const category=await request('/categories','POST',{name:'Cloud QA '+suffix},admin,201);
  const ingredient=await request('/inventory','POST',{name:'QA ingredient '+suffix,unit:'g',current_stock:20,min_stock:1,cost_per_unit:0.15},admin,201);
  const adjusted=await request('/inventory/adjust','POST',{ingredient_id:ingredient.id,type:'add',quantity:5,reason:'Isolated cloud acceptance'},admin);assert.equal(adjusted.new_stock,'25.00');
  const product=await request('/products','POST',{category_id:category.id,name:'QA product '+suffix,price:12.35,track_stock:true,stock:5,low_stock_threshold:1},admin,201);
  await request('/products/'+product.id+'/recipe','PUT',{items:[{ingredient_id:ingredient.id,quantity_required:2.5}]},admin);
  assert.equal((await request('/products?search='+encodeURIComponent(suffix),'GET',undefined,admin)).length,1);
  checks.push('category/product creation, search, direct stock, fractional inventory and recipes');
  const sale=extra=>({items:[{product_id:product.id,quantity:1,selected_option_ids:[]}],payment_method:'cash',cash_received:50,...extra});
  const cash=await request('/orders','POST',sale({items:[{product_id:product.id,quantity:2}],discount_id:1,expected_total:19.76}),cashier,201);
  assert.equal(cash.total,19.76);assert.equal(cash.discount_amount,4.94);assert.equal(cash.change_amount,30.24);
  let stock=(await qa.query('SELECT current_stock FROM ingredients WHERE id=$1',[ingredient.id])).rows[0];assert.equal(stock.current_stock,'20.00');
  assert.equal((await request('/products/'+product.id,'GET',undefined,cashier)).stock,3);
  const gcash=await request('/orders','POST',sale({payment_method:'gcash',cash_received:undefined,discount_id:2,expected_total:2.35}),cashier,201);assert.equal(gcash.total,2.35);
  const other=await request('/orders','POST',sale({payment_method:'other',cash_received:undefined}),cashier,201);assert.equal(other.total,12.35);
  const race=await Promise.all([1,2].map(async()=>{const r=await fetch(base+'/api/orders',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+cashier},body:JSON.stringify(sale({}))});return r.status;}));assert.deepEqual(race.sort(),[201,400]);
  const {rows:[rollbackBefore]}=await qa.query('SELECT COUNT(*)::int count FROM orders');await request('/orders','POST',sale({}),cashier,400);const {rows:[rollbackAfter]}=await qa.query('SELECT COUNT(*)::int count FROM orders');assert.equal(rollbackAfter.count,rollbackBefore.count);
  stock=(await qa.query('SELECT current_stock FROM ingredients WHERE id=$1',[ingredient.id])).rows[0];assert.equal(stock.current_stock,'12.50');
  const detail=await request('/orders/'+cash.id,'GET',undefined,cashier);assert.equal(detail.items[0].product_name,'QA product '+suffix);assert.equal(detail.discount_amount,'4.94');
  checks.push('cash/GCash/other tender, percent/fixed discounts, exact change, atomic deductions, receipts, history and concurrent stock exhaustion');
  const customizable=(await request('/products','GET',undefined,admin)).find(p=>p.id===2);assert.ok(customizable);
  const options=customizable.option_groups.filter(g=>g.is_required).map(g=>g.options[0].id);
  const custom=await request('/orders','POST',{items:[{product_id:customizable.id,quantity:1,selected_option_ids:options}],payment_method:'cash',cash_received:1000},cashier,201);
  assert.ok((await request('/orders/'+custom.id,'GET',undefined,cashier)).items[0].options.length);
  await request('/products/'+product.id,'DELETE',undefined,admin);await request('/products/'+product.id,'GET',undefined,admin,404);await request('/products/'+product.id+'/restore','PATCH',{},admin);
  const settings=await request('/settings','GET',undefined,admin);await request('/settings','PUT',{receipt_footer:'Cloud QA receipt'},admin);assert.equal((await request('/settings','GET',undefined,admin)).receipt_footer,'Cloud QA receipt');await request('/settings','PUT',{receipt_footer:settings.receipt_footer},admin);
  const pw=crypto.randomBytes(20).toString('base64url'),name='qa_'+suffix;
  const user=await request('/users','POST',{full_name:'Cloud QA',username:name,password:pw,role:'cashier'},admin,201);
  const signed=await request('/auth/login','POST',{username:name,password:pw});assert.equal((await request('/orders','GET',undefined,signed.token)).length,0);
  await request('/orders/'+cash.id,'GET',undefined,signed.token,404);await request('/users/'+user.id,'PUT',{password:crypto.randomBytes(20).toString('base64url')},admin);await request('/products','GET',undefined,signed.token,401);
  checks.push('product options, restore, business settings, user creation/password reset and cashier history isolation');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=','base64');const form=new FormData();form.append('image',new Blob([png],{type:'image/png'}),'cloud-qa.png');
  const uploaded=await fetch(base+'/api/products/'+product.id+'/image',{method:'POST',headers:{Authorization:'Bearer '+admin},body:form});assert.equal(uploaded.status,200);const {image}=await uploaded.json();await stop();await start();assert.deepEqual(Buffer.from(await (await fetch(base+image)).arrayBuffer()),png);
  await request('/products/'+product.id+'/image','DELETE',undefined,admin);assert.equal((await request('/products/'+product.id,'GET',undefined,admin)).image,null);
  const device=crypto.randomUUID(),account=accounts.find(a=>a.label==='juan');const auth=await request('/auth/login','POST',{username:account.username,password:account.password,offline_device_id:device});
  const jwk=JSON.parse(fs.readFileSync(path.join(root,'frontend/src/offline/server-public-key.json')));const grant=require('jsonwebtoken').verify(auth.offline_authorization,crypto.createPublicKey({key:jwk,format:'jwk'}),{algorithms:['RS256'],issuer:'snacktime-pos',audience:'snacktime-offline'});assert.equal(grant.device_id,device);
  const bootstrap=await request('/offline/bootstrap','GET',undefined,auth.token);assert.ok(bootstrap.orders.every(o=>o.user_id===grant.user.id));assert.equal(JSON.stringify(bootstrap).includes('password_hash'),false);
  checks.push('PostgreSQL photos survive server restart; signed device authorization and private offline catalog bootstrap');
  const after=await snapshot(production);require('../scripts/migrate-neon').compare(before,after);
  const report={verifiedAt:new Date().toISOString(),qaHost,productionUnchanged:true,checks};fs.writeFileSync(path.join(root,'database/backups/cloud-acceptance/report.json'),JSON.stringify(report,null,2));
  for(const check of checks)console.log('PASS '+check);console.log('Neon cloud acceptance passed; production data unchanged.');
 }finally{await stop();await qa.end();await production.end();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
