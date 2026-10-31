const test=require('node:test');const assert=require('node:assert/strict');
test('migrated PostgreSQL read-only API smoke check',async()=>{
  const pool=require('../config/db');let server;
  try {
    const {rows:[user]}=await pool.query("SELECT u.*, r.name role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.active=1 AND r.name='admin' LIMIT 1");
    assert.ok(user,'An active admin is needed for read-only endpoint verification');
    // A short-lived internal test token avoids resetting or exposing the existing password.
    const token=require('jsonwebtoken').sign({id:user.id,credentialVersion:require('crypto').createHash('sha256').update(user.password_hash).digest('hex')},process.env.JWT_SECRET,{expiresIn:'1m'});
    const express=require('express');const app=express();app.use(express.json());
    for(const route of ['offline','auth','categories','products','inventory','orders','users','reports','discounts','settings'])app.use('/api/'+route,require('../routes/'+route));
    app.use(require('../middleware/errorHandler').errorHandler);
    server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
    const {rows:[before]}=await pool.query('SELECT COUNT(*) n FROM orders');
    for(const route of ['/auth/me','/categories','/products','/inventory','/inventory/transactions','/orders','/users','/discounts','/settings','/reports/dashboard','/reports/daily','/reports/weekly','/reports/monthly']) {
      const response=await fetch('http://127.0.0.1:'+server.address().port+'/api'+route,{headers:{Authorization:'Bearer '+token}});
      assert.equal(response.status,200,route+': '+JSON.stringify(await response.json()));
    }
    const {rows:[after]}=await pool.query('SELECT COUNT(*) n FROM orders');assert.equal(after.n,before.n);
    console.log('13 read-only endpoints passed against '+process.env.PG_DATABASE+'; '+after.n+' existing orders unchanged');
  } finally { if(server)await new Promise(resolve=>server.close(resolve));await pool.end(); }
});
