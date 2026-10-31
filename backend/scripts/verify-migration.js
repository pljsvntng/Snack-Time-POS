const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const mysql=require('mysql2/promise');
const {verifiedSnapshot,validate}=require('./migrate-postgresql');
const {Pool,options}=require('../config/postgresql');
async function run(){
 const {dir,snapshot}=verifiedSnapshot(process.argv[2]);
 const legacy=require('dotenv').parse(fs.readFileSync(path.join(__dirname,'../.env.mariadb')));
 const source=await mysql.createConnection({host:legacy.DB_HOST,port:legacy.DB_PORT,user:legacy.DB_USER,password:legacy.DB_PASSWORD,database:legacy.DB_NAME,dateStrings:true,supportBigNumbers:true,bigNumberStrings:true});
 const pg=new Pool(options());let client;
 try{
  await source.query("SET time_zone = '+00:00'");await source.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
  for(const [table,data] of Object.entries(snapshot.tables)){
   const pk=snapshot.metadata.KEY_COLUMN_USAGE.filter(k=>k.TABLE_NAME===table && k.CONSTRAINT_NAME==='PRIMARY').sort((a,b)=>a.ORDINAL_POSITION-b.ORDINAL_POSITION);
   const [rows]=await source.query('SELECT * FROM '+source.escapeId(table)+' ORDER BY '+pk.map(k=>source.escapeId(k.COLUMN_NAME)).join(','));
   if(crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')!==data.sha256)throw Error('MariaDB source changed after backup: '+table);
  }
  await source.commit();
  client=await pg.connect();await client.query('BEGIN READ ONLY');
  const report=await validate(client,snapshot);await client.query('COMMIT');
  report.sourceUnchanged=true;report.postTestVerifiedAt=new Date().toISOString();
  fs.writeFileSync(path.join(dir,'post-test-validation.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({sourceUnchanged:true,tables:Object.keys(report.tables).length,rows:Object.values(report.tables).reduce((n,t)=>n+t.target,0),indexes:report.indexes,sales:report.financialTotals['orders.total'],discounts:report.financialTotals['orders.discount_amount'],relationshipChecks:report.relationships.length}));
 }finally{if(client)client.release();await pg.end();await source.end();}
}
run().catch(e=>{console.error(e.message);process.exitCode=1;});
