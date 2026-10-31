// Source is read-only. Restores are restricted to a new local verification DB
// and an EMPTY Neon database. No --clean, DROP SCHEMA or source writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
require('dotenv').config({path:path.join(__dirname,'../.env.neon')});
const {Pool,options}=require('../config/postgresql');
const quote=s=>'"'+s.replaceAll('"','""')+'"';
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function canonicalConstraint(definition){
  // pg_dump/restore re-parses varchar-constant arrays as individually cast
  // text constants. Normalize ONLY those lossless constant casts, preserving
  // column casts, predicates and every allowed value.
  const literal="'(?:[^']|'')*'";
  let value=definition.replace(new RegExp('('+literal+')::character varying','g'),'$1::text');
  value=value.replace(new RegExp('\\(('+literal+'::text)\\)::text','g'),'$1');
  return value.replace(/\(ARRAY\[((?:'(?:[^']|'')*'::text)(?:, '(?:[^']|'')*'::text)*)\]\)::text\[\]/g,'ARRAY[$1]');
}
function localOptions(database){
  const saved=process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try{return options(database);}finally{if(saved)process.env.DATABASE_URL=saved;}
}
function binary(name){
  if(process.env.PG_BIN)return path.join(process.env.PG_BIN,name+(process.platform==='win32'?'.exe':''));
  const installed=path.join('C:/Program Files/PostgreSQL/18/bin',name+'.exe');
  return process.platform==='win32'&&fs.existsSync(installed)?installed:name;
}
async function command(name,args,config){
  const env={...process.env,PGHOST:config.host,PGPORT:String(config.port),PGUSER:config.user,PGPASSWORD:config.password,PGSSLMODE:config.ssl?'verify-full':'disable',PGTZ:'Asia/Manila'};
  // libpq on Windows does not automatically use Node's trusted CA bundle.
  // Supply the same public roots rather than weakening certificate checks.
  let caDirectory,caFile;
  if(config.ssl){caDirectory=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'snacktime-pg-ca-'));caFile=path.join(caDirectory,'roots.pem');fs.writeFileSync(caFile,require('node:tls').getCACertificates().join('\n'),{mode:0o600});env.PGSSLROOTCERT=caFile;}
  try{return await new Promise((resolve,reject)=>{
    const child=spawn(binary(name),args,{env,windowsHide:true,stdio:['ignore','ignore','pipe']});let stderr='';
    child.stderr.on('data',data=>{stderr+=data.toString();});
    child.on('error',()=>reject(Error('Cannot execute '+name+'. Install PostgreSQL client tools or set PG_BIN.')));
    child.on('exit',code=>code===0?resolve():reject(Error(name+' failed (exit '+code+'). '+stderr.replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[redacted connection]'))));
  });}finally{if(caFile)fs.unlinkSync(caFile);if(caDirectory)fs.rmdirSync(caDirectory);}
}
async function fingerprint(client){
  await client.query("SET TIME ZONE 'Asia/Manila'");
  const {rows:tables}=await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  const result={tables:{},financialTotals:{}};
  for(const {tablename:table} of tables){
    const {rows}=await client.query(`SELECT to_jsonb(t)::text AS row FROM ${quote(table)} t ORDER BY to_jsonb(t)::text COLLATE "C"`);
    result.tables[table]={count:rows.length,sha256:digest(JSON.stringify(rows))};
    const {rows:decimals}=await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND data_type='numeric' ORDER BY column_name",[table]);
    for(const {column_name:column} of decimals){
      const {rows:[sum]}=await client.query(`SELECT COALESCE(SUM(${quote(column)}),0)::text total FROM ${quote(table)}`);
      result.financialTotals[table+'.'+column]=sum.total;
    }
  }
  const {rows:constraints}=await client.query("SELECT c.relname AS table_name,t.conname,t.contype,pg_get_constraintdef(t.oid) definition FROM pg_constraint t JOIN pg_class c ON c.oid=t.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,t.conname");
  const {rows:indexes}=await client.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname");
  const {rows:columns}=await client.query("SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default,character_maximum_length,numeric_precision,numeric_scale,datetime_precision,is_identity,identity_generation,identity_start,identity_increment,collation_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position");
  result.constraints=constraints.map(c=>({...c,definition:canonicalConstraint(c.definition)}));result.indexes=indexes;result.columns=columns;
  // Restored FK constraints are validated by pg_restore; refuse any NOT VALID FK.
  const {rows:invalid}=await client.query("SELECT conname FROM pg_constraint WHERE contype='f' AND NOT convalidated");
  if(invalid.length)throw Error('Unvalidated foreign keys require review before migration.');
  return result;
}
function compare(expected,actual){
 for(const section of ['tables','financialTotals','constraints','indexes','columns']){
  if(JSON.stringify(expected[section])!==JSON.stringify(actual[section])){
   const key=section==='tables'?Object.keys(expected.tables).find(t=>JSON.stringify(expected.tables[t])!==JSON.stringify(actual.tables[t])):'';
   throw Error('Database verification failed in '+section+(key?' ('+key+')':'')+'. No migration was declared successful.');
  }
 }
}
async function backup(){
  const config=localOptions(),pool=new Pool(config),client=await pool.connect();
  const dir=path.resolve(__dirname,'../../database/backups','postgresql-'+new Date().toISOString().replace(/[:.]/g,'-'));
  fs.mkdirSync(dir,{recursive:true});const dump=path.join(dir,'postgresql.dump');
  let maintenance,temporary;
  try{
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const {rows:[snapshot]}=await client.query('SELECT pg_export_snapshot() id');
    const expected=await fingerprint(client);
    await command('pg_dump',['--format=custom','--no-owner','--no-acl','--snapshot',snapshot.id,'--file',dump,'--dbname',config.database],config);
    const manifest={createdAt:new Date().toISOString(),sourceDatabase:config.database,dumpSHA256:digest(fs.readFileSync(dump)),restoredAndCompared:false,snapshot:expected,photos:[]};
    const publicRoot=path.resolve(__dirname,'../../frontend/public');
    const {rows:photos}=await client.query("SELECT DISTINCT image FROM products WHERE image LIKE '/images/%'");
    for(const {image} of photos){
      if(expected.tables.product_images&&(await client.query('SELECT 1 FROM product_images WHERE path=$1',[image])).rowCount)continue;
      const original=path.resolve(publicRoot,'.'+image);
      if(!original.startsWith(publicRoot+path.sep))throw Error('Unsafe product photo path in database.');
      const data=fs.readFileSync(original),destination=path.join(dir,'public',image.slice(1));
      fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,data);
      manifest.photos.push({path:image,sha256:digest(data),bytes:data.length});
    }
    await client.query('COMMIT');
    fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
    const verification='snacktime_restore_'+crypto.randomBytes(8).toString('hex');
    maintenance=new Pool(localOptions('postgres'));
    await maintenance.query('CREATE DATABASE '+quote(verification));temporary=verification;
    await command('pg_restore',['--exit-on-error','--single-transaction','--no-owner','--no-privileges','--dbname',verification,dump],config);
    const restored=new Pool(localOptions(verification));
    try{const check=await restored.connect();try{const actual=await fingerprint(check);fs.writeFileSync(path.join(dir,'restore-verification.json'),JSON.stringify(actual,null,2));compare(expected,actual);}finally{check.release();}}finally{await restored.end();}
    manifest.restoredAndCompared=true;
    fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
    console.log('Verified PostgreSQL backup: '+dir);
    console.log('All record values, decimal totals, indexes and constraints match the test restore.');
    return {dir,manifest};
  }finally{
    await client.query('ROLLBACK').catch(()=>{});client.release();await pool.end();
    if(temporary){if(!/^snacktime_restore_[a-f0-9]{16}$/.test(temporary))throw Error('Unsafe verification DB name');await maintenance.query('DROP DATABASE '+quote(temporary));}
    if(maintenance)await maintenance.end();
  }
}
async function migrate(){
  if(!process.env.NEON_DATABASE_URL)throw Error('Set NEON_DATABASE_URL in backend/.env.neon to the new empty Neon database direct connection.');
  const url=new URL(process.env.NEON_DATABASE_URL);
  if(!url.hostname.endsWith('.neon.tech')||url.hostname.includes('-pooler.'))throw Error('Use the Neon DIRECT (unpooled) migration connection.');
  const previous=process.env.DATABASE_URL;process.env.DATABASE_URL=process.env.NEON_DATABASE_URL;
  const targetConfig=options();if(previous)process.env.DATABASE_URL=previous;else delete process.env.DATABASE_URL;
  const target=new Pool(targetConfig);
  try{
    const {rows:tables}=await target.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    if(tables.length)throw Error('Target database is not empty. Nothing was overwritten. Create a new empty Neon database.');
    const {dir,manifest}=await backup();
    const dump=path.join(dir,'postgresql.dump');
    if(digest(fs.readFileSync(dump))!==manifest.dumpSHA256||!manifest.restoredAndCompared)throw Error('Backup verification failed.');
    await command('pg_restore',['--exit-on-error','--single-transaction','--no-owner','--no-privileges','--dbname',targetConfig.database,dump],targetConfig);
    const client=await target.connect();let actual;
    try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');actual=await fingerprint(client);compare(manifest.snapshot,actual);await client.query('COMMIT');}finally{await client.query('ROLLBACK').catch(()=>{});client.release();}
    const images=await target.connect();
    try{
      await images.query('BEGIN');await images.query(fs.readFileSync(path.join(__dirname,'../../database/cloud-storage.postgresql.sql'),'utf8'));
      for(const photo of manifest.photos){
        const contents=fs.readFileSync(path.join(dir,'public',photo.path.slice(1)));
        if(digest(contents)!==photo.sha256)throw Error('Backed-up product photo checksum mismatch.');
        const mime=require('../utils/productImages').imageType(contents,{bundledSvg:photo.path.toLowerCase().endsWith('.svg')});
        await images.query('INSERT INTO product_images(path,mime_type,contents) VALUES($1,$2,$3)',[photo.path,mime,contents]);
        const {rows:[stored]}=await images.query('SELECT contents FROM product_images WHERE path=$1',[photo.path]);
        if(digest(stored.contents)!==photo.sha256)throw Error('Migrated product photo checksum mismatch.');
      }
      await images.query('COMMIT');
    }catch(e){await images.query('ROLLBACK');throw e;}finally{images.release();}
    fs.writeFileSync(path.join(dir,'neon-validation.json'),JSON.stringify({verifiedAt:new Date().toISOString(),host:targetConfig.host,allValuesMatch:true,photosVerified:manifest.photos.length,...actual},null,2));
    console.log('Neon migration verified. The original local PostgreSQL and MariaDB databases were not modified.');
    console.log('Keep local sales paused until the verified cloud endpoint is used, or repeat migration into another empty Neon database.');
  }finally{await target.end();}
}
module.exports={fingerprint,compare,localOptions,backup,canonicalConstraint,command};
if(require.main===module){const action=process.argv[2];(action==='backup'?backup:action==='migrate'?migrate:async()=>{throw Error('Usage: node scripts/migrate-neon.js backup|migrate');})().catch(e=>{console.error(e.message);process.exitCode=1;});}
