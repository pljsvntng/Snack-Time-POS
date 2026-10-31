const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=path.resolve(__dirname,'..'),file=path.join(dir,'.env.render');
try{
 const config=require('dotenv').parse(fs.readFileSync(path.join(dir,'.env.neon')));
 const url=new URL(config.DATABASE_URL);
 if(!url.hostname.endsWith('.neon.tech'))throw Error('Set the Neon pooled DATABASE_URL in backend/.env.neon first.');
 const key=fs.readFileSync(path.join(dir,'keys/offline-auth-private.pem'),'utf8');
 const publicKey=crypto.createPublicKey(key).export({format:'jwk'}),pinned=JSON.parse(fs.readFileSync(path.join(dir,'../frontend/src/offline/server-public-key.json')));
 if(publicKey.n!==pinned.n||publicKey.e!==pinned.e)throw Error('Offline signing key mismatch.');
 const values={DATABASE_URL:config.DATABASE_URL,JWT_SECRET:crypto.randomBytes(48).toString('base64'),OFFLINE_AUTH_PRIVATE_KEY:key,NODE_ENV:'production',SERVE_WEB:'true',PRODUCT_IMAGE_STORAGE:'postgres',CLIENT_ORIGIN:'https://localhost'};
 fs.writeFileSync(file,Object.entries(values).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{flag:'wx',mode:0o600});
 console.log('Private Render environment prepared at backend/.env.render. Import it into Render; do not commit or share its contents.');
}catch(e){console.error(e.code==='EEXIST'?'backend/.env.render already exists; existing signing/session secrets were preserved.':e.message);process.exitCode=1;}
