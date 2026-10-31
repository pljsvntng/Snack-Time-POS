const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const privatePath=path.join(__dirname,'../keys/offline-auth-private.pem');
if(!fs.existsSync(privatePath)){
 const pair=crypto.generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 fs.writeFileSync(privatePath,pair.privateKey,{mode:0o600});
}
const key=crypto.createPublicKey(fs.readFileSync(privatePath));
fs.writeFileSync(path.join(__dirname,'../../frontend/src/offline/server-public-key.json'),JSON.stringify(key.export({format:'jwk'}),null,2)+'\n');
console.log('Offline signing key retained privately; public verification key exported for Android builds.');
