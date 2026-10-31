const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
require('dotenv').config({path:path.join(__dirname,'../.env.neon')});
const pool = require('../config/db');
async function prepare() {
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || !process.env.OFFLINE_AUTH_PRIVATE_KEY) throw Error('Cloud startup requires DATABASE_URL, a random JWT_SECRET (32+ characters), and the existing OFFLINE_AUTH_PRIVATE_KEY.');
  if (process.env.PRODUCT_IMAGE_STORAGE !== 'postgres' || process.env.SERVE_WEB !== 'true') throw Error('Cloud deployment must use durable PostgreSQL photos and the bundled web interface.');
  const key = crypto.createPublicKey(process.env.OFFLINE_AUTH_PRIVATE_KEY).export({format:'jwk'});
  const pinned = JSON.parse(await fs.readFile(path.join(__dirname,'../../frontend/src/offline/server-public-key.json'),'utf8'));
  if (key.n !== pinned.n || key.e !== pinned.e) throw Error('Offline authorization key does not match the Android public key.');
  const {rows:[zone]}=await pool.query('SHOW timezone');
  if (zone.TimeZone !== 'Asia/Manila') throw Error('Cloud database must preserve the Asia/Manila business timezone.');
  // Do not expose accounts with the original public demo credentials on the internet.
  const {rows:users} = await pool.query('SELECT username,password_hash FROM users WHERE active=1');
  for (const user of users) for (const password of ['admin123','cashier123']) {
    if (await require('bcrypt').compare(password,user.password_hash)) throw Error('Cloud deployment blocked: change the default password for '+user.username+' in the cloud database. Local accounts are unchanged.');
  }
  await pool.query(await fs.readFile(path.join(__dirname,'../../database/cloud-storage.postgresql.sql'),'utf8'));
  const publicRoot = path.resolve(__dirname,'../../frontend/public');
  const {rows:products} = await pool.query("SELECT DISTINCT image FROM products WHERE image LIKE '/images/%'");
  for (const {image} of products) {
    const {rowCount} = await pool.query('SELECT 1 FROM product_images WHERE path=$1',[image]);
    if (rowCount) continue;
    const file = path.resolve(publicRoot,'.'+image);
    if (!file.startsWith(publicRoot+path.sep)) throw Error('Unsafe product image path.');
    const contents = await fs.readFile(file);
    const mime = require('../utils/productImages').imageType(contents,{bundledSvg:image.toLowerCase().endsWith('.svg')});
    await pool.query('INSERT INTO product_images(path,mime_type,contents) VALUES($1,$2,$3) ON CONFLICT(path) DO NOTHING',[image,mime,contents]);
  }
  await pool.end();
}
prepare().then(()=>{
  // db.js's pool was closed after validation; the web process gets a fresh pool.
  const child=require('node:child_process').spawn(process.execPath,[path.join(__dirname,'../server.js')],{stdio:'inherit',env:process.env,windowsHide:true});
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
  child.on('exit',code=>{process.exitCode=code??1;});
  child.on('error',()=>{console.error('Unable to start web server.');process.exitCode=1;});
}).catch(async e=>{console.error(e.message);await pool.end().catch(()=>{});process.exitCode=1;});
