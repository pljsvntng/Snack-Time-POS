// Owner-run, read-only browser fixture. Never an application login/reset route.
// Existing cashier passwords are not changed when a saved test password is stale.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async function cashierSession(){
 const env=require('dotenv').parse(fs.readFileSync(path.resolve(__dirname,'../.env.render'))),{Pool,options}=require('../config/postgresql');
 const saved=process.env.DATABASE_URL;process.env.DATABASE_URL=env.DATABASE_URL;const config=options();if(saved)process.env.DATABASE_URL=saved;else delete process.env.DATABASE_URL;
 const pool=new Pool(config);try{
  const {rows:[u]}=await pool.query("SELECT u.id,u.username,u.full_name,u.password_hash,u.active,r.name role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.username='juan'");assert.ok(u?.active&&u.role==='cashier');
  const user={id:u.id,username:u.username,fullName:u.full_name,role:u.role},token=require('jsonwebtoken').sign({...user,credentialVersion:require('crypto').createHash('sha256').update(u.password_hash).digest('hex')},env.JWT_SECRET,{expiresIn:'15m'});
  const response=await fetch('https://snack-time-pos.onrender.com/api/auth/me',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(90000)});assert.equal(response.status,200);assert.equal((await response.json()).user.role,'cashier');return {user,token};
 }finally{await pool.end();}
};
