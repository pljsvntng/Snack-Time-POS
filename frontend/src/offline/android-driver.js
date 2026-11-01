import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import {registerPlugin} from '@capacitor/core';
import {openSecureAndroidConnection} from './secure-android-open.js';
const diagnostics=registerPlugin('SnackTimeStorageDiagnostics');

export async function openAndroidDatabase() {
 const name='snack_time_offline';
 const sqlite=new SQLiteConnection(CapacitorSQLite);
 const db=await openSecureAndroidConnection(sqlite,diagnostics);
 const driver={
  query:async(sql,values=[]) => (await db.query(sql,values)).values||[],
  run:async(sql,values=[]) => { const result=await db.run(sql,values,false);return {changes:result.changes?.changes??0}; },
  execute:async sql=>{await db.execute(sql,false);},
  transaction:async fn=>{await db.beginTransaction();try{const value=await fn();await db.commitTransaction();return value;}catch(e){await db.rollbackTransaction();throw e;}},
  close:()=>sqlite.closeConnection(name,false),
 };
 return driver;
}
