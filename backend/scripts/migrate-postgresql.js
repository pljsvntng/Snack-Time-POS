const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Decimal = require('decimal.js');
Decimal.set({precision: 50});
const { Pool, options } = require('../config/postgresql');
const q = s => '"' + s.replaceAll('"', '""') + '"';
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function verifiedSnapshot(directory) {
  const dir = path.resolve(directory);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json')));
  if (!manifest.restoredAndCompared || sha(path.join(dir, 'snapshot.json')) !== manifest.snapshotSHA256 || sha(path.join(dir,'mariadb.sql')) !== manifest.dumpSHA256) throw Error('Backup is unverified or has changed');
  return { dir, snapshot: JSON.parse(fs.readFileSync(path.join(dir,'snapshot.json'))) };
}
function orderedTables(snapshot) {
  const pending = new Set(Object.keys(snapshot.tables)), order = [];
  while (pending.size) {
    const ready = [...pending].filter(t => !snapshot.metadata.REFERENTIAL_CONSTRAINTS.some(f=>f.TABLE_NAME===t && pending.has(f.REFERENCED_TABLE_NAME)));
    if (!ready.length) throw Error('Foreign-key cycle requires explicit migration planning');
    for (const t of ready) {pending.delete(t);order.push(t);}
  }
  return order;
}
function columns(snapshot, table) { return snapshot.metadata.COLUMNS.filter(c=>c.TABLE_NAME===table).sort((a,b)=>a.ORDINAL_POSITION-b.ORDINAL_POSITION); }
function normalize(value, column) {
  if (value === null) return null;
  if (column.DATA_TYPE === 'timestamp') {
    const date = value instanceof Date ? value : new Date(String(value).replace(' ','T') + 'Z');
    if (Number.isNaN(date.getTime())) throw Error('Invalid source timestamp');
    return date.toISOString();
  }
  if (['decimal','int','tinyint'].includes(column.DATA_TYPE)) return new Decimal(value).toString();
  return String(value);
}
async function validate(client, snapshot) {
  const report = { tables: {}, relationships: [], financialTotals: {}, passwordHashesPreserved: true };
  for (const [table, data] of Object.entries(snapshot.tables)) {
    const cols = columns(snapshot,table);
    const pk = snapshot.metadata.KEY_COLUMN_USAGE.filter(k=>k.TABLE_NAME===table && k.CONSTRAINT_NAME==='PRIMARY').sort((a,b)=>a.ORDINAL_POSITION-b.ORDINAL_POSITION).map(k=>q(k.COLUMN_NAME));
    const { rows } = await client.query(`SELECT * FROM ${q(table)} ORDER BY ${pk.join(',')}`);
    if (rows.length !== data.count) throw Error('Record count mismatch: '+table);
    for(let i=0;i<rows.length;i++)for(const col of cols){
      const n = col.COLUMN_NAME;
      if (normalize(rows[i][n],col) !== normalize(data.rows[i][n],col)) throw Error(`Record mismatch: ${table} row ${i} column ${n}`);
    }
    report.tables[table] = {source:data.count,target:rows.length,allValuesMatch:true};
    for(const col of cols.filter(c=>c.DATA_TYPE==='decimal')){
      const expected = data.rows.reduce((sum,row)=>sum.plus(row[col.COLUMN_NAME] || 0), new Decimal(0));
      const {rows:[sum]} = await client.query(`SELECT COALESCE(SUM(${q(col.COLUMN_NAME)}),0) AS total FROM ${q(table)}`);
      if(!expected.eq(sum.total))throw Error('Decimal total mismatch: '+table+'.'+col.COLUMN_NAME);
      report.financialTotals[table+'.'+col.COLUMN_NAME] = expected.toFixed(Number(col.NUMERIC_SCALE));
    }
  }
  // Check every declared foreign key and the order reference used by the inventory ledger.
  const relations=snapshot.metadata.KEY_COLUMN_USAGE.filter(k=>k.REFERENCED_TABLE_NAME);
  relations.push({TABLE_NAME:'inventory_transactions',COLUMN_NAME:'reference_order_id',REFERENCED_TABLE_NAME:'orders',REFERENCED_COLUMN_NAME:'id'});
  for(const k of relations){
    const {rows:[row]}=await client.query(`SELECT COUNT(*) AS n FROM ${q(k.TABLE_NAME)} c LEFT JOIN ${q(k.REFERENCED_TABLE_NAME)} p ON c.${q(k.COLUMN_NAME)}=p.${q(k.REFERENCED_COLUMN_NAME)} WHERE c.${q(k.COLUMN_NAME)} IS NOT NULL AND p.${q(k.REFERENCED_COLUMN_NAME)} IS NULL`);
    if(Number(row.n))throw Error('Orphan relationship: '+k.TABLE_NAME+'.'+k.COLUMN_NAME);
    report.relationships.push({table:k.TABLE_NAME,column:k.COLUMN_NAME,orphans:0});
  }
  const {rows:payments}=await client.query('SELECT payment_method, status, COUNT(*) AS transactions, SUM(subtotal) AS subtotal, SUM(discount_amount) AS discounts, SUM(total) AS total FROM orders GROUP BY payment_method,status ORDER BY payment_method,status');
  for(const payment of payments){
    const source=snapshot.tables.orders.rows.filter(o=>o.payment_method===payment.payment_method && o.status===payment.status);
    if(source.length!==Number(payment.transactions))throw Error('Payment count mismatch');
    for(const [column,key] of [['subtotal','subtotal'],['discount_amount','discounts'],['total','total']])if(!source.reduce((s,o)=>s.plus(o[column]),new Decimal(0)).eq(payment[key]))throw Error('Payment totals mismatch');
  }
  const {rows:indexes}=await client.query(`SELECT t.relname AS table_name, i.indisunique AS unique, i.indisprimary AS primary,
    array_agg(a.attname::text ORDER BY k.n) AS columns
    FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace ns ON ns.oid=t.relnamespace
    CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum,n)
    JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum
    WHERE ns.nspname='public' GROUP BY t.relname,i.indexrelid,i.indisunique,i.indisprimary`);
  const expected=Object.values(Object.groupBy(snapshot.metadata.STATISTICS,i=>i.TABLE_NAME+'.'+i.INDEX_NAME)).map(parts=>{
    parts.sort((a,b)=>a.SEQ_IN_INDEX-b.SEQ_IN_INDEX);
    return {table_name:parts[0].TABLE_NAME,unique:Number(parts[0].NON_UNIQUE)===0,primary:parts[0].INDEX_NAME==='PRIMARY',columns:parts.map(i=>i.COLUMN_NAME)};
  });
  const indexKey=i=>[i.table_name,i.columns.join(','),i.unique,i.primary].join('|');
  if(JSON.stringify(indexes.map(indexKey).sort())!==JSON.stringify(expected.map(indexKey).sort()))throw Error('PostgreSQL indexes differ from source');
  report.indexes={source:expected.length,target:indexes.length,definitionsMatch:true};
  report.identities=[];
  for(const col of snapshot.metadata.COLUMNS.filter(c=>c.EXTRA.includes('auto_increment'))){
    const {rows:[sequence]}=await client.query('SELECT pg_get_serial_sequence($1,$2) AS name',[col.TABLE_NAME,col.COLUMN_NAME]);
    const {rows:[state]}=await client.query('SELECT last_value,is_called FROM '+sequence.name.split('.').map(q).join('.'));
    const next=Number(state.last_value)+(state.is_called?1:0);
    const sourceNext=Number(snapshot.tables[col.TABLE_NAME].autoIncrement || 1);
    if(next<sourceNext)throw Error('Identity sequence regressed for '+col.TABLE_NAME);
    report.identities.push({table:col.TABLE_NAME,next,sourceNext});
  }
  report.payments=payments;
  return report;
}
async function migrate(directory) {
  const { dir, snapshot } = verifiedSnapshot(directory);
  const database = process.env.PG_DATABASE;
  if (!database || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(database)) throw Error('Invalid destination database name');
  const admin = new Pool(options(process.env.PG_ADMIN_DATABASE || 'postgres'));
  let target, client;
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database]);
    if (!exists.rowCount) await admin.query(`CREATE DATABASE ${q(database)} ENCODING 'UTF8' TEMPLATE template0`);
    target = new Pool(options()); client = await target.connect();
    const {rows:existing}=await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    if(existing.length)throw Error('Destination is not empty. Refusing to overwrite existing PostgreSQL records.');
    await client.query('BEGIN');
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    await client.query(fs.readFileSync(path.join(__dirname,'../../database/schema.postgresql.sql'),'utf8'));
    for(const table of orderedTables(snapshot)){
      const cols=columns(snapshot,table);
      for(const row of snapshot.tables[table].rows){
        const values=cols.map(c=>c.DATA_TYPE==='timestamp' && row[c.COLUMN_NAME]!==null ? normalize(row[c.COLUMN_NAME],c) : row[c.COLUMN_NAME]);
        await client.query(`INSERT INTO ${q(table)} (${cols.map(c=>q(c.COLUMN_NAME)).join(',')}) VALUES (${values.map((_,i)=>'$'+(i+1)).join(',')})`,values);
      }
      const identity=cols.find(c=>c.EXTRA.includes('auto_increment'));
      if(identity){
        const max=snapshot.tables[table].rows.reduce((m,r)=>Math.max(m,Number(r[identity.COLUMN_NAME])),0);
        const next=Math.max(max+1,Number(snapshot.tables[table].autoIncrement || 1));
        await client.query('SELECT setval(pg_get_serial_sequence($1,$2),$3,false)',[table,identity.COLUMN_NAME,next]);
      }
    }
    const report=await validate(client,snapshot);
    const {rows:constraints}=await client.query("SELECT contype, COUNT(*) n FROM pg_constraint WHERE connamespace='public'::regnamespace GROUP BY contype");
    report.constraints=constraints;
    report.source=snapshot.source;report.destination=database;report.host=process.env.PG_HOST;report.port=process.env.PG_PORT;report.completedAt=new Date().toISOString();
    await client.query('COMMIT');
    fs.writeFileSync(path.join(dir,'postgresql-validation.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } catch(err){if(client)await client.query('ROLLBACK');throw err;}
  finally {if(client)client.release();if(target)await target.end();await admin.end();}
}
if(require.main===module){if(!process.argv[2])throw Error('Usage: node scripts/migrate-postgresql.js <verified-backup-directory>');migrate(process.argv[2]).catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={verifiedSnapshot,validate,orderedTables,columns,normalize};
