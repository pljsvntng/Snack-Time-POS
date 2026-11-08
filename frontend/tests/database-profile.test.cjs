const test=require('node:test'),assert=require('node:assert/strict');
test('presentation storage is distinct from the original file and rejects path-like profiles',async()=>{
 const {databaseName,assertDatabaseIdentity}=await import('../src/offline/database-profile.js');
 assert.equal(databaseName(),'snack_time_offline');
 assert.equal(databaseName('demo_bitter_salad_90425468'),'snack_time_offline_demo_bitter_salad_90425468');
 for(const profile of ['../snack_time_offline','demo_../old','demo_/old','production','demo_'])assert.throws(()=>databaseName(profile));
 assert.doesNotThrow(()=>assertDatabaseIdentity('demo:expected','demo:expected'));
 assert.throws(()=>assertDatabaseIdentity('original','demo:expected'),/Keep app data intact/);
});
test('a new demo profile never generates a replacement key when any older database artifacts exist',async()=>{
 const {openSecureAndroidConnection}=await import('../src/offline/secure-android-open.js');let generated=false;
 const sqlite={isInConfigEncryption:async()=>({result:true}),checkConnectionsConsistency:async()=>{},isDatabase:async()=>({result:false}),isSecretStored:async()=>({result:false}),setEncryptionSecret:async()=>{generated=true;}};
 const diagnostics={record:async()=>{},inspectState:async()=>({databasePresent:false,walPresent:false,journalPresent:false,anyDatabaseArtifacts:true})};
 await assert.rejects(openSecureAndroidConnection(sqlite,diagnostics,{database:'snack_time_offline_demo_bitter_salad_90425468'}),e=>e.storageCode==='MISSING_KEY');assert.equal(generated,false);
});
test('demo storage reuses the existing protected secret and opens only the new named encrypted file',async()=>{
 const {openSecureAndroidConnection}=await import('../src/offline/secure-android-open.js');const name='snack_time_offline_demo_bitter_salad_90425468',opened=[];
 const db={isDBOpen:async()=>({result:false}),open:async()=>{},close:async()=>{},query:async sql=>({values:sql.includes('cipher_status')?[{cipher_status:1}]:[{schema_entries:1}]}),execute:async()=>{}};
 const sqlite={isInConfigEncryption:async()=>({result:true}),checkConnectionsConsistency:async()=>{},isDatabase:async value=>{assert.equal(value,name);return {result:false};},isSecretStored:async()=>({result:true}),setEncryptionSecret:async()=>{throw Error('Key rotation forbidden');},isConnection:async()=>({result:false}),createConnection:async(...args)=>{opened.push(args);return db;},isDatabaseEncrypted:async value=>{assert.equal(value,name);return {result:true};}};
 await openSecureAndroidConnection(sqlite,{record:async()=>{}},{database:name});assert.deepEqual(opened,[[name,true,'secret',2,false]]);
});
