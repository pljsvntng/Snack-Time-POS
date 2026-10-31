const crypto=require('node:crypto'),ApiError=require('./ApiError');
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const fail=message=>{throw new ApiError(400,message);};
function integer(v,label,min=1){if(!Number.isSafeInteger(v)||v<min||v>2147483647)fail('Invalid '+label+'.');return v;}
function cents(v,label='amount',signed=false){if(!['number','string'].includes(typeof v)||!/^\-?\d+(\.\d{1,2})?$/.test(String(v)))fail('Invalid '+label+'.');const [a,b='']=String(v).replace('-','').split('.');const n=(BigInt(a)*100n+BigInt(b.padEnd(2,'0')))*(String(v).startsWith('-')?-1n:1n);if(n>9999999999n||n< -9999999999n||(!signed&&n<0))fail('Invalid '+label+'.');return n;}
const money=n=>(Number(n)/100).toFixed(2);
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
const fingerprint=v=>crypto.createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
function envelope(body,user,device){
 if(!body||!uuid(body.device_id)||!uuid(body.client_id)||body.device_id!==device||![0,1].includes(body.protocol_version))fail('Invalid synchronization envelope.');
 const r=body.receipt;if(!r||r.user_id!==user.id||r.id!=='local:'+body.client_id||r.order_number!=='OFF-'+body.device_id.slice(0,8)+'-'+body.client_id||r.payment_method!=='cash'||r.status!=='completed')fail('Invalid offline cash receipt.');
 if(typeof r.created_at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(r.created_at)||!Number.isFinite(Date.parse(r.created_at)))fail('Invalid sale timestamp.');
 if(!Array.isArray(r.items)||!r.items.length||r.items.length>200)fail('Invalid offline items.');
 const subtotal=cents(r.subtotal),discount=cents(r.discount_amount),total=cents(r.total),cash=cents(r.cash_received),change=cents(r.change_amount);
 if(subtotal-discount!==total||discount>subtotal||cash<total||cash-total!==change)fail('Receipt totals do not balance.');
 let sum=0n;for(const line of r.items){integer(line.product_id,'product');integer(line.quantity,'quantity');if(typeof line.product_name!=='string'||!line.product_name||line.product_name.length>255||!Array.isArray(line.options)||line.options.length>100)fail('Invalid receipt item.');const lineSum=cents(line.unit_price)*BigInt(line.quantity);if(lineSum!==cents(line.subtotal))fail('Item totals do not balance.');sum+=lineSum;for(const o of line.options){if(typeof o.option_name!=='string'||o.option_name.length>100||typeof o.option_group_name!=='string'||o.option_group_name.length>100)fail('Invalid receipt choice.');cents(o.price_modifier,'option',true);}}
 if(sum!==subtotal)fail('Receipt items do not match subtotal.');
 return {receipt:r,subtotal,discount,total,cash,change};
}
function resolveCatalogSale(body,snapshot){
 const r=body.receipt,q=body.request;if(!q||q.payment_method!=='cash'||!Array.isArray(q.items)||q.items.length!==r.items.length||q.items.length>200)fail('Invalid saved checkout request.');
 const products=new Map(snapshot.products.map(p=>[p.id,p])),needs=new Map(),lines=[];
 const need=(kind,id,units,name)=>{integer(id,'stock identifier');if(units<0n)fail('Invalid recipe quantity.');const key=kind+':'+id,old=needs.get(key);needs.set(key,{kind,id,name,units:(old?.units||0n)+units});};
 let subtotal=0n;
 q.items.forEach((item,index)=>{
  const p=products.get(integer(item.product_id,'product'));integer(item.quantity,'quantity');if(!p||!p.available||p.deleted_at)fail('Product was not authorized by this catalog.');
  if(!Array.isArray(item.selected_option_ids)||new Set(item.selected_option_ids).size!==item.selected_option_ids.length)fail('Invalid selected options.');item.selected_option_ids.forEach(id=>integer(id,'option'));
  const options=[];for(const group of p.option_groups||[]){const chosen=group.options.filter(o=>item.selected_option_ids.includes(o.id));if(group.is_required&&!chosen.length||group.selection_type==='single'&&chosen.length>1)fail('Required option rules were not met.');chosen.forEach(o=>options.push({...o,group_name:group.name}));}
  if(options.length!==item.selected_option_ids.length)fail('An option does not belong to this product.');
  const unit=options.reduce((n,o)=>n+cents(o.price_modifier,'option',true),cents(p.price));if(unit<0n)fail('Invalid unit price.');const lineSum=unit*BigInt(item.quantity);subtotal+=lineSum;
  const line={product_id:p.id,product_name:p.name,unit_price:money(unit),quantity:item.quantity,subtotal:money(lineSum),options:options.map(o=>({option_group_name:o.group_name,option_name:o.name,price_modifier:money(cents(o.price_modifier,'option',true))}))};
  const supplied=r.items[index];if(supplied.product_id!==line.product_id||supplied.product_name!==line.product_name||supplied.quantity!==line.quantity||cents(supplied.unit_price)!==unit||cents(supplied.subtotal)!==lineSum||supplied.options.length!==line.options.length)fail('Historical item price/name mismatch.');
  line.options.forEach((o,n)=>{const s=supplied.options[n];if(s.option_name!==o.option_name||s.option_group_name!==o.option_group_name||cents(s.price_modifier,'option',true)!==cents(o.price_modifier,'option',true))fail('Historical choice mismatch.');});lines.push(line);
  need('product',p.id,BigInt(item.quantity)*100n,p.name);needs.get('product:'+p.id).tracked=!!p.track_stock;
  for(const i of [...p.recipe||[],...options.flatMap(o=>o.ingredients||[])])need('ingredient',i.ingredient_id,cents(i.quantity_required,'recipe')*BigInt(item.quantity),i.name);
 });
 let discount=0n,discountName=null;const discountId=q.discount_id||null;
 if(discountId){const d=snapshot.discounts.find(d=>d.id===discountId);if(!d||!d.active)fail('Discount was not authorized by this catalog.');const value=cents(d.value);if(d.type==='percent'){if(value>10000n)fail('Invalid discount percentage.');discount=(subtotal*value+5000n)/10000n;}else if(d.type==='fixed')discount=value;else fail('Invalid discount type.');if(discount>subtotal)discount=subtotal;discountName=d.name;}
 if(subtotal!==cents(r.subtotal)||discount!==cents(r.discount_amount)||discountId!==(r.discount_id||null)||discountName!==(r.discount_name||null)||cents(q.cash_received)!==cents(r.cash_received)||cents(q.expected_total)!==cents(r.total))fail('Historical financial totals do not match the authorized catalog.');
 if(fingerprint(r.receipt_settings||{})!==fingerprint(snapshot.settings||{}))fail('Historical receipt settings mismatch.');
 return {lines,needs:[...needs.values()],discountId};
}
function legacySale(body){
 const needs=[];if(!Array.isArray(body.movements)||body.movements.length>2000)fail('Legacy inventory audit is missing.');const seen=new Set();
 for(const m of body.movements){if(!['product','ingredient'].includes(m.kind))fail('Invalid legacy stock kind.');integer(m.entity_id,'stock identifier');integer(m.quantity_units,'stock quantity');const key=m.kind+':'+m.entity_id;if(seen.has(key))fail('Duplicate legacy stock movement.');seen.add(key);needs.push({kind:m.kind,id:m.entity_id,name:'Legacy stock '+m.entity_id,units:BigInt(m.quantity_units)*(m.kind==='product'?100n:1n)});}
 return {lines:body.receipt.items.map(i=>({...i,unit_price:money(cents(i.unit_price)),subtotal:money(cents(i.subtotal)),options:i.options.map(o=>({...o,price_modifier:money(cents(o.price_modifier,'option',true))}))})),needs,discountId:body.receipt.discount_id||null};
}
module.exports={uuid,integer,cents,money,fingerprint,envelope,resolveCatalogSale,legacySale};
