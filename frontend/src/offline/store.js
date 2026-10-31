import { schema } from './schema.js';
import {SyncStore} from './sync-store.js';
import { bytes64, verifier, equal, hash, verifyGrant, scaled, integer, safe, offlineError } from './security.js';

export class OfflineStore extends SyncStore {
 constructor(driver,publicKey,{now=()=>Date.now()}={}) { super();this.db=driver;this.publicKey=publicKey;this.now=now;this.session=null;this.tail=Promise.resolve(); }
 async initialize() {
  if(!this.initialized)this.initialized=(async()=>{
   await this.db.execute('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
   const version=(await this.db.query('PRAGMA user_version'))[0].user_version;
   if(version>2)throw offlineError('This local database needs a newer application.');
   await this.db.transaction(async()=>{await this.db.execute(schema);if(!await this.getMeta('device_id'))await this.setMeta('device_id',crypto.randomUUID());await this.backfillOutbox();});
  })();
  return this.initialized;
 }
 async exclusive(fn) { await this.initialize();const work=this.tail.then(fn);this.tail=work.catch(()=>{});return work; }
 async getMeta(key,fallback=null) { const row=(await this.db.query('SELECT value FROM metadata WHERE key=?',[key]))[0];return row?JSON.parse(row.value):fallback; }
 async setMeta(key,value) { await this.db.run('INSERT INTO metadata(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[key,JSON.stringify(value)]); }
 async clock() {
  const last=await this.getMeta('clock_ms',0),now=this.now();
  if(!Number.isFinite(now)||now<last-300000)throw offlineError('Device clock moved backwards. Correct the clock and sign in online.',401);
  const value=Math.max(last,now);await this.setMeta('clock_ms',value);return value;
 }
 async actor() {
  if(!this.session)throw offlineError('Sign in to use local POS data.',401);
  const now=await this.clock();const row=(await this.db.query('SELECT revoked FROM authorized_users WHERE user_id=?',[this.session.user.id]))[0];
  if(!row||row.revoked||now>=this.session.expires) { this.session=null;throw offlineError('Offline session expired. Please sign in again.',401); }
  return this.session.user;
 }
 async status() { return this.exclusive(async()=>({deviceId:await this.getMeta('device_id'),preparedAt:await this.getMeta('prepared_at'),localSales:(await this.db.query('SELECT COUNT(*) AS count FROM local_orders'))[0].count,offline:await this.getMeta('offline_mode',false)})); }
 async mode(value) { return this.exclusive(()=>this.setMeta('offline_mode',Boolean(value))); }
 async enroll({password,alias,grant,snapshot}) {
  return this.exclusive(async()=>{
   const deviceId=await this.getMeta('device_id'),now=await this.clock();const claims=await verifyGrant(grant,this.publicKey,deviceId,now);
   if(typeof password!=='string'||!password||(!snapshot.authorization_only&&claims.user.id!==snapshot.user_id)||snapshot.schema_version!==1)throw offlineError('Invalid offline preparation.');
   if(snapshot.authorization_only&&!await this.getMeta('prepared_at'))throw offlineError('Prepare the offline catalog online first.');
   const salt=bytes64(crypto.getRandomValues(new Uint8Array(32))),derived=await verifier(password,salt);
   let retainedStock=false;
   await this.db.transaction(async()=>{
    const old=(await this.db.query('SELECT aliases_json FROM authorized_users WHERE user_id=?',[claims.user.id]))[0];
    const aliases=[...new Set([claims.user.username,alias,...(old?JSON.parse(old.aliases_json):[])].filter(Boolean).map(s=>s.trim().toLowerCase()))];
    await this.db.run('INSERT INTO authorized_users(user_id,username,aliases_json,grant_jwt,salt,verifier) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET username=excluded.username,aliases_json=excluded.aliases_json,grant_jwt=excluded.grant_jwt,salt=excluded.salt,verifier=excluded.verifier,failures=0,locked_until=0,revoked=0',[claims.user.id,claims.user.username,JSON.stringify(aliases),grant,salt,derived]);
    retainedStock=snapshot.authorization_only?true:(await this.cacheSnapshot(snapshot)).retainedStock;
    for(const o of snapshot.orders||[])if(o.user_id===claims.user.id)await this.db.run('INSERT INTO cached_orders(id,user_id,data_json) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json',[`server:${o.id}`,o.user_id,JSON.stringify({...o,id:`server:${o.id}`,source:'server-cache'})]);
   });
   this.session={user:claims.user,expires:Math.min(claims.exp*1000,now+8*3600000)};
   return {retainedStock,preparedAt:await this.getMeta('prepared_at')};
  });
 }
 async renew(input) { return this.enroll({...input,snapshot:{schema_version:1,authorization_only:true}}); }
 async login(alias,password) {
  return this.exclusive(async()=>{
   const now=await this.clock(),device=await this.getMeta('device_id');
   const rows=await this.db.query('SELECT * FROM authorized_users');
   const matches=rows.filter(r=>JSON.parse(r.aliases_json).includes(String(alias).trim().toLowerCase()));
   const row=matches.length===1?matches[0]:null;
   if(!row||row.revoked)throw offlineError('Offline sign-in failed. Use an account previously authorized on this device.',401);
   if(row.locked_until>now)throw offlineError('Too many attempts. Try again in five minutes.',429);
   const claims=await verifyGrant(row.grant_jwt,this.publicKey,device,now);
   const valid=typeof password==='string'&&equal(await verifier(password,row.salt),row.verifier);
   if(!valid){const failures=row.locked_until?1:row.failures+1;await this.db.run('UPDATE authorized_users SET failures=?,locked_until=? WHERE user_id=?',[failures,failures>=5?now+300000:0,row.user_id]);throw offlineError('Invalid offline username or password.',401);}
   await this.db.run('UPDATE authorized_users SET failures=0,locked_until=0 WHERE user_id=?',[row.user_id]);
   this.session={user:claims.user,expires:Math.min(claims.exp*1000,now+8*3600000)};
   return {...claims.user,serverRole:claims.user.role,role:'cashier',offline:true};
  });
 }
 lock() { this.session=null; }
 async revoke(alias) { return this.exclusive(async()=>{for(const row of await this.db.query('SELECT user_id,aliases_json FROM authorized_users'))if(JSON.parse(row.aliases_json).includes(String(alias).trim().toLowerCase()))await this.db.run('UPDATE authorized_users SET revoked=1 WHERE user_id=?',[row.user_id]);this.session=null;}); }
 async token(value) { return this.exclusive(async()=>{if(value!==undefined)await this.setMeta('online_token',value);return this.getMeta('online_token');}); }
 async productRows() {
  const stock=new Map((await this.db.query('SELECT * FROM ingredients')).map(i=>[i.id,i]));
  const recipe=items=>(items||[]).map(i=>({...i,current_stock:(stock.get(i.ingredient_id)?.current_units||0)/100}));
  return (await this.db.query('SELECT * FROM products ORDER BY id')).map(row=>{const p=JSON.parse(row.data_json);return {...p,stock:row.stock_quantity,recipe:recipe(p.recipe),option_groups:(p.option_groups||[]).map(g=>({...g,options:g.options.map(o=>({...o,ingredients:recipe(o.ingredients)}))}))};});
 }
 async catalog(kind) { return this.exclusive(async()=>{await this.actor();if(kind==='products')return (await this.productRows()).filter(p=>p.available&&!p.deleted_at);if(kind==='settings')return Object.fromEntries((await this.db.query('SELECT * FROM settings')).map(r=>[r.key,r.value]));if(!['categories','discounts'].includes(kind))throw offlineError('Unavailable offline.');return (await this.db.query('SELECT data_json FROM '+kind+' ORDER BY id')).map(r=>JSON.parse(r.data_json));}); }
 async draft(value, expectedUserId) { return this.exclusive(async()=>{
  const user=await this.actor();
  if(expectedUserId!==undefined && expectedUserId!==user.id)throw offlineError('The signed-in cashier changed.',409);
  if(value!==undefined){
   if(!Array.isArray(value.items)||value.items.length>200)throw offlineError('Invalid saved cart.');
   // Photos and repeated option catalogs are read from products, not duplicated in a large SQLite row.
   const compact={...value,items:value.items.map(item=>({...item,product:{id:item.product.id},selectedOptions:item.selectedOptions.map(o=>({option_id:o.option_id,group_name:o.group_name,name:o.name,price_modifier:o.price_modifier}))}))};
   await this.db.run('INSERT INTO drafts(user_id,request_id,data_json) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET request_id=excluded.request_id,data_json=excluded.data_json',[user.id,value.request_id,JSON.stringify(compact)]);
  }
  const row=(await this.db.query('SELECT data_json FROM drafts WHERE user_id=?',[user.id]))[0];if(!row)return null;
  const saved=JSON.parse(row.data_json),catalog=new Map((await this.productRows()).map(p=>[p.id,p]));
  saved.items=saved.items.map(item=>{
   const product=catalog.get(item.product.id);if(!product)throw offlineError('A saved product is unavailable.');
   const options=new Map((product.option_groups||[]).flatMap(g=>g.options.map(o=>[o.id,o])));
   return {...item,product,selectedOptions:item.selectedOptions.map(o=>({...o,ingredients:options.get(o.option_id)?.ingredients||[]}))};
  });
  return saved;
 }); }
 async listOrders({from,to,search='',localOnly=false}={}) { return this.exclusive(async()=>{const user=await this.actor();const local=(await this.db.query('SELECT receipt_json FROM local_orders WHERE user_id=? ORDER BY created_at DESC',[user.id])).map(r=>JSON.parse(r.receipt_json));const cached=localOnly?[]:(await this.db.query('SELECT data_json FROM cached_orders WHERE user_id=?',[user.id])).map(r=>JSON.parse(r.data_json));const date=v=>new Date(v?.includes(' ')?v.replace(' ','T')+'+08:00':v).getTime();return (await this.decorateOrders([...local,...cached.filter(o=>!local.some(l=>l.id==='local:'+o.offline_client_id))])).filter(o=>(!from||date(o.created_at)>=date(from))&&(!to||date(o.created_at)<=date(to))&&JSON.stringify([o.order_number,...o.items.map(i=>i.product_name||i.name)]).toLowerCase().includes(search.toLowerCase())).sort((a,b)=>date(b.created_at)-date(a.created_at));}); }
 async order(id) { return this.exclusive(async()=>{const user=await this.actor();const row=id.startsWith('server:')?(await this.db.query('SELECT data_json AS receipt_json FROM cached_orders WHERE id=? AND user_id=?',[id,user.id]))[0]:(await this.db.query('SELECT receipt_json FROM local_orders WHERE id=? AND user_id=?',[id,user.id]))[0];if(!row)throw offlineError('Local transaction not found.',404);return (await this.decorateOrders([JSON.parse(row.receipt_json)]))[0];}); }
 async checkout(request) {
  return this.exclusive(async()=>{
   const user=await this.actor();
   if(request.payment_method!=='cash')throw offlineError('Only cash payments are available offline.');
   if(typeof request.request_id!=='string'||!/^[a-f0-9-]{36}$/i.test(request.request_id))throw offlineError('A durable checkout identifier is required.');
   if(!Array.isArray(request.items)||!request.items.length||request.items.length>200)throw offlineError('Invalid order items.');
   const items=request.items.map(i=>{if(!i||typeof i!=='object')throw offlineError('Invalid order item.');const ids=i.selected_option_ids??[];if(!Array.isArray(ids))throw offlineError('Invalid options.');const selected=ids.map(n=>integer(n,'option')).sort((a,b)=>a-b);if(new Set(selected).size!==selected.length)throw offlineError('Duplicate option.');return {product_id:integer(i.product_id,'product'),quantity:integer(i.quantity,'quantity'),selected_option_ids:selected};});
   const cash=scaled(request.cash_received,'Cash received');if(cash>9999999999)throw offlineError('Cash exceeds the supported financial range.');const discountId=request.discount_id?integer(request.discount_id,'discount'):null;
   const fingerprint=await hash(JSON.stringify({items,discountId,cash,user:user.id}));
   return this.db.transaction(async()=>{
    const existing=(await this.db.query('SELECT * FROM local_orders WHERE request_id=?',[request.request_id]))[0];
    if(existing){if(existing.user_id!==user.id||existing.request_hash!==fingerprint)throw offlineError('Checkout identifier already belongs to a different sale.',409);return JSON.parse(existing.receipt_json);}
    const expires=await this.getMeta('sync_catalog_expires_at');if(expires&&Date.parse(expires)<=await this.clock())throw offlineError('Offline catalog expired. Connect and refresh the catalog before another sale.',409);
    const draft=(await this.db.query('SELECT request_id FROM drafts WHERE user_id=?',[user.id]))[0];
    if(!draft||draft.request_id!==request.request_id)throw offlineError('The saved cart changed. Review the current order.',409);
    const products=new Map((await this.productRows()).map(p=>[p.id,p])),required=new Map(),tracked=new Map(),lines=[];
    const addNeed=(ingredient,qty)=>{const units=safe(BigInt(scaled(ingredient.quantity_required,'Recipe'))*BigInt(qty));required.set(ingredient.ingredient_id,safe(BigInt(required.get(ingredient.ingredient_id)||0)+BigInt(units)));};
    for(const item of items){
     const p=products.get(item.product_id);if(!p||!p.available||p.deleted_at)throw offlineError('Product unavailable.');
     const options=[];for(const group of p.option_groups||[]){const chosen=group.options.filter(o=>item.selected_option_ids.includes(o.id));if(group.is_required&&!chosen.length)throw offlineError('Select '+group.name+'.');if(group.selection_type==='single'&&chosen.length>1)throw offlineError('Select only one '+group.name+'.');for(const opt of chosen)options.push({...opt,group_name:group.name});}
     if(options.length!==item.selected_option_ids.length)throw offlineError('An option does not belong to this product.');
     const unit=options.reduce((v,o)=>safe(BigInt(v)+BigInt(scaled(o.price_modifier,'Option price',true))),scaled(p.price,'Price'));
     if(unit<0)throw offlineError('Invalid product price.');const subtotal=safe(BigInt(unit)*BigInt(item.quantity));
     for(const ingredient of p.recipe||[])addNeed(ingredient,item.quantity);for(const option of options)for(const ingredient of option.ingredients||[])addNeed(ingredient,item.quantity);
     if(p.track_stock)tracked.set(p.id,safe(BigInt(tracked.get(p.id)||0)+BigInt(item.quantity)));
     lines.push({product_id:p.id,product_name:p.name,name:p.name,unit_price:unit/100,quantity:item.quantity,subtotal:subtotal/100,subtotal_cents:subtotal,options:options.map(o=>({group:o.group_name,option_group_name:o.group_name,name:o.name,option_name:o.name,price_modifier:scaled(o.price_modifier,'Option price',true)/100}))});
    }
    const subtotal=lines.reduce((v,l)=>safe(BigInt(v)+BigInt(l.subtotal_cents)),0);if(subtotal>9999999999)throw offlineError('Order exceeds the supported financial range.');let discount=0,discountName=null;
    if(discountId){const row=(await this.db.query('SELECT data_json FROM discounts WHERE id=?',[discountId]))[0];if(!row)throw offlineError('Discount unavailable.');const d=JSON.parse(row.data_json);if(!d.active)throw offlineError('Discount unavailable.');const value=scaled(d.value,'Discount');if(d.type==='percent'&&value>10000)throw offlineError('Invalid discount.');discount=d.type==='percent'?safe((BigInt(subtotal)*BigInt(value)+5000n)/10000n):value;discount=Math.min(discount,subtotal);discountName=d.name;}
    const total=subtotal-discount;if(request.expected_total!==undefined&&scaled(request.expected_total,'Expected total')!==total)throw offlineError('Prices changed. Review your order.',409);if(cash<total)throw offlineError('Insufficient payment.');
    const id='local:'+request.request_id,device=await this.getMeta('device_id'),created=new Date(await this.clock()).toISOString();
    const settings=Object.fromEntries((await this.db.query('SELECT * FROM settings')).map(s=>[s.key,s.value]));
    const receipt={id,order_number:'OFF-'+device.slice(0,8)+'-'+request.request_id,user_id:user.id,cashier_name:user.fullName,created_at:created,subtotal:subtotal/100,discount_id:discountId,discount_name:discountName,discount_amount:discount/100,total:total/100,payment_method:'cash',cash_received:cash/100,change_amount:(cash-total)/100,status:'completed',source:'local',offline:true,sync_status:'pending',receipt_settings:settings,items:lines};
    await this.db.run('INSERT INTO local_orders(id,request_id,request_hash,user_id,device_id,receipt_number,created_at,subtotal_cents,discount_cents,total_cents,cash_cents,change_cents,receipt_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,request.request_id,fingerprint,user.id,device,receipt.order_number,created,subtotal,discount,total,cash,cash-total,JSON.stringify(receipt)]);
    for(const line of lines)await this.db.run('INSERT INTO local_order_items(id,order_id,snapshot_json) VALUES (?,?,?)',[crypto.randomUUID(),id,JSON.stringify(line)]);
    for(const [pid,qty] of tracked){const result=await this.db.run('UPDATE products SET stock_quantity=stock_quantity-? WHERE id=? AND stock_quantity>=?',[qty,pid,qty]);if(result.changes!==1)throw offlineError('Insufficient Stock: '+products.get(pid).name);const stock=(await this.db.query('SELECT stock_quantity FROM products WHERE id=?',[pid]))[0].stock_quantity;await this.db.run('INSERT INTO inventory_movements(id,order_id,kind,entity_id,quantity_units,resulting_units) VALUES (?,?,?,?,?,?)',[crypto.randomUUID(),id,'product',pid,qty,stock]);}
    for(const [ingredient,qty] of required){const result=await this.db.run('UPDATE ingredients SET current_units=current_units-? WHERE id=? AND current_units>=?',[qty,ingredient,qty]);if(result.changes!==1)throw offlineError('Insufficient Stock: a recipe ingredient is unavailable.');const stock=(await this.db.query('SELECT current_units FROM ingredients WHERE id=?',[ingredient]))[0].current_units;await this.db.run('INSERT INTO inventory_movements(id,order_id,kind,entity_id,quantity_units,resulting_units) VALUES (?,?,?,?,?,?)',[crypto.randomUUID(),id,'ingredient',ingredient,qty,stock]);}
    await this.enqueue(receipt,{request_id:request.request_id,items,discount_id:discountId,payment_method:'cash',cash_received:(cash/100).toFixed(2),expected_total:(total/100).toFixed(2)});
    await this.db.run('DELETE FROM drafts WHERE user_id=?',[user.id]);
    return receipt;
   });
  });
 }
}
