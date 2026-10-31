// Owner-only test credential transport; never imported by the React application.
// PostgreSQL/SQLite authentication stores one-way hashes, not these credentials.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const vaultPath=path.resolve(__dirname,'../.credentials.dpapi.json');
function transform(value,decrypt=false){
 if(process.platform!=='win32')throw Error('The protected owner vault requires the Windows account that created it. Use the hidden password prompt instead.');
 const action=decrypt?'Unprotect':'Protect';
 const script=`$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; [Console]::InputEncoding=[Text.Encoding]::UTF8; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $value=[Console]::In.ReadToEnd(); $entropy=[Text.Encoding]::UTF8.GetBytes('SnackTimePOS.OwnerCredentials.v1'); `+(decrypt?`$bytes=[Security.Cryptography.ProtectedData]::${action}([Convert]::FromBase64String($value),$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Text.Encoding]::UTF8.GetString($bytes))`:`$bytes=[Security.Cryptography.ProtectedData]::${action}([Text.Encoding]::UTF8.GetBytes($value),$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($bytes))`);
 const shell=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
 const result=spawnSync(shell,['-NoProfile','-NonInteractive','-Command',script],{input:value,encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:1024*1024});
 if(result.error||result.status!==0)throw Error('Windows credential protection failed. No plaintext fallback was used.');
 return result.stdout.replace(/^\uFEFF/,'').trim();
}
function readVault(file=vaultPath){const saved=JSON.parse(fs.readFileSync(file,'utf8'));if(saved.version!==1||saved.protection!=='DPAPI.CurrentUser')throw Error('Unsupported protected credentials file.');return JSON.parse(transform(saved.ciphertext,true));}
function saveVault(data,file=vaultPath){
 const ciphertext=transform(JSON.stringify(data));
 if(transform(ciphertext,true)!==JSON.stringify(data))throw Error('Protected credential verification failed.');
 const temporary=file+'.pending';fs.writeFileSync(temporary,JSON.stringify({version:1,protection:'DPAPI.CurrentUser',ciphertext},null,2),{mode:0o600});fs.renameSync(temporary,file);
}
function ownerAccounts(){return readVault().accounts;}
function migrateLegacy(){
 const file=path.resolve(__dirname,'../.env.cloud-credentials'),dotenv=require('dotenv');
 if(!fs.existsSync(file))return {migrated:false};
 const saved=dotenv.parse(fs.readFileSync(file));if(!saved.CLOUD_ACCOUNTS_JSON)return {migrated:false};
 const data={targetHost:saved.CLOUD_TARGET_HOST,targetDatabase:saved.CLOUD_TARGET_DATABASE,accounts:JSON.parse(saved.CLOUD_ACCOUNTS_JSON)};
 if(fs.existsSync(vaultPath)){if(JSON.stringify(readVault())!==JSON.stringify(data))throw Error('An existing protected vault differs; neither credentials file was overwritten.');}
 else saveVault(data);
 // Verify protection before removing the obsolete plaintext values. No DB writes.
 if(JSON.stringify(readVault())!==JSON.stringify(data))throw Error('Protected credentials verification failed.');
 fs.writeFileSync(file,'# Passwords moved to Windows DPAPI storage. No plaintext passwords remain here.\nCLOUD_TARGET_HOST='+data.targetHost+'\nCLOUD_TARGET_DATABASE='+data.targetDatabase+'\n',{mode:0o600});
 return {migrated:true,accounts:data.accounts.map(a=>a.username)};
}
module.exports={readVault,saveVault,ownerAccounts,migrateLegacy,vaultPath};
