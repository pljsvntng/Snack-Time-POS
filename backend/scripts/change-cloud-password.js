const fs=require('node:fs'),path=require('node:path');
require('dotenv').config({path:path.join(__dirname,'../.env.neon')});
async function change(){
 const credentials=require('dotenv').parse(fs.readFileSync(path.join(__dirname,'../.env.cloud-credentials')));
 if(!credentials.CLOUD_USERNAME||!credentials.CLOUD_NEW_PASSWORD||credentials.CLOUD_NEW_PASSWORD.length<12||['admin123','cashier123'].includes(credentials.CLOUD_NEW_PASSWORD))throw Error('Set CLOUD_USERNAME and a unique 12+ character CLOUD_NEW_PASSWORD in backend/.env.cloud-credentials.');
 if(!process.env.DATABASE_URL||!new URL(process.env.DATABASE_URL).hostname.endsWith('.neon.tech'))throw Error('A Neon DATABASE_URL is required. Local databases will not be changed.');
 const {Pool,options}=require('../config/postgresql'),pool=new Pool(options());
 try{
  const hash=await require('bcrypt').hash(credentials.CLOUD_NEW_PASSWORD,12);
  const result=await pool.query('UPDATE users SET password_hash=$1 WHERE username=$2',[hash,credentials.CLOUD_USERNAME]);
  if(result.rowCount!==1)throw Error('Cloud user not found.');
  console.log('Cloud password updated for '+credentials.CLOUD_USERNAME+'. The local database was not modified. Remove the private password entry after signing in.');
 }finally{await pool.end();}
}
change().catch(e=>{console.error(e.message);process.exitCode=1;});
