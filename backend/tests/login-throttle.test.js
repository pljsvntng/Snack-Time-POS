const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createLoginThrottle}=require('../middleware/loginThrottle');
function attempt(middleware,username,address='127.0.0.1',status=401){
 const res=new EventEmitter();res.statusCode=status;res.headers={};res.set=(name,value)=>{res.headers[name]=value;return res;};res.status=value=>{res.statusCode=value;return res;};res.json=body=>{res.body=body;return res;};
 let passed=false;middleware({body:{username},socket:{remoteAddress:address},headers:{'x-forwarded-for':Math.random().toString()}},res,()=>{passed=true;res.emit('finish');});return {passed,res};
}
test('online sign-in attempts throttle concurrent requests, canonical usernames, and expire without changing passwords',()=>{
 let time=0;const throttle=createLoginThrottle({now:()=>time,accountLimit:2});
 assert.ok(attempt(throttle,' Admin ').passed);assert.ok(attempt(throttle,'admin').passed);
 const blocked=attempt(throttle,'ADMIN');assert.equal(blocked.passed,false);assert.equal(blocked.res.statusCode,429);assert.equal(blocked.res.headers['Retry-After'],'60');
 time=60001;assert.ok(attempt(throttle,'admin').passed);
});
test('successful login clears its account bucket; address limits cannot be evaded with forwarded headers',()=>{
 const throttle=createLoginThrottle({accountLimit:1,addressLimit:3});assert.ok(attempt(throttle,'admin','same',200).passed);assert.ok(attempt(throttle,'admin','same',200).passed);assert.ok(attempt(throttle,'other','same').passed);assert.equal(attempt(throttle,'third','same').res.statusCode,429);
});
test('login throttle bounds memory and fails closed until old entries expire',()=>{
 let time=0;const throttle=createLoginThrottle({now:()=>time,maxEntries:2});assert.ok(attempt(throttle,'first').passed);assert.equal(attempt(throttle,'second').res.statusCode,503);time=60001;assert.ok(attempt(throttle,'second').passed);
});
