const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Pool,options}=require('../config/postgresql');
const {administrators,setupAdministrator,resetAdministrator}=require('../utils/administrator');
const bcrypt=require('bcrypt');
test('administrator owner setup/reset is explicit, hashed, race-safe and preserves other accounts',async()=>{
 if(process.env.DATABASE_URL)throw Error('Administrator regression requires local PostgreSQL, never a cloud production URL.');
 const database='snacktime_admin_test_'+crypto.randomBytes(6).toString('hex'),maintenance=new Pool(options('postgres'));let pool;
 try{
  await maintenance.query('CREATE DATABASE "'+database+'"');pool=new Pool(options(database));
  await pool.query(fs.readFileSync(path.join(__dirname,'../../database/schema.postgresql.sql'),'utf8'));
  await pool.query("INSERT INTO roles(id,name) VALUES(1,'admin'),(2,'cashier')");
  const fixturePassword=crypto.randomBytes(24).toString('base64url'),replacement=crypto.randomBytes(24).toString('base64url'),cashierHash=await bcrypt.hash(fixturePassword,4);
  const initial=await setupAdministrator(pool,{password:fixturePassword});assert.equal(initial.administrators[0].username,'admin');
  await pool.query('DELETE FROM users WHERE id=$1',[initial.administrators[0].id]); // disposable fixture only
  await pool.query("INSERT INTO users(role_id,full_name,username,password_hash,active) VALUES(2,'Existing cashier','admin',$1,1)",[cashierHash]);
  const [first,second]=await Promise.all([setupAdministrator(pool,{password:fixturePassword}),setupAdministrator(pool,{password:fixturePassword})]);
  assert.equal([first,second].filter(r=>r.created).length,1);const users=await administrators(pool);assert.equal(users.length,1);assert.equal(users[0].username,'admin2');assert.equal(users[0].active,1);
  const safe=await setupAdministrator(pool,{});assert.equal(safe.created,false);
  let {rows:[row]}=await pool.query("SELECT password_hash FROM users WHERE username='admin2'");const original=row.password_hash;assert.equal(await bcrypt.compare(fixturePassword,original),true);assert.equal(bcrypt.getRounds(original),12);
  await assert.rejects(resetAdministrator(pool,{username:'admin2',password:replacement}),/explicitly approved/);
  await assert.rejects(resetAdministrator(pool,{username:'admin2',password:'short',approved:true}),/15 characters/);
  await assert.rejects(resetAdministrator(pool,{username:'admin',password:replacement,approved:true}),/not found/);
  assert.ok((await pool.query("SELECT password_hash FROM users WHERE username='admin2'")).rows[0].password_hash===original);
  await resetAdministrator(pool,{username:'admin2',password:replacement,approved:true});
  row=(await pool.query("SELECT password_hash FROM users WHERE username='admin2'")).rows[0];assert.equal(await bcrypt.compare(replacement,row.password_hash),true);assert.ok(row.password_hash!==original);
  const existing=(await pool.query("SELECT password_hash,role_id,active FROM users WHERE username='admin'")).rows[0];assert.ok(existing.password_hash===cashierHash);assert.equal(existing.role_id,2);assert.equal(existing.active,1);
  assert.equal((await pool.query('SELECT COUNT(*)::int count FROM users')).rows[0].count,2);
 }finally{if(pool)await pool.end();await maintenance.query('DROP DATABASE IF EXISTS "'+database+'"');await maintenance.end();}
});
test('administrator passphrases reject bcrypt byte truncation and allow Unicode/spaces',()=>{
 const {administratorPassword}=require('../utils/passwordPolicy');
 assert.throws(()=>administratorPassword('🔐'.repeat(19)),/72 UTF-8/);
 assert.throws(()=>administratorPassword('x'.repeat(20)),/unique/);
 assert.equal(administratorPassword('A private café passphrase 2026'),'A private café passphrase 2026');
});
test('hidden password prompt fails closed when input is not a terminal',async()=>{
 await assert.rejects(require('../utils/hiddenPrompt').hiddenPrompt('Password: ',{input:{isTTY:false},output:{write(){throw Error('Unexpected output');}}}),/private interactive terminal/);
});
test('hidden terminal input never echoes a passphrase and restores raw mode',async()=>{
 const {PassThrough}=require('node:stream'),input=new PassThrough();input.isTTY=true;input.isRaw=false;input.setRawMode=value=>{input.isRaw=value;};let output='';
 const secret=crypto.randomBytes(16).toString('base64url'),pending=require('../utils/hiddenPrompt').hiddenPrompt('Secret: ',{input,output:{write:value=>{output+=value;}}});
 input.emit('keypress',secret,{name:'text'});input.emit('keypress','\r',{name:'return'});assert.ok(await pending===secret);assert.equal(output.includes(secret),false);assert.equal(input.isRaw,false);input.destroy();
});
test('unexpected authentication/storage errors never log secret-bearing messages',()=>{
 const marker=crypto.randomBytes(24).toString('base64url'),old=console.error;let output='';console.error=(...args)=>{output+=JSON.stringify(args);};
 try{const error=Error('password='+marker+' token='+marker);error.code='TEST_ERROR';const result=require('../middleware/errorHandler').errorHandler(error,{}, {status(){return this;},json(){return this;}},()=>{});assert.equal(output.includes(marker),false);assert.ok(output.includes('TEST_ERROR'));}finally{console.error=old;}
});
test('Windows owner vault protects credentials and rejects damaged ciphertext',{skip:process.platform!=='win32'},()=>{
 const vault=require('../utils/ownerCredentialVault'),os=require('node:os');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'snacktime-vault-')),file=path.join(dir,'vault.json'),password=crypto.randomBytes(24).toString('base64url'),data={accounts:[{username:'test-owner',password}]};
 try{vault.saveVault(data,file);assert.equal(fs.readFileSync(file,'utf8').includes(password),false);assert.deepEqual(vault.readVault(file),data);const saved=JSON.parse(fs.readFileSync(file));saved.ciphertext=saved.ciphertext.slice(0,-8)+'AAAAAAAA';fs.writeFileSync(file,JSON.stringify(saved));assert.throws(()=>vault.readVault(file),/protection failed/);}finally{fs.unlinkSync(file);fs.rmdirSync(dir);}
});
