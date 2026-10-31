const pool=require('../config/db'),crypto=require('node:crypto'),ApiError=require('../utils/ApiError'),asyncHandler=require('../utils/asyncHandler');
const {readSnapshot}=require('./offlineController'),{verifyOfflineGrant}=require('../utils/syncAuthentication');
const {uuid,cents,money,fingerprint,envelope,resolveCatalogSale,legacySale}=require('../utils/offlineSaleValidation');
async function transaction(fn){const c=await pool.connect();try{await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='10s'");const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
const catalog=asyncHandler(async(req,res)=>{
 const device=req.body.device_id;if(!uuid(device)||req.syncDevice&&req.syncDevice!==device)throw new ApiError(400,'Invalid catalog device.');
 if(!['admin','cashier'].includes(req.user.role))throw new ApiError(403,'POS authorization is required.');
 const c=await pool.connect();try{
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ');const snapshot=await readSnapshot(c,req.user.id);let id=crypto.randomUUID(),expires=new Date(Date.now()+7*86400000).toISOString();
  const recipe=items=>(items||[]).map(i=>({ingredient_id:i.ingredient_id,quantity_required:i.quantity_required,name:i.name}));
  const policy={products:snapshot.products.map(p=>({id:p.id,name:p.name,price:p.price,available:p.available,track_stock:p.track_stock,deleted_at:p.deleted_at,recipe:recipe(p.recipe),option_groups:p.option_groups.map(g=>({id:g.id,name:g.name,is_required:g.is_required,selection_type:g.selection_type,options:g.options.map(o=>({id:o.id,name:o.name,price_modifier:o.price_modifier,ingredients:recipe(o.ingredients)}))}))})),discounts:snapshot.discounts,settings:snapshot.settings};
  const policyHash=fingerprint(policy),{rows:[existing]}=await c.query("SELECT id,expires_at FROM offline_catalogs WHERE device_id=$1 AND policy_hash=$2 AND expires_at>CURRENT_TIMESTAMP+INTERVAL '1 hour' ORDER BY created_at DESC LIMIT 1",[device,policyHash]);
  if(existing){id=existing.id;expires=new Date(existing.expires_at).toISOString();}
  else await c.query('INSERT INTO offline_catalogs(id,device_id,issued_to,expires_at,snapshot,policy_hash) VALUES($1,$2,$3,$4,$5,$6)',[id,device,req.user.id,expires,policy,policyHash]);await c.query('COMMIT');
  res.set('Cache-Control','no-store').json({...snapshot,sync_catalog_id:id,sync_catalog_expires_at:expires});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});
async function acknowledgment(c,row){
 const {rows:[counts]}=await c.query('SELECT COUNT(*)::int count FROM offline_stock_conflicts WHERE offline_sale_id=$1 AND resolved_at IS NULL',[row.id]);
 const {rows:[order]}=row.order_id?await c.query('SELECT order_number FROM orders WHERE id=$1',[row.order_id]):{rows:[]};
 return {device_id:row.device_id,client_id:row.client_id,status:row.status,server_order_id:row.order_id,server_order_number:order?.order_number||null,synced_at:row.synced_at,conflict_count:counts.count};
}
async function stock(c,saleId,orderId,userId,needs){
 for(const need of [...needs].sort((a,b)=>(a.kind+':'+String(a.id).padStart(12,'0')).localeCompare(b.kind+':'+String(b.id).padStart(12,'0')))){
  if(need.units<0n||need.units>99999999999999n)throw new ApiError(400,'Inventory quantity exceeds the supported range.');
  const product=need.kind==='product',table=product?'products':'ingredients',column=product?'stock':'current_stock';
  const {rows:[row]}=await c.query(`SELECT id,name,${column} quantity${product?',track_stock':''} FROM ${table} WHERE id=$1 FOR UPDATE`,[need.id]);
  let before=0n,applied=0n,reason=null;
  if(product&&need.tracked===false&&row&&!row.track_stock)continue;
  if(!row)reason='Historical stock record is missing';
  else if(product&&need.tracked===false)reason='Stock tracking changed since the offline catalog';
  else if(product&&(!row.track_stock||row.quantity===null))reason='Stock tracking changed since the offline catalog';
  else{
   // Quantities are exact hundredths, independent of financial column limits.
   const text=String(row.quantity),[whole,fraction='']=text.split('.');before=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
   applied=before<need.units?before:need.units;if(applied<need.units)reason='Multiple offline sales exceeded central stock';
   await c.query(`UPDATE ${table} SET ${column}=${column}-$1 WHERE id=$2`,[product?Number(applied/100n):money(applied),need.id]);
   await c.query('INSERT INTO offline_stock_movements(offline_sale_id,kind,entity_id,before_quantity,delta,after_quantity) VALUES($1,$2,$3,$4,$5,$6)',[saleId,need.kind,need.id,money(before),money(-applied),money(before-applied)]);
   if(!product&&applied>0n)await c.query("INSERT INTO inventory_transactions(ingredient_id,type,quantity,resulting_stock,reason,reference_order_id,user_id) VALUES($1,'deduct',$2,$3,$4,$5,$6)",[need.id,money(applied),money(before-applied),'Offline sale synchronized',orderId,userId]);
  }
  if(reason)await c.query('INSERT INTO offline_stock_conflicts(offline_sale_id,kind,entity_id,entity_name,requested_quantity,applied_quantity,reason) VALUES($1,$2,$3,$4,$5,$6,$7)',[saleId,need.kind,need.id,row?.name||need.name,money(need.units),money(applied),reason]);
 }
}
async function persist(c,row,resolved){
 const r=row.payload.receipt;
 for(const line of resolved.lines)if(!(await c.query('SELECT 1 FROM products WHERE id=$1',[line.product_id])).rowCount)throw new ApiError(409,'A historical product is missing. Restore its record before approving this sale.');
 const discountId=resolved.discountId&&(await c.query('SELECT 1 FROM discounts WHERE id=$1',[resolved.discountId])).rowCount?resolved.discountId:null;
 const orderNumber=await require('../utils/orderNumber').generateOrderNumber(c);
 const {rows:[order]}=await c.query("INSERT INTO orders(order_number,user_id,subtotal,discount_id,discount_amount,total,payment_method,cash_received,change_amount,status,created_at) VALUES($1,$2,$3,$4,$5,$6,'cash',$7,$8,'completed',$9) RETURNING id",[orderNumber,row.user_id,money(cents(r.subtotal)),discountId,money(cents(r.discount_amount)),money(cents(r.total)),money(cents(r.cash_received)),money(cents(r.change_amount)),r.created_at]);
 for(const line of resolved.lines){
  const {rows:[item]}=await c.query('INSERT INTO order_items(order_id,product_id,product_name,unit_price,quantity,subtotal) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[order.id,line.product_id,line.product_name,line.unit_price,line.quantity,line.subtotal]);
  for(const o of line.options)await c.query('INSERT INTO order_item_options(order_item_id,option_group_name,option_name,price_modifier) VALUES($1,$2,$3,$4)',[item.id,o.option_group_name,o.option_name,o.price_modifier]);
 }
 await stock(c,row.id,order.id,row.user_id,resolved.needs);
 const {rows:[saved]}=await c.query("UPDATE offline_sales SET order_id=$1,status='synced',synced_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *",[order.id,row.id]);return saved;
}
const upload=asyncHandler(async(req,res)=>{
 const body=req.body;envelope(body,req.user,req.syncDevice);const digest=fingerprint(body);
 const result=await transaction(async c=>{
  // Same transaction lock as online checkout: ordering and deductions share one boundary.
  await c.query('SELECT pg_advisory_xact_lock(731042,1)');
  const {rows:[existing]}=await c.query('SELECT * FROM offline_sales WHERE device_id=$1 AND client_id=$2 FOR UPDATE',[body.device_id,body.client_id]);
  if(existing){if(existing.user_id!==req.user.id||existing.payload_hash!==digest)throw new ApiError(409,'This sale identifier already belongs to different data. The saved original was preserved.');return acknowledgment(c,existing);}
  let resolved,review=false;
  if(body.protocol_version===1){
   const proof=verifyOfflineGrant(body.proof_grant,{allowExpired:true});
   if(proof.user.id!==req.user.id||proof.device_id!==body.device_id||proof.user.fullName!==body.receipt.cashier_name)throw new ApiError(403,'Sale authorization does not match its cashier/device.');
   const created=Date.parse(body.receipt.created_at);if(created<proof.iat*1000-300000||created>proof.exp*1000||created>Date.now()+300000)throw new ApiError(400,'Sale timestamp is outside its offline authorization.');
   if(!uuid(body.catalog_id))throw new ApiError(400,'Historical catalog is required.');
   const {rows:[record]}=await c.query('SELECT * FROM offline_catalogs WHERE id=$1 AND device_id=$2',[body.catalog_id,body.device_id]);
   if(!record||created<new Date(record.created_at).getTime()-300000||created>new Date(record.expires_at).getTime())throw new ApiError(400,'Sale was outside the historical catalog authorization.');
   resolved=resolveCatalogSale(body,record.snapshot);
  }else{resolved=legacySale(body);review=true;}
  const {rows:[saved]}=await c.query("INSERT INTO offline_sales(device_id,client_id,user_id,catalog_id,payload_hash,payload,status,review_note) VALUES($1,$2,$3,$4,$5,$6,'review_required',$7) RETURNING *",[body.device_id,body.client_id,req.user.id,body.protocol_version===1?body.catalog_id:null,digest,body,review?'Phase 5 receipt: historical prices require administrator approval':null]);
  return acknowledgment(c,review?saved:await persist(c,saved,resolved));
 });res.set('Cache-Control','no-store').json(result);
});
const saleStatus=asyncHandler(async(req,res)=>{
 if(!uuid(req.params.clientId))throw new ApiError(400,'Invalid sale identifier.');
 const {rows:[row]}=await pool.query('SELECT * FROM offline_sales WHERE device_id=$1 AND client_id=$2 AND user_id=$3',[req.syncDevice,req.params.clientId,req.user.id]);
 if(!row)throw new ApiError(404,'Synchronized sale not found.');res.set('Cache-Control','no-store').json(await acknowledgment(pool,row));
});
const issues=asyncHandler(async(req,res)=>{
 const {rows:conflicts}=await pool.query("SELECT f.*,s.client_id,s.device_id,o.order_number,u.full_name cashier_name,CASE WHEN f.kind='product' THEN (SELECT stock::numeric FROM products WHERE id=f.entity_id) ELSE (SELECT current_stock FROM ingredients WHERE id=f.entity_id) END current_quantity FROM offline_stock_conflicts f JOIN offline_sales s ON s.id=f.offline_sale_id JOIN users u ON u.id=s.user_id LEFT JOIN orders o ON o.id=s.order_id WHERE f.resolved_at IS NULL ORDER BY f.id");
 const {rows:reviews}=await pool.query("SELECT s.id,s.client_id,s.device_id,s.received_at,s.review_note,s.payload->'receipt' receipt,u.full_name cashier_name FROM offline_sales s JOIN users u ON u.id=s.user_id WHERE s.status='review_required' ORDER BY s.id");res.json({conflicts,reviews});
});
const approve=asyncHandler(async(req,res)=>{
 if(typeof req.body.note!=='string'||req.body.note.trim().length<10||req.body.note.length>500)throw new ApiError(400,'Explain the historical sale approval in 10–500 characters.');
 const result=await transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(731042,1)');const {rows:[row]}=await c.query('SELECT * FROM offline_sales WHERE id=$1 FOR UPDATE',[req.params.id]);if(!row)throw new ApiError(404,'Archived sale not found.');if(row.status==='synced')return acknowledgment(c,row);
  envelope(row.payload,{id:row.user_id},row.device_id);const saved=await persist(c,row,legacySale(row.payload));await c.query('UPDATE offline_sales SET review_note=$1,reviewed_by=$2,reviewed_at=CURRENT_TIMESTAMP WHERE id=$3',[req.body.note.trim(),req.user.id,row.id]);return acknowledgment(c,saved);});res.json(result);
});
const resolveConflict=asyncHandler(async(req,res)=>{
 const note=req.body.note;if(typeof note!=='string'||note.trim().length<10||note.length>500)throw new ApiError(400,'Explain the physical inventory reconciliation in 10–500 characters.');
 const counted=cents(req.body.counted_quantity,'counted quantity'),expected=cents(req.body.expected_quantity,'expected quantity');
 const result=await transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(731042,1)');const {rows:[conflict]}=await c.query('SELECT * FROM offline_stock_conflicts WHERE id=$1 FOR UPDATE',[req.params.id]);if(!conflict)throw new ApiError(404,'Inventory conflict not found.');if(conflict.resolved_at)return {resolved:true};
  const product=conflict.kind==='product',table=product?'products':'ingredients',column=product?'stock':'current_stock';if(product&&counted%100n!==0n)throw new ApiError(400,'Count whole products.');
  const {rows:[row]}=await c.query(`SELECT ${column} quantity${product?',track_stock':''} FROM ${table} WHERE id=$1 FOR UPDATE`,[conflict.entity_id]);
  if(!row||product&&(!row.track_stock||row.quantity===null))throw new ApiError(409,'Restore this stock record/tracking before reconciling it.');
  const before=cents(row.quantity,'current quantity');if(before!==expected)throw new ApiError(409,'Stock changed. Refresh and confirm the new physical count.');
  await c.query(`UPDATE ${table} SET ${column}=$1 WHERE id=$2`,[product?Number(counted/100n):money(counted),conflict.entity_id]);
  const {rows:[movement]}=await c.query('INSERT INTO offline_stock_movements(kind,entity_id,before_quantity,delta,after_quantity) VALUES($1,$2,$3,$4,$5) RETURNING id',[conflict.kind,conflict.entity_id,money(before),money(counted-before),money(counted)]);
  if(!product)await c.query("INSERT INTO inventory_transactions(ingredient_id,type,quantity,resulting_stock,reason,user_id) VALUES($1,'adjust',$2,$2,$3,$4)",[conflict.entity_id,money(counted),'Offline inventory reconciliation: '+note.trim(),req.user.id]);
  await c.query('UPDATE offline_stock_conflicts SET resolved_at=CURRENT_TIMESTAMP,resolved_by=$1,resolution_note=$2,counted_quantity=$3,resolution_movement_id=$4 WHERE id=$5',[req.user.id,note.trim(),money(counted),movement.id,conflict.id]);return {resolved:true};
 });res.json(result);
});
module.exports={catalog,upload,saleStatus,issues,approve,resolveConflict};
