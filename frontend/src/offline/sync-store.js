import {scaled,verifyGrant,offlineError} from './security.js';
export class SyncStore {
 async backfillOutbox(){
  const rows=await this.db.query('SELECT o.* FROM local_orders o LEFT JOIN sync_outbox s ON s.order_id=o.id WHERE s.order_id IS NULL ORDER BY o.rowid');
  for(const row of rows){
   const receipt=JSON.parse(row.receipt_json),movements=await this.db.query('SELECT kind,entity_id,quantity_units FROM inventory_movements WHERE order_id=?',[row.id]);
   const payload={protocol_version:0,client_id:row.request_id,device_id:row.device_id,receipt,movements};
   await this.db.run('INSERT INTO sync_outbox(order_id,user_id,payload_json) VALUES(?,?,?)',[row.id,row.user_id,JSON.stringify(payload)]);
  }
  await this.db.run("UPDATE sync_outbox SET state='pending' WHERE state='uploading'");
 }
 async enqueue(receipt,request){
  const catalogId=await this.getMeta('sync_catalog_id');
  const grant=(await this.db.query('SELECT grant_jwt FROM authorized_users WHERE user_id=?',[receipt.user_id]))[0].grant_jwt;
  const movements=await this.db.query('SELECT kind,entity_id,quantity_units FROM inventory_movements WHERE order_id=?',[receipt.id]);
  const payload={protocol_version:catalogId?1:0,device_id:await this.getMeta('device_id'),client_id:request.request_id,catalog_id:catalogId,proof_grant:grant,request,receipt,movements};
  await this.db.run('INSERT INTO sync_outbox(order_id,user_id,payload_json) VALUES(?,?,?)',[receipt.id,receipt.user_id,JSON.stringify(payload)]);
 }
 async syncStatus(){return this.exclusive(async()=>{
  const rows=await this.db.query('SELECT state,COUNT(*) count FROM sync_outbox GROUP BY state'),counts=Object.fromEntries(rows.map(r=>[r.state,r.count]));
  return {pending:rows.filter(r=>r.state!=='synced').reduce((n,r)=>n+r.count,0),review:counts.review_required||0,blocked:counts.blocked||0,authRequired:counts.auth_required||0,lastSuccess:await this.getMeta('sync_last_success'),catalogAt:await this.getMeta('prepared_at'),catalogDeferred:await this.getMeta('sync_catalog_deferred',false),catalogError:await this.getMeta('sync_catalog_error')};
 });}
 async deliveryRows({retry=false}={}){return this.exclusive(async()=>{
  if(retry)await this.db.run("UPDATE sync_outbox SET state='pending',next_attempt_ms=0,error=NULL WHERE state IN ('blocked','auth_required')");
  const rows=await this.db.query("SELECT s.*,u.grant_jwt,u.revoked FROM sync_outbox s JOIN authorized_users u ON u.user_id=s.user_id WHERE state IN ('pending','review_required') ORDER BY sequence LIMIT 25");
  return rows.map(r=>({...r,payload:JSON.parse(r.payload_json)}));
 });}
 async deliveryAttempt(orderId){return this.exclusive(()=>this.db.run("UPDATE sync_outbox SET state='uploading',attempts=attempts+1,last_attempt_ms=? WHERE order_id=? AND state<>'synced'",[this.now(),orderId]));}
 async deliveryFailure(orderId,{state='pending',message='Synchronization failed.',retryAt=0}={}){return this.exclusive(()=>this.db.run("UPDATE sync_outbox SET state=?,error=?,next_attempt_ms=? WHERE order_id=? AND state<>'synced'",[state,message.slice(0,300),retryAt,orderId]));}
 async acknowledge(orderId,ack){return this.exclusive(()=>this.db.transaction(async()=>{
  const row=(await this.db.query('SELECT payload_json FROM sync_outbox WHERE order_id=?',[orderId]))[0];if(!row)throw offlineError('Queued sale not found.');const body=JSON.parse(row.payload_json);
  if(ack.client_id!==body.client_id||ack.device_id!==body.device_id||!['synced','review_required'].includes(ack.status)||ack.status==='synced'&&(!Number.isSafeInteger(ack.server_order_id)||ack.server_order_id<1||!ack.server_order_number||!Number.isFinite(Date.parse(ack.synced_at))))throw offlineError('Server acknowledgment did not match this sale.');
  await this.db.run('UPDATE sync_outbox SET state=?,ack_json=?,synced_at=?,error=NULL,next_attempt_ms=0 WHERE order_id=?',[ack.status,JSON.stringify(ack),ack.synced_at||null,orderId]);
  if(ack.status==='synced')await this.setMeta('sync_last_success',ack.synced_at);
 }));}
 async decorateOrders(orders){
  const rows=await this.db.query('SELECT order_id,state,ack_json,error FROM sync_outbox'),delivery=new Map(rows.map(r=>[r.order_id,r]));
  return orders.map(order=>{const row=delivery.get(order.id);if(!row)return order;const ack=row.ack_json?JSON.parse(row.ack_json):null;
   return {...order,sync_status:row.state,...(row.error?{sync_error:row.error}:{}),...(ack?{server_order_id:ack.server_order_id,server_order_number:ack.server_order_number,synced_at:ack.synced_at,inventory_conflicts:ack.conflict_count}: {})};
  });
 }
 async cacheSnapshot(snapshot){
  for(const o of snapshot.orders||[])if(o.user_id===snapshot.user_id)await this.db.run('INSERT INTO cached_orders(id,user_id,data_json) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json',[`server:${o.id}`,o.user_id,JSON.stringify({...o,id:`server:${o.id}`,source:'server-cache'})]);
  const total=(await this.db.query('SELECT COUNT(*) count FROM local_orders'))[0].count;
  if(!snapshot.sync_catalog_id&&total)return {retainedStock:true};
  const drafts=await this.db.query('SELECT data_json FROM drafts');
  if(drafts.some(d=>JSON.parse(d.data_json).items?.length)){await this.setMeta('sync_catalog_deferred',true);return {retainedStock:true,deferred:true};}
  // Subtract every unacknowledged local deduction from the server snapshot.
  // A lost acknowledgment can temporarily understate stock, never erase a sale.
  const pending=await this.db.query("SELECT m.kind,m.entity_id,SUM(m.quantity_units) units FROM inventory_movements m JOIN sync_outbox s ON s.order_id=m.order_id WHERE s.state<>'synced' GROUP BY m.kind,m.entity_id");
  const needs=new Map(pending.map(m=>[m.kind+':'+m.entity_id,m.units]));
  for(const table of ['products','ingredients','categories','discounts','settings'])await this.db.run('DELETE FROM '+table);
  for(const p of snapshot.products)await this.db.run('INSERT INTO products(id,data_json,stock_quantity) VALUES(?,?,?)',[p.id,JSON.stringify(p),p.track_stock?Math.max(0,Number(p.stock||0)-(needs.get('product:'+p.id)||0)):null]);
  for(const i of snapshot.ingredients)await this.db.run('INSERT INTO ingredients(id,name,unit,current_units) VALUES(?,?,?,?)',[i.id,i.name,i.unit,Math.max(0,scaled(i.current_stock,'stock')-(needs.get('ingredient:'+i.id)||0))]);
  for(const c of snapshot.categories)await this.db.run('INSERT INTO categories(id,data_json) VALUES(?,?)',[c.id,JSON.stringify(c)]);
  for(const d of snapshot.discounts)await this.db.run('INSERT INTO discounts(id,data_json) VALUES(?,?)',[d.id,JSON.stringify(d)]);
  for(const [key,value] of Object.entries(snapshot.settings))await this.db.run('INSERT INTO settings(key,value) VALUES(?,?)',[key,String(value)]);
  await this.setMeta('prepared_at',snapshot.prepared_at);await this.setMeta('sync_catalog_id',snapshot.sync_catalog_id||null);await this.setMeta('sync_catalog_expires_at',snapshot.sync_catalog_expires_at||null);await this.setMeta('sync_catalog_deferred',false);await this.setMeta('sync_catalog_error',null);
  return {retainedStock:pending.length>0};
 }
 async catalogCredential(){return this.exclusive(async()=>{
  const device=await this.getMeta('device_id');for(const row of await this.db.query('SELECT grant_jwt FROM authorized_users WHERE revoked=0 ORDER BY CASE WHEN user_id=? THEN 0 ELSE 1 END,user_id',[this.session?.user.id||0]))try{const claims=await verifyGrant(row.grant_jwt,this.publicKey,device,await this.clock());if(claims.scopes.includes('catalog-refresh'))return {grant:row.grant_jwt,userId:claims.user.id,deviceId:device};}catch{}
  return null;
 });}
 async refreshCatalog(snapshot,credential){return this.exclusive(async()=>{
  const claims=await verifyGrant(credential.grant,this.publicKey,await this.getMeta('device_id'),await this.clock());
  if(!claims.scopes.includes('catalog-refresh')||snapshot.user_id!==claims.user.id||!snapshot.sync_catalog_id)throw offlineError('Catalog authorization changed.',401);
  return this.db.transaction(()=>this.cacheSnapshot(snapshot));
 });}
 async catalogFailure(message){return this.exclusive(()=>this.setMeta('sync_catalog_error',message.slice(0,300)));}
 async wakeDeliveries(userId){return this.exclusive(()=>this.db.run("UPDATE sync_outbox SET state='pending',next_attempt_ms=0,error=NULL WHERE state='auth_required' AND user_id=?",[userId]));}
 async requireReauthorization(userId){return this.exclusive(async()=>{
  await this.db.run('UPDATE authorized_users SET revoked=1 WHERE user_id=?',[userId]);
  await this.db.run("UPDATE sync_outbox SET state='auth_required',error='Sign in online to renew synchronization authorization.' WHERE user_id=? AND state<>'synced'",[userId]);
  if(this.session?.user.id===userId){this.session=null;return true;}return false;
 });}
}
