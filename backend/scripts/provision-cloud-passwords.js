// Run only after the owner authorizes replacing public demo passwords in Neon.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dotenv=require('dotenv');
dotenv.config({path:path.join(__dirname,'../.env.neon')});
async function provision(){
 if(!process.argv.includes('--rotate-demo'))throw Error('Explicit --rotate-demo is required.');
 const url=new URL(process.env.DATABASE_URL);
 if(!url.hostname.endsWith('.neon.tech'))throw Error('Only a Neon cloud database can be changed.');
 const {Pool,options}=require('../config/postgresql'),pool=new Pool(options()),bcrypt=require('bcrypt');
 const file=path.join(__dirname,'../.env.cloud-credentials');
 let credentials;
 try{
  if(fs.existsSync(file)){
   const saved=dotenv.parse(fs.readFileSync(file));
   if(saved.CLOUD_TARGET_HOST!==url.hostname||saved.CLOUD_TARGET_DATABASE!==decodeURIComponent(url.pathname.slice(1))||!saved.CLOUD_ACCOUNTS_JSON)throw Error('Existing private credentials file belongs to another setup; it was not overwritten.');
   credentials=JSON.parse(saved.CLOUD_ACCOUNTS_JSON);
  }else{
   credentials=[];const {rows}=await pool.query('SELECT username,password_hash FROM users WHERE active=1');
   for(const user of rows)for(const known of ['admin123','cashier123'])if(await bcrypt.compare(known,user.password_hash)){credentials.push({username:user.username,password:crypto.randomBytes(24).toString('base64url')});break;}
   if(!credentials.length){console.log('No cloud accounts use the public demo passwords.');return;}
   const serialized=JSON.stringify(credentials).replaceAll("'",'\\u0027');
   fs.writeFileSync(file,'# Private cloud logins. Never commit or share this file.\nCLOUD_TARGET_HOST='+url.hostname+'\nCLOUD_TARGET_DATABASE='+decodeURIComponent(url.pathname.slice(1))+'\nCLOUD_ACCOUNTS_JSON=\''+serialized+'\'\n',{flag:'wx',mode:0o600});
  }
  if(!Array.isArray(credentials)||!credentials.length||credentials.some(c=>typeof c.username!=='string'||typeof c.password!=='string'||c.password.length<24))throw Error('Invalid private cloud credentials file.');
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   for(const account of credentials){
    const {rows:[user]}=await client.query('SELECT password_hash FROM users WHERE username=$1 FOR UPDATE',[account.username]);
    if(!user)throw Error('Cloud account no longer exists: '+account.username);
    if(await bcrypt.compare(account.password,user.password_hash))continue;
    const isDemo=(await Promise.all(['admin123','cashier123'].map(value=>bcrypt.compare(value,user.password_hash)))).some(Boolean);
    if(!isDemo)throw Error('The cloud password for '+account.username+' was independently changed; it was preserved.');
    await client.query('UPDATE users SET password_hash=$1 WHERE username=$2',[await bcrypt.hash(account.password,12),account.username]);
   }
   await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  for(const account of credentials){const {rows:[row]}=await pool.query('SELECT password_hash FROM users WHERE username=$1',[account.username]);if(!await bcrypt.compare(account.password,row.password_hash))throw Error('Cloud password verification failed.');}
  console.log('Strong cloud passwords set and verified for: '+credentials.map(c=>c.username).join(', ')+'.');
  console.log('Read backend/.env.cloud-credentials privately. Local databases and local logins were not modified.');
 }finally{await pool.end();}
}
provision().catch(e=>{console.error(e.message);process.exitCode=1;});
