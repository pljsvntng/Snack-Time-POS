const fs=require('node:fs'),path=require('node:path'),jwt=require('jsonwebtoken');
const PRIVATE_KEY=path.join(__dirname,'../keys/offline-auth-private.pem');
function offlineGrant(user,deviceId,credentialVersion){
 if(typeof deviceId!=='string'||!/^[-a-f0-9]{36}$/i.test(deviceId))throw new Error('Invalid offline device identifier.');
 const key=process.env.OFFLINE_AUTH_PRIVATE_KEY || fs.readFileSync(PRIVATE_KEY,'utf8');
 return jwt.sign({device_id:deviceId,user:{id:user.id,username:user.username,fullName:user.full_name,role:user.role},scopes:['pos','own-orders'],credentialVersion},key,{algorithm:'RS256',issuer:'snacktime-pos',audience:'snacktime-offline',subject:String(user.id),expiresIn:'7d'});
}
module.exports={offlineGrant};
