const test=require('node:test'),assert=require('node:assert/strict');
function fixture({exists=false,secret=false,persisted=false,status=1,config=true}={}){
 const events=[],records=[],financial={orders:[{id:'existing-sale',total:12345}],pending:['existing-sale']};let opened=false,creates=0,writes=0;
 const db={isDBOpen:async()=>({result:opened}),open:async()=>{events.push('open');opened=true;},close:async()=>{events.push('close');opened=false;},
  query:async sql=>{events.push(sql);if(sql.startsWith('PRAGMA cipher_status'))return {values:[{cipher_status:status}]};return {values:[{schema_entries:2}]};},
  execute:async sql=>{assert.equal(status,1,'Never write through an unkeyed handle');assert.ok(sql.startsWith('CREATE TABLE IF NOT EXISTS _snacktime_storage_guard'));events.push('materialize');writes++;persisted=true;exists=true;}};
 const sqlite={isInConfigEncryption:async()=>({result:config}),checkConnectionsConsistency:async()=>{},isDatabase:async()=>({result:exists}),isSecretStored:async()=>({result:secret}),setEncryptionSecret:async key=>{assert.ok(key.length>32);creates++;secret=true;},isConnection:async()=>({result:false}),createConnection:async(name,encrypted,mode,version,readonly)=>{assert.deepEqual([name,encrypted,mode,version,readonly],['snack_time_offline',true,'secret',2,false]);return db;},isDatabaseEncrypted:async()=>{events.push('file_probe');assert.equal(opened,false,'Independent probe must run after close/checkpoint');return {result:persisted};},closeConnection:async()=>{opened=false;events.push('cleanup');},deleteDatabase:async()=>{throw Error('Deleting a database is forbidden');},clearEncryptionSecret:async()=>{throw Error('Resetting keys is forbidden');}};
 const diagnostics={record:async r=>records.push({...r}),inspectState:async()=>({databasePresent:exists,walPresent:false,journalPresent:false})};
 return {db,sqlite,diagnostics,events,records,financial,get creates(){return creates},get writes(){return writes}};
}
test('fresh native startup verifies keyed encryption, materializes the first page, then verifies the closed file',async()=>{
 const {openSecureAndroidConnection}=await import('../src/offline/secure-android-open.js'),f=fixture();await openSecureAndroidConnection(f.sqlite,f.diagnostics);assert.equal(f.creates,1);assert.equal(f.writes,1);assert.ok(f.events.indexOf('materialize')<f.events.indexOf('file_probe'));assert.ok(f.events.indexOf('close')<f.events.indexOf('file_probe'));assert.equal(f.events.filter(e=>e==='open').length,2);assert.deepEqual(f.records.at(-1),{stage:'ready',code:'OK'});
});
test('the failed previous launch can leave an empty file and stored key; retry reuses that key',async()=>{
 const {openSecureAndroidConnection}=await import('../src/offline/secure-android-open.js'),f=fixture({exists:true,secret:true});await openSecureAndroidConnection(f.sqlite,f.diagnostics);assert.equal(f.creates,0);assert.equal(f.writes,1);
});
test('existing encrypted financial data and pending deliveries are preserved without key rotation',async()=>{
 const {openSecureAndroidConnection}=await import('../src/offline/secure-android-open.js'),f=fixture({exists:true,secret:true,persisted:true}),before=JSON.stringify(f.financial);await openSecureAndroidConnection(f.sqlite,f.diagnostics);assert.equal(f.creates,0);assert.equal(JSON.stringify(f.financial),before);assert.equal(f.records.some(r=>Object.keys(r).some(k=>!['stage','code'].includes(k))),false);
});
test('missing key for existing database or orphan WAL fails closed without replacing it',async()=>{
 const {openSecureAndroidConnection}=await import('../src/offline/secure-android-open.js');for(const wal of [false,true]){const f=fixture({exists:!wal});if(wal)f.diagnostics.inspectState=async()=>({databasePresent:false,walPresent:true,journalPresent:false});await assert.rejects(openSecureAndroidConnection(f.sqlite,f.diagnostics),e=>e.storageCode==='MISSING_KEY');assert.equal(f.creates,0);assert.equal(f.writes,0);}
});
test('encryption configuration, unkeyed handles and failed persisted-file verification never permit POS access',async()=>{
 const {openSecureAndroidConnection}=await import('../src/offline/secure-android-open.js');for(const [settings,code] of [[{config:false},'CONFIG_DISABLED'],[{status:0},'HANDLE_UNKEYED']]){const f=fixture(settings);await assert.rejects(openSecureAndroidConnection(f.sqlite,f.diagnostics),e=>e.storageCode===code);assert.equal(f.writes,0);}const f=fixture({exists:true,secret:true});f.sqlite.isDatabaseEncrypted=async()=>({result:false});await assert.rejects(openSecureAndroidConnection(f.sqlite,f.diagnostics),e=>e.storageCode==='FILE_NOT_ENCRYPTED');assert.ok(f.events.includes('cleanup'));assert.equal(f.creates,0);
});
test('bridge errors are replaced by safe diagnostics; raw native errors and secrets are never returned',async()=>{
 const {openSecureAndroidConnection}=await import('../src/offline/secure-android-open.js'),f=fixture();f.db.open=async()=>{throw Error('synthetic private token or key');};await assert.rejects(openSecureAndroidConnection(f.sqlite,f.diagnostics),e=>e.storageCode==='NATIVE_FAILURE'&&!e.message.includes('synthetic'));assert.equal(JSON.stringify(f.records).includes('synthetic'),false);
});
test('missing or malformed SQLCipher confirmation fails closed before any database write',async()=>{
 const {openSecureAndroidConnection}=await import('../src/offline/secure-android-open.js');for(const response of [{values:[]},{values:[{cipher_status:0}]},{values:[{other:1}]},{}]){const f=fixture();f.db.query=async()=>response;await assert.rejects(openSecureAndroidConnection(f.sqlite,f.diagnostics),e=>e.storageCode==='HANDLE_UNKEYED');assert.equal(f.writes,0);}
});
test('storage initialization uses query for result-returning PRAGMAs supported by Android',async()=>{
 const {OfflineStore}=await import('../src/offline/store.js'),{openTestDatabase}=await import('./offline/node-driver.mjs'),driver=openTestDatabase(':memory:'),execute=driver.execute;
 driver.execute=async sql=>{assert.equal(/journal_mode|busy_timeout/.test(sql),false,'Result-returning PRAGMA must not use Android execSQL');return execute(sql);};
 try{const store=new OfflineStore(driver,{});await store.initialize();assert.equal((await driver.query('PRAGMA busy_timeout'))[0].timeout,5000);assert.equal((await driver.query('PRAGMA foreign_keys'))[0].foreign_keys,1);}finally{driver.close();}
});
