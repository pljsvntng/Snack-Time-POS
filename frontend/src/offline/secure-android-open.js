import {bytes64,offlineError} from './security.js';

const DATABASE='snack_time_offline';
const messages={
 CONFIG_DISABLED:'Native database encryption is not enabled.',
 MISSING_KEY:'The existing database encryption key is unavailable. Keep app data intact; do not clear storage.',
 HANDLE_UNKEYED:'The native database connection did not confirm SQLCipher encryption.',
 FILE_NOT_ENCRYPTED:'Encrypted local storage could not be verified after initialization.',
 NATIVE_FAILURE:'Secure storage could not finish opening. Keep app data intact and retry.',
 MALFORMED_RESULT:'The native storage plugin returned an unexpected result.'
};
// No application rows, user_version changes, key changes or destructive recovery.
export async function openSecureAndroidConnection(sqlite,diagnostics){
 let db,stage='configuration',code='NATIVE_FAILURE';
 const record=async(value)=>{try{await diagnostics.record({stage,code:value});}catch{}};
 const stop=value=>{code=value;throw Error('storage check failed');};
 const keyed=async()=>{
  const result=await db.query('PRAGMA cipher_status;');
  if(!Array.isArray(result?.values)||result.values.length!==1||Number(result.values[0].cipher_status)!==1)stop('HANDLE_UNKEYED');
 };
 try{
  await record('BEGIN');
  if((await sqlite.isInConfigEncryption()).result!==true)stop('CONFIG_DISABLED');
  await sqlite.checkConnectionsConsistency();
  stage='key';
  const exists=(await sqlite.isDatabase(DATABASE)).result,hasSecret=(await sqlite.isSecretStored()).result;
  if(typeof exists!=='boolean'||typeof hasSecret!=='boolean')stop('MALFORMED_RESULT');
  if(!hasSecret){
   // Inspect artifacts before generating a first-install key, including an orphan WAL.
   const state=await diagnostics.inspectState();
   if(typeof state?.databasePresent!=='boolean'||typeof state?.walPresent!=='boolean'||typeof state?.journalPresent!=='boolean')stop('MALFORMED_RESULT');
   if(exists||state.databasePresent||state.walPresent||state.journalPresent)stop('MISSING_KEY');
   await sqlite.setEncryptionSecret(bytes64(crypto.getRandomValues(new Uint8Array(32))));
   if((await sqlite.isSecretStored()).result!==true)stop('MISSING_KEY');
  }
  await record('OK');stage='open';
  db=(await sqlite.isConnection(DATABASE,false)).result?await sqlite.retrieveConnection(DATABASE,false):await sqlite.createConnection(DATABASE,true,'secret',2,false);
  if((await db.isDBOpen()).result!==true)await db.open();
  stage='keyed_handle';await keyed();await record('OK');
  // SQLCipher leaves an untouched database empty. Its first real page must exist
  // before the plugin's separate no-key file probe can distinguish encryption.
  stage='materialize';
  await db.execute('CREATE TABLE IF NOT EXISTS _snacktime_storage_guard (id INTEGER PRIMARY KEY CHECK(id=1), format_version INTEGER NOT NULL CHECK(format_version=1));',false);
  // Close flushes/checkpoints the keyed handle before independent file verification.
  await db.close();
  stage='persisted_file';
  if((await sqlite.isDatabaseEncrypted(DATABASE)).result!==true)stop('FILE_NOT_ENCRYPTED');
  await record('OK');stage='reopen';await db.open();await keyed();
  await db.query('SELECT COUNT(*) AS schema_entries FROM sqlite_master;');
  stage='ready';await record('OK');return db;
 }catch{
  await record(code);try{if(db)await sqlite.closeConnection(DATABASE,false);}catch{}
  const error=offlineError((messages[code]||messages.NATIVE_FAILURE)+' Storage code: '+code+' / '+stage+'.');error.storageCode=code;throw error;
 }
}
