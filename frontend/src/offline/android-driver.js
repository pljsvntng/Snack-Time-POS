import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { bytes64, offlineError } from './security.js';

export async function openAndroidDatabase() {
 const name='snack_time_offline';
 const sqlite=new SQLiteConnection(CapacitorSQLite);
 await sqlite.checkConnectionsConsistency();
 const exists=(await sqlite.isDatabase(name)).result;
 const hasSecret=(await sqlite.isSecretStored()).result;
 if(!hasSecret){
  if(exists)throw offlineError('The local database encryption key is missing. Keep the app data intact and contact your administrator.');
  await sqlite.setEncryptionSecret(bytes64(crypto.getRandomValues(new Uint8Array(32))));
 }
 const db=(await sqlite.isConnection(name,false)).result?await sqlite.retrieveConnection(name,false):await sqlite.createConnection(name,true,'secret',2,false);
 try{
  if(!(await db.isDBOpen()).result)await db.open();
  if(!(await sqlite.isDatabaseEncrypted(name)).result)throw offlineError('Encrypted local storage could not be verified. Offline POS is disabled.');
 }catch(error){try{await sqlite.closeConnection(name,false);}catch{}throw error;}
 const driver={
  query:async(sql,values=[]) => (await db.query(sql,values)).values||[],
  run:async(sql,values=[]) => { const result=await db.run(sql,values,false);return {changes:result.changes?.changes??0}; },
  execute:async sql=>{await db.execute(sql,false);},
  transaction:async fn=>{await db.beginTransaction();try{const value=await fn();await db.commitTransaction();return value;}catch(e){await db.rollbackTransaction();throw e;}},
  close:()=>sqlite.closeConnection(name,false),
 };
 return driver;
}
