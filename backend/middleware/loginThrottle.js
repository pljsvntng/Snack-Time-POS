const {createHash}=require('node:crypto');

// Bounded single-process protection for this single-instance Render service.
// Do not trust caller-supplied forwarding headers or retain login identifiers.
function createLoginThrottle({now=Date.now,windowMs=60000,accountLimit=10,addressLimit=120,maxEntries=4096}={}){
 const buckets=new Map();let pruneAt=0;
 const key=(kind,value)=>kind+createHash('sha256').update(value).digest('hex');
 return (req,res,next)=>{
  if(typeof req.body?.username!=='string')return next();
  const time=now();
  if(time>=pruneAt){for(const [id,bucket] of buckets)if(bucket.until<=time)buckets.delete(id);pruneAt=time+windowMs;}
  const account=key('account:',req.body.username.trim().toLowerCase()),address=key('address:',req.socket?.remoteAddress||'unknown');
  const entries=[[account,accountLimit],[address,addressLimit]];
  for(const [id,limit] of entries){
   const bucket=buckets.get(id);
   if(bucket&&bucket.until>time&&bucket.count>=limit)return res.set('Retry-After',String(Math.max(1,Math.ceil((bucket.until-time)/1000)))).status(429).json({error:'Too many sign-in attempts. Wait a minute and try again. Offline access remains available on an already authorized device.'});
  }
  if(entries.some(([id])=>!buckets.has(id))&&buckets.size+2>maxEntries)return res.set('Retry-After','60').status(503).json({error:'Sign-in is temporarily busy. Please try again shortly.'});
  for(const [id] of entries){let bucket=buckets.get(id);if(!bucket||bucket.until<=time){bucket={count:0,until:time+windowMs};buckets.set(id,bucket);}bucket.count++;}
  // Successful online authorization does not accumulate a per-account lockout.
  res.once('finish',()=>{if(res.statusCode===200)buckets.delete(account);});
  next();
 };
}
module.exports={createLoginThrottle};
