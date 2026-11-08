// Owner-run hidden local setup for either presentation account. No chat secrets.
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--username'||!['admin','juan'].includes(args[1]))throw Error('Use npm run demo:password -- --username admin|juan. Do not pass passwords as arguments.');
 const username=args[1],config=require('dotenv').parse(fs.readFileSync(path.join(__dirname,'../.env.demo')));
 if(config.POS_DATABASE_ID!=='demo:bitter-salad-90425468'||!new URL(config.DATABASE_URL).hostname.startsWith('ep-spring-wave-benqsh0o'))throw Error('Demo target guard refused the connection.');
 const {hiddenPrompt}=require('../utils/hiddenPrompt');
 console.log('Target: snacktime-pos-demo; username: '+username+'. Existing original accounts are separate.');
 if(await hiddenPrompt('Approve changing this demo account by typing its username (hidden): ')!==username)throw Error('Reset not approved.');
 const password=await hiddenPrompt('New unique passphrase (hidden, 15+ characters): ');
 if(await hiddenPrompt('Confirm passphrase (hidden): ')!==password)throw Error('Passphrases do not match.');
 require('../utils/passwordPolicy').administratorPassword(password);
 const vault=require('../utils/ownerCredentialVault'),file=path.join(__dirname,'../.credentials.demo.dpapi.json'),data=vault.readVault(file);
 Object.assign(process.env,config);const {Pool,options}=require('../config/postgresql'),pool=new Pool(options());
 try{
  const hash=await require('bcrypt').hash(password,12),result=await pool.query('UPDATE users SET password_hash=$1 WHERE username=$2 AND id=ANY($3::integer[])',[hash,username,[10001,10002]]);if(result.rowCount!==1)throw Error('Demo account was not found.');
  data.accounts.find(account=>account.username===username).password=password;vault.saveVault(data,file);
  if(fs.existsSync(vault.vaultPath)){const current=vault.readVault();if(current.targetHost===data.targetHost&&current.targetDatabase===data.targetDatabase)vault.saveVault(data);}
  console.log('Demo password updated securely. Sign in online again to renew this device authorization.');
 }finally{await pool.end();}
})().catch(()=>{console.error('Demo password command did not complete. Check the selected account and passphrase; no secrets were logged.');process.exitCode=1;});
