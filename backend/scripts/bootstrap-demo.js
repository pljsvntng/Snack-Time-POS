// Explicit, one-time initializer for the empty presentation project only.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
Object.assign(process.env,require('dotenv').parse(fs.readFileSync(path.join(root,'backend/.env.demo'))));
const {Pool,options}=require('../config/postgresql');
const config=options();config.host=config.host.replace('-pooler.','.');
if(process.env.POS_DATABASE_ID!=='demo:bitter-salad-90425468'||config.host!=='ep-spring-wave-benqsh0o.c-9.us-east-2.aws.neon.tech')throw Error('Demo target guard refused this connection.');
const pool=new Pool(config);
(async()=>{
 const client=await pool.connect();
 try{
  if((await client.query("SELECT 1 FROM pg_tables WHERE schemaname='public'")).rowCount)throw Error('Demo target is not empty. Nothing was reset.');
  const vault=require('../utils/ownerCredentialVault');
  const owner=vault.ownerAccounts().find(account=>account.username==='admin');if(!owner)throw Error('Owner administrator credential unavailable.');
  const accounts=[{username:'admin',password:owner.password,role:'admin',id:10001},{username:'juan',password:crypto.randomBytes(24).toString('base64url'),role:'cashier',id:10002}];
  const hashes=await Promise.all(accounts.map(account=>require('bcrypt').hash(account.password,12)));
  // Save credentials under Windows DPAPI before creating their database accounts.
  const protectedFile=path.join(root,'backend/.credentials.demo.dpapi.json');
  if(fs.existsSync(protectedFile))throw Error('Demo credential file already exists. Nothing overwritten.');
  vault.saveVault({targetHost:new URL(process.env.DATABASE_URL).hostname,targetDatabase:config.database,accounts},protectedFile);
  await client.query('BEGIN');
  await client.query(fs.readFileSync(path.join(root,'database/schema.postgresql.sql'),'utf8'));
  await client.query(fs.readFileSync(path.join(root,'database/seed.sql'),'utf8').replace(/^USE foodtrip_house_pos;\s*$/m,''));
  for(const file of ['cloud-storage.postgresql.sql','synchronization.postgresql.sql','checkout-idempotency.postgresql.sql'])await client.query(fs.readFileSync(path.join(root,'database',file),'utf8'));
  for(let i=0;i<accounts.length;i++){const a=accounts[i];await client.query('INSERT INTO users(id,role_id,full_name,username,email,password_hash,active) VALUES($1,(SELECT id FROM roles WHERE name=$2),$3,$4,$5,$6,1)',[a.id,a.role,a.role==='admin'?'Demo Administrator':'Demo Cashier',a.username,a.username+'@snacktime-demo.invalid',hashes[i]]);}
  await client.query("UPDATE settings SET setting_value='Snack Time POS' WHERE setting_key='business_name'");
  await client.query("UPDATE settings SET setting_value='PRESENTATION DEMO — THANK YOU!' WHERE setting_key='receipt_footer'");
  await client.query("UPDATE products SET track_stock=1,stock=100,low_stock_threshold=10 WHERE id=14");
  const {rows:identities}=await client.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND is_identity='YES'");
  for(const col of identities){if(!/^[a-z_]+$/.test(col.table_name)||!/^[a-z_]+$/.test(col.column_name))throw Error('Unexpected identity name');await client.query('SELECT setval(pg_get_serial_sequence($1,$2),COALESCE((SELECT MAX("'+col.column_name+'") FROM "'+col.table_name+'"),0)+1,false)',[col.table_name,col.column_name]);}
  await client.query('COMMIT');
  await client.query('ALTER DATABASE "'+config.database.replaceAll('"','""')+'" SET timezone TO \'Asia/Manila\'');
  const {rows:[counts]}=await client.query('SELECT (SELECT COUNT(*) FROM products)::int products,(SELECT COUNT(*) FROM categories)::int categories,(SELECT COUNT(*) FROM ingredients)::int ingredients,(SELECT COUNT(*) FROM users)::int users,(SELECT COUNT(*) FROM orders)::int orders');
  fs.mkdirSync(path.join(root,'database/backups/presentation-demo'),{recursive:true});
  fs.writeFileSync(path.join(root,'database/backups/presentation-demo/bootstrap.json'),JSON.stringify({project:'snacktime-pos-demo',projectId:'bitter-salad-90425468',databaseId:process.env.POS_DATABASE_ID,counts,accounts:accounts.map(({username,role,id})=>({username,role,id,active:true})),originalProjectUnchanged:true},null,2));
  console.log(JSON.stringify({connection:'verified with TLS',counts,accounts:accounts.map(({username,role})=>({username,role})),credentialStorage:'Windows DPAPI; no passwords printed'}));
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
})().catch(error=>{console.error('Demo initialization failed; no credentials logged. Code: '+(/^[A-Z0-9_]{1,40}$/.test(error.code||'')?error.code:'CHECK_CONFIGURATION'));process.exitCode=1;}).finally(()=>pool.end());
