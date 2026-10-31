// Back up first, verify the archive, then apply only the additive Phase 6 tables.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
async function main(){
 const target=process.argv[2];if(!['local','cloud'].includes(target))throw Error('Usage: node scripts/migrate-synchronization.js local|cloud');
 const {Pool,options}=require('../config/postgresql');if(target==='cloud'){require('dotenv').config({path:path.resolve(__dirname,'../.env.neon'),override:true});process.env.DATABASE_URL=process.env.NEON_DATABASE_URL;}else delete process.env.DATABASE_URL;
 const config=options(),pool=new Pool(config),dir=path.resolve(__dirname,'../../database/backups/phase6-'+target+'-'+Date.now());fs.mkdirSync(dir,{recursive:true});
 try{
  const {fingerprint,command}=require('./migrate-neon');const before=await fingerprint(pool),file=path.join(dir,'pre-sync.dump');
  await command('pg_dump',['--format=custom','--no-owner','--no-privileges','--file='+file,config.database],config);await command('pg_restore',['--list',file],config);if(fs.statSync(file).size<1000)throw Error('Backup archive is incomplete.');
  await require('../utils/syncSchema').ensureSyncSchema(pool);const after=await fingerprint(pool);
  for(const table of Object.keys(before.tables)){if(JSON.stringify(before.tables[table])!==JSON.stringify(after.tables[table]))throw Error('Existing table changed: '+table);}
  for(const key of Object.keys(before.financialTotals))if(before.financialTotals[key]!==after.financialTotals[key])throw Error('Existing financial total changed.');
  fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify({createdAt:new Date().toISOString(),target,backup:file,backupSHA256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),originalTablesUnchanged:true,before,after},null,2));console.log('Verified complete '+target+' backup. Additive synchronization migration applied; original records and totals unchanged. Report: '+path.join(dir,'verification.json'));
 }finally{await pool.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
