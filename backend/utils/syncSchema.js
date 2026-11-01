const fs=require('node:fs'),path=require('node:path');
async function ensureSyncSchema(pool=require('../config/db')){
 const c=await pool.connect();try{
  await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(731042,12)');
  if(!(await c.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='offline_sales'")).rowCount)await c.query(fs.readFileSync(path.resolve(__dirname,'../../database/synchronization.postgresql.sql'),'utf8'));
  await c.query(fs.readFileSync(path.resolve(__dirname,'../../database/checkout-idempotency.postgresql.sql'),'utf8'));
  await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
module.exports={ensureSyncSchema};
