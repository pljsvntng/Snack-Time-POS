import {OfflineStore} from './store.js';
// Coalesce startup calls. A failed open can be retried without deleting storage.
export function createStoreLoader(openDriver,publicKey){
 let pending;
 return ()=>{
  if(!pending)pending=(async()=>{let driver;try{driver=await openDriver();const store=new OfflineStore(driver,publicKey);await store.initialize();return store;}catch(e){try{await driver?.close?.();}catch{}throw e;}})().catch(e=>{pending=null;throw e;});
  return pending;
 };
}
