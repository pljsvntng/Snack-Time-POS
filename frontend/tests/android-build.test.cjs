const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('Android distribution command rejects localhost, placeholder and insecure API endpoints',()=>{
 for(const api of ['http://pos.onrender.com/api','https://localhost/api','https://example.com/api','https://pos.test/api','https://pos.onrender.com/','https://user:password@pos.onrender.com/api']){
  const result=spawnSync(process.execPath,[path.join(__dirname,'../scripts/build-android.cjs')],{env:{...process.env,VITE_API_URL:api},encoding:'utf8',windowsHide:true,timeout:30000});
  assert.equal(result.status,1,result.stderr);assert.match(result.stderr,/actual deployed HTTPS API URL/);
 }
});
