// Read-only production audit. Never changes accounts, inventory, or orders.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),directory=path.join(root,'database/backups/phase8');
const quote=value=>'"'+value.replaceAll('"','""')+'"';
(async()=>{
 const stage=process.argv[2]||'before';assert.ok(['before','after'].includes(stage));
 const environment=require('dotenv').parse(fs.readFileSync(path.join(root,'backend/.env.neon')));
 process.env.DATABASE_URL=environment.NEON_DATABASE_URL;
 const {Pool,options}=require('../config/postgresql'),pool=new Pool({...options(),max:1});
 fs.mkdirSync(directory,{recursive:true});let client;
 try{
  client=await pool.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await client.query("SET LOCAL statement_timeout='30s'");
  const snapshot=await require('./migrate-neon').fingerprint(client);
  const checks={},query=async(name,sql)=>{checks[name]=(await client.query(sql)).rows[0].count;};
  await query('invalidOrderAmounts',`SELECT COUNT(*)::int count FROM orders WHERE subtotal<0 OR discount_amount<0 OR total<0 OR discount_amount>subtotal OR total<>subtotal-discount_amount`);
  await query('invalidCashChange',`SELECT COUNT(*)::int count FROM orders WHERE payment_method='cash' AND (cash_received IS NULL OR change_amount IS NULL OR cash_received<total OR change_amount<>cash_received-total)`);
  await query('invalidItemAmounts',`SELECT COUNT(*)::int count FROM order_items WHERE quantity<1 OR unit_price<0 OR subtotal<>unit_price*quantity`);
  await query('itemSubtotalMismatch',`SELECT COUNT(*)::int count FROM orders o WHERE o.subtotal<>COALESCE((SELECT SUM(i.subtotal) FROM order_items i WHERE i.order_id=o.id),0)`);
  await query('negativeIngredientStock',`SELECT COUNT(*)::int count FROM ingredients WHERE current_stock<0`);
  await query('invalidProductStockOrPrice',`SELECT COUNT(*)::int count FROM products WHERE price<0 OR (track_stock=1 AND (stock IS NULL OR stock<0))`);
  await query('invalidDiscounts',`SELECT COUNT(*)::int count FROM discounts WHERE value<0 OR (type='percent' AND value>100)`);
  await query('missingSyncedOrders',`SELECT COUNT(*)::int count FROM offline_sales s LEFT JOIN orders o ON o.id=s.order_id WHERE s.status='synced' AND o.id IS NULL`);
  await query('invalidForeignKeys',`SELECT COUNT(*)::int count FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f' AND NOT c.convalidated`);
  await query('invalidIndexes',`SELECT COUNT(*)::int count FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND NOT i.indisvalid`);
  const foreignKeys=(await client.query(`SELECT c.conname,ch.relname child,pa.relname parent,array_agg(ca.attname::text ORDER BY k.position) child_columns,array_agg(ra.attname::text ORDER BY k.position) parent_columns FROM pg_constraint c JOIN pg_class ch ON ch.oid=c.conrelid JOIN pg_class pa ON pa.oid=c.confrelid JOIN pg_namespace n ON n.oid=ch.relnamespace CROSS JOIN LATERAL unnest(c.conkey,c.confkey) WITH ORDINALITY k(child_att,parent_att,position) JOIN pg_attribute ca ON ca.attrelid=ch.oid AND ca.attnum=k.child_att JOIN pg_attribute ra ON ra.attrelid=pa.oid AND ra.attnum=k.parent_att WHERE c.contype='f' AND n.nspname='public' GROUP BY c.oid,c.conname,ch.relname,pa.relname`)).rows;
  for(const foreignKey of foreignKeys)await query('orphan:'+foreignKey.conname,`SELECT COUNT(*)::int count FROM ${quote(foreignKey.child)} c WHERE ${foreignKey.child_columns.map(column=>'c.'+quote(column)+' IS NOT NULL').join(' AND ')} AND NOT EXISTS(SELECT 1 FROM ${quote(foreignKey.parent)} p WHERE ${foreignKey.child_columns.map((column,index)=>'c.'+quote(column)+'=p.'+quote(foreignKey.parent_columns[index])).join(' AND ')})`);
  const accounts=(await client.query('SELECT u.username,u.active,r.name role FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.id')).rows;
  const passwordFormats=(await client.query("SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE password_hash COLLATE \"C\" ~ '^\\$2[aby]\\$[0-9]{2}\\$')::int bcrypt FROM users")).rows[0];
  const zone=(await client.query('SHOW timezone')).rows[0].TimeZone;
  const sync=(await client.query("SELECT status,COUNT(*)::int count FROM offline_sales GROUP BY status")).rows;
  const unresolved=(await client.query('SELECT COUNT(*)::int count FROM offline_stock_conflicts WHERE resolved_at IS NULL')).rows[0].count;
  await client.query('COMMIT');
  let originalRecordsUnchanged=null;
  if(stage==='after'){
   const before=JSON.parse(fs.readFileSync(path.join(directory,'database-before.json')));
   // Online authorization can append immutable device catalogs during UI tests.
   // Every business table and every monetary total must remain exactly equal.
   originalRecordsUnchanged=Object.keys(before.snapshot.tables).every(table=>table==='offline_catalogs'?snapshot.tables[table].count>=before.snapshot.tables[table].count:JSON.stringify(before.snapshot.tables[table])===JSON.stringify(snapshot.tables[table]))&&Object.entries(before.snapshot.financialTotals).every(([key,value])=>snapshot.financialTotals[key]===value);
  }
  const result={verifiedAt:new Date().toISOString(),readOnly:true,zone,checks,foreignKeysChecked:foreignKeys.length,accounts,passwordFormats,sync,unresolvedConflicts:unresolved,originalRecordsUnchanged,snapshot};
  fs.writeFileSync(path.join(directory,'database-'+stage+'.json'),JSON.stringify(result,null,2));
  const failed=Object.entries(checks).filter(([,count])=>count!==0);
  console.log(JSON.stringify({stage,readOnly:true,counts:Object.fromEntries(Object.entries(snapshot.tables).map(([name,value])=>[name,value.count])),financialTotals:snapshot.financialTotals,foreignKeysChecked:foreignKeys.length,failedChecks:failed,accounts,passwordFormats,zone,unresolvedConflicts:unresolved,originalRecordsUnchanged},null,2));
  assert.equal(failed.length,0,'Read-only database consistency checks need review');if(stage==='after')assert.equal(originalRecordsUnchanged,true,'Original production rows or financial totals changed; inspect the private audit reports');
 }finally{if(client){await client.query('ROLLBACK').catch(()=>{});client.release();}await pool.end();}
})().catch(error=>{console.error('Phase 8 database audit failed: '+require('../../frontend/tests/safe-error.cjs')(error));process.exitCode=1;});
