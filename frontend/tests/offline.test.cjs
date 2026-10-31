const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync,spawn}=require('node:child_process');
const PASSWORD='offline-test-password-not-real';
const worker=path.join(__dirname,'offline/restart-worker.mjs');
async function fixture(stock=10){
 const {OfflineStore}=await import('../src/offline/store.js');const {openTestDatabase}=await import('./offline/node-driver.mjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'snacktime-offline-')),database=path.join(dir,'pos.sqlite');
 const driver=openTestDatabase(database),pair=crypto.generateKeyPairSync('rsa',{modulusLength:2048}),publicKey=pair.publicKey.export({format:'jwk'});
 const store=new OfflineStore(driver,publicKey);await store.initialize();const device=(await store.status()).deviceId;
 const jwt=require('../../backend/node_modules/jsonwebtoken');
 function grant(id=1,overrides={}){return jwt.sign({device_id:device,user:{id,username:'cashier'+id,fullName:'Cashier '+id,role:'cashier'},scopes:['pos','own-orders'],...overrides},pair.privateKey,{algorithm:'RS256',issuer:'snacktime-pos',audience:'snacktime-offline',subject:String(id),expiresIn:'7d'});}
 const snapshot={schema_version:1,user_id:1,prepared_at:new Date().toISOString(),categories:[{id:1,name:'Snacks',slug:'snacks'}],ingredients:[{id:1,name:'Mix',unit:'g',current_stock:stock}],discounts:[{id:1,name:'20%',type:'percent',value:'20.00',active:1},{id:2,name:'10 off',type:'fixed',value:'10.00',active:1}],settings:{business_name:'Snack Time',receipt_footer:'Thank you'},orders:[],products:[{id:1,name:'Test snack',category_slug:'snacks',category_name:'Snacks',price:'10.10',available:1,track_stock:1,stock,recipe:[{ingredient_id:1,name:'Mix',unit:'g',current_stock:stock,quantity_required:'0.10'}],option_groups:[{id:1,name:'Flavor',is_required:1,selection_type:'single',options:[{id:1,name:'Chocolate',price_modifier:'0.20',ingredients:[{ingredient_id:1,quantity_required:'0.10',current_stock:stock,name:'Mix',unit:'g'}]},{id:2,name:'Vanilla',price_modifier:'0.00',ingredients:[]}]}]}]};
 await store.enroll({password:PASSWORD,alias:'cashier1',grant:grant(),snapshot});
 const request={request_id:crypto.randomUUID(),payment_method:'cash',cash_received:'100.00',discount_id:1,expected_total:'16.48',items:[{product_id:1,quantity:2,selected_option_ids:[1]}]};
 const cart={items:[{cartItemId:1,product:snapshot.products[0],selectedOptions:[{option_id:1,group_name:'Flavor',name:'Chocolate',price_modifier:'0.20'}],quantity:2,unitPrice:10.30,subtotal:20.60}],discount:snapshot.discounts[0],request_id:request.request_id};
 await store.draft(cart);
 const file=path.join(dir,'fixture.json');const data={database,publicKey,accounts:[{alias:'cashier1',request}]};fs.writeFileSync(file,JSON.stringify(data));
 return {store,driver,dir,file,data,snapshot,grant,PASSWORD,request,cart,cleanup(){try{driver.close();}catch{}fs.rmSync(dir,{recursive:true,force:true});}};
}
function child(f,mode,index=0){const r=spawnSync(process.execPath,[worker,f.file,mode,String(index)],{encoding:'utf8',env:{...process.env,OFFLINE_TEST_PASSWORD:PASSWORD}});return {code:r.status,...(r.stdout.trim()?JSON.parse(r.stdout.trim().split('\n').at(-1)):{})};}
function parallelChild(f,index){return new Promise((resolve,reject)=>{const c=spawn(process.execPath,[worker,f.file,'checkout',String(index)],{env:{...process.env,OFFLINE_TEST_PASSWORD:PASSWORD},windowsHide:true});let out='';c.stdout.on('data',d=>out+=d);c.on('error',reject);c.on('close',code=>resolve({code,...JSON.parse(out.trim().split('\n').at(-1))}));});}

test('cash receipt, cart, discounts and deductions survive separate application processes',async()=>{
 const f=await fixture();try{
  f.driver.close();const first=child(f,'checkout');assert.equal(first.code,0);assert.equal(first.receipt.total,16.48);assert.equal(first.receipt.change_amount,83.52);assert.equal(first.receipt.items[0].options[0].name,'Chocolate');
  const reopened=child(f,'read');assert.equal(reopened.code,0);assert.equal(reopened.orders.length,1);assert.deepEqual(reopened.orders[0],first.receipt);assert.equal(reopened.draft,null);assert.equal(reopened.movements,2);assert.equal(reopened.stock,960);
  const retry=child(f,'checkout');assert.equal(retry.receipt.id,first.receipt.id);assert.equal(child(f,'read').orders.length,1);assert.equal(child(f,'read').stock,960);
  assert.equal(fs.readFileSync(f.data.database).includes(Buffer.from(PASSWORD)),false,'No plaintext password in SQLite');
 }finally{f.cleanup();}
});
test('termination before commit recovers with no sale or deductions and the original draft',async()=>{
 const f=await fixture();try{f.driver.close();assert.equal(child(f,'interrupt').code,73);const r=child(f,'read');assert.equal(r.orders.length,0);assert.equal(r.movements,0);assert.equal(r.stock,1000);assert.equal(r.draft.request_id,f.request.request_id);assert.equal(child(f,'checkout').code,0);assert.equal(child(f,'read').orders.length,1);}finally{f.cleanup();}
});
test('a lost commit reply can be retried without a duplicate sale or deduction',async()=>{
 const f=await fixture();try{
  const transaction=f.driver.transaction;f.driver.transaction=async fn=>{await transaction(fn);throw Error('Commit reply lost');};
  await assert.rejects(f.store.checkout(f.request),/Commit reply lost/);f.driver.transaction=transaction;
  const receipt=await f.store.checkout(f.request);assert.ok(receipt.id.startsWith('local:'));assert.equal((await f.store.listOrders()).length,1);assert.equal((await f.driver.query('SELECT current_units FROM ingredients'))[0].current_units,960);
 }finally{f.cleanup();}
});
test('injected write error rolls back all financial and inventory changes',async()=>{
 const f=await fixture();try{const run=f.driver.run;f.driver.run=async(sql,args)=>{if(sql.startsWith('INSERT INTO inventory_movements'))throw Error('Disk write failure');return run(sql,args);};await assert.rejects(f.store.checkout(f.request),/Disk write failure/);assert.equal((await f.store.listOrders()).length,0);assert.equal((await f.driver.query('SELECT current_units FROM ingredients'))[0].current_units,1000);assert.equal((await f.store.draft()).request_id,f.request.request_id);f.driver.run=run;await f.store.checkout(f.request);assert.equal((await f.store.listOrders()).length,1);}finally{f.cleanup();}
});
test('offline grant signature, device binding, expiry and previous authorization are enforced',async()=>{
 const f=await fixture();try{
  await assert.rejects(f.store.enroll({password:PASSWORD,alias:'cashier1',grant:f.grant(1,{device_id:crypto.randomUUID()}),snapshot:f.snapshot}),/invalid or expired/);
  const parts=f.grant().split('.');parts[1]=Buffer.from(JSON.stringify({sub:'999'})).toString('base64url');await assert.rejects(f.store.enroll({password:PASSWORD,alias:'cashier1',grant:parts.join('.'),snapshot:f.snapshot}),/invalid or expired/);
  f.store.lock();await assert.rejects(f.store.login('unknown',PASSWORD),/previously authorized/);
  const original=f.store.now;f.store.now=()=>Date.now()+8*86400000;await assert.rejects(f.store.login('cashier1',PASSWORD),/invalid or expired/);f.store.now=original;
 }finally{f.cleanup();}
});
test('password attempt lockout survives restart and no session is trusted after reopening',async()=>{
 const f=await fixture();try{f.store.lock();for(let i=0;i<5;i++)await assert.rejects(f.store.login('cashier1','wrong'),/Invalid offline/);f.driver.close();const r=child(f,'read');assert.equal(r.status,429);const {OfflineStore}=await import('../src/offline/store.js'),{openTestDatabase}=await import('./offline/node-driver.mjs');const d=openTestDatabase(f.data.database),s=new OfflineStore(d,f.data.publicKey);try{await assert.rejects(s.listOrders(),/Sign in/);}finally{d.close();}}finally{f.cleanup();}
});
test('cash-only rules, prices, required options, duplicate ids and immutable receipts',async()=>{
 const f=await fixture();try{
  await assert.rejects(f.store.checkout({...f.request,payment_method:'gcash'}),/Only cash/);
  await assert.rejects(f.store.checkout({...f.request,cash_received:'1.00'}),/Insufficient/);
  await assert.rejects(f.store.checkout({...f.request,items:[{product_id:1,quantity:1,selected_option_ids:[]}]}),/Select/);
  await assert.rejects(f.store.checkout({...f.request,expected_total:'1.00'}),/Prices changed/);
  await f.store.checkout(f.request);await assert.rejects(f.store.checkout({...f.request,cash_received:'101.00'}),/different sale/);
  await assert.rejects(f.driver.run('DELETE FROM local_orders'),/cannot be deleted/);
  const current=await f.store.catalog('products');assert.equal(current[0].stock,8);assert.equal(current[0].recipe[0].current_stock,9.6);
 }finally{f.cleanup();}
});
test('new authorization cannot reset deducted stock or erase local sales',async()=>{
 const f=await fixture();try{await f.store.checkout(f.request);const result=await f.store.enroll({password:PASSWORD,alias:'cashier1',grant:f.grant(),snapshot:f.snapshot});assert.equal(result.retainedStock,true);assert.equal((await f.store.catalog('products'))[0].stock,8);assert.equal((await f.store.listOrders()).length,1);}finally{f.cleanup();}
});
test('local history is scoped to the authorized cashier and receipts keep their original settings',async()=>{
 const f=await fixture();try{
  const receipt=await f.store.checkout(f.request);await f.store.enroll({password:PASSWORD,alias:'cashier2',grant:f.grant(2),snapshot:{...f.snapshot,user_id:2,settings:{business_name:'Changed name'},orders:[]}});
  assert.equal((await f.store.listOrders()).length,0);await assert.rejects(f.store.order(receipt.id),/not found/);await assert.rejects(f.store.draft(f.cart,1),/cashier changed/);
  await f.store.login('cashier1',PASSWORD);assert.equal((await f.store.order(receipt.id)).receipt_settings.business_name,'Snack Time');
 }finally{f.cleanup();}
});
test('online renewal changes the local password verifier without resetting stock or sales',async()=>{
 const f=await fixture();try{
  await f.store.checkout(f.request);await f.store.renew({password:'new-offline-password',alias:'cashier1',grant:f.grant()});
  f.store.lock();await assert.rejects(f.store.login('cashier1',PASSWORD),/Invalid offline/);await f.store.login('cashier1','new-offline-password');assert.equal((await f.store.listOrders()).length,1);assert.equal((await f.store.catalog('products'))[0].stock,8);
 }finally{f.cleanup();}
});
test('two application processes cannot oversell the same final product',async()=>{
 const f=await fixture(1);try{
  f.request.items[0].quantity=1;f.request.expected_total='8.24';await f.store.draft({...f.cart,request_id:f.request.request_id});
  const second={...f.request,request_id:crypto.randomUUID()};await f.store.enroll({password:PASSWORD,alias:'cashier2',grant:f.grant(2),snapshot:{...f.snapshot,user_id:2}});await f.store.draft({...f.cart,request_id:second.request_id});
  f.data.accounts[0].request=f.request;f.data.accounts.push({alias:'cashier2',request:second});fs.writeFileSync(f.file,JSON.stringify(f.data));f.driver.close();
  const results=await Promise.all([parallelChild(f,0),parallelChild(f,1)]);assert.equal(results.filter(r=>r.code===0).length,1);assert.equal(results.filter(r=>r.error?.startsWith('Insufficient Stock')).length,1);
 }finally{f.cleanup();}
});
