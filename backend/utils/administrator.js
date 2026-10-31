const bcrypt=require('bcrypt');
const {administratorPassword}=require('./passwordPolicy');
const fields='u.id,u.username,u.email,u.active,r.name AS role';
async function administrators(db){return (await db.query(`SELECT ${fields} FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='admin' ORDER BY u.active DESC,u.id`)).rows;}
async function setupAdministrator(pool,{username,email,fullName='Administrator',password}){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(731042,11)');
  const existing=await administrators(client);if(existing.length){await client.query('COMMIT');return {created:false,administrators:existing};}
  administratorPassword(password);
  const {rows:[role]}=await client.query("SELECT id FROM roles WHERE name='admin'");if(!role)throw Error('Administrator role is missing. Restore the existing role schema first.');
  let name=username||'admin';
  if(username&&(!username.trim()||username.length>60))throw Error('Choose an administrator username of 1–60 characters.');
  name=name.trim();let n=2;
  while((await client.query('SELECT 1 FROM users WHERE username=$1',[name])).rowCount){if(username)throw Error('That username is already taken. Existing account permissions were preserved.');name='admin'+n++;}
  const hash=await bcrypt.hash(password,12);
  const {rows:[user]}=await client.query('INSERT INTO users(role_id,full_name,username,email,password_hash,active) VALUES($1,$2,$3,$4,$5,1) RETURNING id,username,email,active',[role.id,fullName,name,email||null,hash]);
  await client.query('COMMIT');return {created:true,administrators:[{...user,role:'admin'}]};
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
async function resetAdministrator(pool,{username,password,approved=false}){
 if(!approved)throw Error('Password reset was not explicitly approved.');administratorPassword(password);
 const hash=await bcrypt.hash(password,12),client=await pool.connect();
 try{
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(731042,11)');
  const {rows:[user]}=await client.query(`SELECT ${fields} FROM users u JOIN roles r ON r.id=u.role_id WHERE u.username=$1 AND r.name='admin' FOR UPDATE OF u`,[username]);
  if(!user)throw Error('Administrator not found. No existing account was changed.');
  await client.query('UPDATE users SET password_hash=$1 WHERE id=$2',[hash,user.id]);await client.query('COMMIT');return user;
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
module.exports={administrators,setupAdministrator,resetAdministrator};
