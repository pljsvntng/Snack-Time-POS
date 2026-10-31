const fs=require('node:fs'),path=require('node:path');
const {hiddenPrompt}=require('../utils/hiddenPrompt');
const {administrators,setupAdministrator,resetAdministrator}=require('../utils/administrator');
async function main(){
 const [command,...args]=process.argv.slice(2),allowed=new Set(['--target','--username','--email','--name']);const settings={};
 if(!['status','setup','reset'].includes(command))throw Error('Use admin:status, admin:setup or admin:reset with --target cloud|local.');
 for(let i=0;i<args.length;i+=2){if(!allowed.has(args[i])||!args[i+1]||args[i+1].startsWith('--'))throw Error('Unsupported arguments. Never put passwords in command arguments.');settings[args[i].slice(2)]=args[i+1];}
 if(!['cloud','local'].includes(settings.target))throw Error('Select --target cloud or --target local explicitly.');
 const {Pool,options}=require('../config/postgresql');
 if(settings.target==='cloud'){
  const config=require('dotenv').parse(fs.readFileSync(path.join(__dirname,'../.env.neon')));
  if(!config.DATABASE_URL||!new URL(config.DATABASE_URL).hostname.endsWith('.neon.tech'))throw Error('Configure the private Neon DATABASE_URL first.');
  process.env.DATABASE_URL=config.DATABASE_URL;
 }else delete process.env.DATABASE_URL;
 const pool=new Pool(options());
 try{
  const current=await administrators(pool);console.log('Target: '+settings.target+' PostgreSQL.');
  for(const user of current)console.log(JSON.stringify({username:user.username,email:user.email,active:Boolean(user.active),role:user.role}));
  if(command==='status')return;
  if(command==='setup'&&current.length){console.log('Administrator already exists. No account or password was changed.');return;}
  let selected;
  if(command==='reset'){
   selected=settings.username?current.find(u=>u.username.toLowerCase()===settings.username.toLowerCase()):current.length===1?current[0]:null;
   if(!selected)throw Error('Select an existing administrator using --username. No account was changed.');
   const confirmation=await hiddenPrompt('To approve resetting this '+settings.target+' account, type its username (hidden): ');
   if(confirmation!==selected.username)throw Error('Reset not approved. No password was changed.');
  }
  let password=await hiddenPrompt('New administrator passphrase (hidden, 15+ characters): ');
  const confirmation=await hiddenPrompt('Confirm passphrase (hidden): ');
  if(password!==confirmation)throw Error('Passphrases do not match. No password was changed.');
  const result=command==='reset'?await resetAdministrator(pool,{username:selected.username,password,approved:true}):await setupAdministrator(pool,{username:settings.username,email:settings.email,fullName:settings.name||'Administrator',password});
  if(command==='reset'&&settings.target==='cloud'){
   const vault=require('../utils/ownerCredentialVault');
   if(fs.existsSync(vault.vaultPath))try{
    const data=vault.readVault(),config=options();
    if(data.targetHost===config.host&&data.targetDatabase===config.database){const entry=data.accounts.find(a=>a.username===selected.username);if(entry){entry.password=password;vault.saveVault(data);}}
   }catch{console.error('Password changed, but the protected owner test credential could not be refreshed. The new database password is active.');}
  }
  password='';
  console.log(command==='reset'?'Administrator password reset. Active status, roles and other accounts were preserved.':'Administrator setup completed.');
  if(result.administrators)for(const u of result.administrators)console.log(JSON.stringify({username:u.username,email:u.email,active:Boolean(u.active)}));
  if(command==='reset')console.log('Online sessions using the old password are invalidated. Sign in online again on each Android device to renew its offline verifier.');
 }finally{await pool.end();}
}
main().catch(e=>{
 // Never log raw database detail, command arguments, hashes or secret input.
 const safe=/^(Use |Select |Unsupported |Configure |Administrator |That username |Choose |A private |Cancelled|Reset not |Passphrases |Password reset |New |Online |The protected |Windows |Existing )/.test(e.message);
 console.error(safe?e.message:e.statusCode===400?e.message:'Administrator command failed. Check database access and password policy; no secrets were logged.');process.exitCode=1;
});
