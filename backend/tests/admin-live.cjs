// Read-only acceptance against the deployed API; no password reset or sale upload.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),origin='https://snack-time-pos.onrender.com';
(async()=>{
 const {ownerAccounts}=require('../utils/ownerCredentialVault');const account=ownerAccounts().find(a=>a.username==='admin');if(!account)throw Error('No protected owner test credential. Use a private terminal verification after choosing your password.');
 const {OfflineStore}=await import('../../frontend/src/offline/store.js'),{openTestDatabase}=await import('../../frontend/tests/offline/node-driver.mjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'snacktime-admin-live-')),file=path.join(dir,'offline.sqlite');let driver=openTestDatabase(file);
 try{
  const publicKey=JSON.parse(fs.readFileSync(path.join(root,'frontend/src/offline/server-public-key.json'))),store=new OfflineStore(driver,publicKey);await store.initialize();const device=(await store.status()).deviceId;
  const usernameLogin=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(account)});assert.equal(usernameLogin.status,200,'Administrator username login');
  const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://localhost'},body:JSON.stringify({username:'admin@foodtriphouse.com',password:account.password,offline_device_id:device})});assert.equal(response.status,200,'Administrator email login');assert.equal(response.headers.get('access-control-allow-origin'),'https://localhost');const auth=await response.json();assert.equal(auth.user.role,'admin');
  const headers={Authorization:'Bearer '+auth.token};assert.equal((await fetch(origin+'/api/users',{headers})).status,200);const bootstrapResponse=await fetch(origin+'/api/offline/bootstrap',{headers});assert.equal(bootstrapResponse.status,200);const snapshot=await bootstrapResponse.json();assert.equal(JSON.stringify(snapshot).includes('password_hash'),false);
  await store.enroll({password:account.password,alias:'admin@foodtriphouse.com',grant:auth.offline_authorization,snapshot});store.lock();driver.close();driver=openTestDatabase(file);const restarted=new OfflineStore(driver,publicKey);await restarted.initialize();
  await assert.rejects(restarted.login('admin@foodtriphouse.com','incorrect-test-input'),e=>e.status===401);
  const offline=await restarted.login('admin@foodtriphouse.com',account.password);assert.equal(offline.serverRole,'admin');assert.equal(offline.role,'cashier');assert.ok((await restarted.catalog('products')).length);restarted.lock();assert.equal((await restarted.login('admin',account.password)).serverRole,'admin');
  driver.close();driver=null;assert.equal(fs.readFileSync(file).includes(Buffer.from(account.password)),false);
  console.log('PASS existing administrator username/email login and administrator API access over HTTPS.');
  console.log('PASS Android origin, device-bound signed authorization, and administrator offline sign-in after SQLite restart.');
  console.log('PASS offline cash-POS scope, rejected wrong password, and no plaintext password stored in SQLite.');
 }finally{if(driver)driver.close();if(!path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep))throw Error('Unsafe test cleanup path');fs.rmSync(dir,{recursive:true,force:true});}
})().catch(()=>{console.error('Administrator acceptance failed. No password, password hash or token was logged.');process.exitCode=1;});
