import { DatabaseSync } from 'node:sqlite';
export function openTestDatabase(file) {
 const db=new DatabaseSync(file);
 return { db, query:async(sql,values=[])=>db.prepare(sql).all(...values),run:async(sql,values=[])=>{const r=db.prepare(sql).run(...values);return {changes:Number(r.changes)};},execute:async sql=>db.exec(sql),transaction:async fn=>{db.exec('BEGIN IMMEDIATE');try{const result=await fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}},close:()=>db.close() };
}
