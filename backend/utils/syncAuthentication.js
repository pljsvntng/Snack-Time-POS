const crypto=require('node:crypto'),jwt=require('jsonwebtoken'),fs=require('node:fs'),path=require('node:path');
const pool=require('../config/db'),ApiError=require('./ApiError');
function publicKey(){return crypto.createPublicKey(process.env.OFFLINE_AUTH_PRIVATE_KEY||fs.readFileSync(path.join(__dirname,'../keys/offline-auth-private.pem')));}
function verifyOfflineGrant(token,{allowExpired=false}={}){
 try{
  const claims=jwt.verify(token,publicKey(),{algorithms:['RS256'],issuer:'snacktime-pos',audience:'snacktime-offline',ignoreExpiration:allowExpired});
  if(!Number.isInteger(claims.user?.id)||claims.sub!==String(claims.user.id)||!['admin','cashier'].includes(claims.user.role)||!Array.isArray(claims.scopes)||!claims.scopes.includes('pos')||!claims.scopes.includes('own-orders')||!Number.isFinite(claims.iat)||!Number.isFinite(claims.exp)||claims.exp-claims.iat>7*86400+5||claims.iat>Date.now()/1000+300)throw Error();
  return claims;
 }catch{throw new ApiError(401,'Offline authorization expired or changed. Sign in online on this device.');}
}
async function authorizeSync(req,res,next){
 const token=(req.headers.authorization||'').startsWith('Bearer ')?req.headers.authorization.slice(7):null;
 try{
  if(!token)throw new ApiError(401,'Online authorization is required to synchronize.');
  const claims=verifyOfflineGrant(token);
  if(!claims.scopes.includes('sync-sales'))throw new ApiError(401,'Sign in online to authorize synchronization on this device.');
  const {rows:[user]}=await pool.query('SELECT u.id,u.username,u.full_name AS "fullName",u.active,u.password_hash,r.name role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1',[claims.user.id]);
  if(!user||!user.active||!['admin','cashier'].includes(user.role)||crypto.createHash('sha256').update(user.password_hash).digest('hex')!==claims.credentialVersion)throw new ApiError(401,'Your account changed. Sign in online before synchronizing.');
  const {password_hash,active,...identity}=user;req.user=identity;req.syncDevice=claims.device_id;req.syncClaims=claims;next();
 }catch(e){next(e);}
}
// Catalog creation also accepts a normal online session for first authorization.
function authorizeCatalog(req,res,next){const token=(req.headers.authorization||'').slice(7),decoded=jwt.decode(token,{complete:true});if(decoded?.header.alg==='HS256')return require('../middleware/auth').verifyToken(req,res,next);return authorizeSync(req,res,next);}
module.exports={verifyOfflineGrant,authorizeSync,authorizeCatalog};
