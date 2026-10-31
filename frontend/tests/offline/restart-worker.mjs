import fs from 'node:fs';
import { OfflineStore } from '../../src/offline/store.js';
import { openTestDatabase } from './node-driver.mjs';
const fixture=JSON.parse(fs.readFileSync(process.argv[2]));const mode=process.argv[3],account=fixture.accounts[Number(process.argv[4]||0)];
const driver=openTestDatabase(fixture.database),store=new OfflineStore(driver,fixture.publicKey);
try{
 await store.initialize();await store.login(account.alias,process.env.OFFLINE_TEST_PASSWORD);
 if(mode==='interrupt'){
  const run=driver.run;driver.run=async(sql,values)=>{const result=await run(sql,values);if(sql.startsWith('INSERT INTO inventory_movements'))process.exit(73);return result;};
 }
 if(mode==='checkout'||mode==='interrupt'){
  const receipt=await store.checkout(account.request);console.log(JSON.stringify({receipt}));
  // Exit without closing SQLite: model termination immediately after a committed checkout.
  process.exit(0);
 }
 console.log(JSON.stringify({orders:await store.listOrders(),draft:await store.draft(),movements:(await driver.query('SELECT COUNT(*) count FROM inventory_movements'))[0].count,stock:(await driver.query('SELECT current_units FROM ingredients WHERE id=1'))[0].current_units}));
 driver.close();
}catch(e){console.log(JSON.stringify({error:e.message,status:e.status}));try{driver.close();}catch{}process.exitCode=2;}
