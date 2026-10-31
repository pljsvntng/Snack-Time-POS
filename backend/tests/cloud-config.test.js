const test=require('node:test'),assert=require('node:assert/strict');
test('Neon URLs enforce certificate verification and safely decode credentials',()=>{
 const saved=process.env.DATABASE_URL;
 try{
  process.env.DATABASE_URL='postgresql://cashier:p%40ss%2Fword@ep-unit-pooler.ap-southeast-1.aws.neon.tech/snacktime?sslmode=require';
  const config=require('../config/postgresql').options();
  assert.equal(config.password,'p@ss/word');assert.equal(config.database,'snacktime');
  assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.ssl.servername,config.host);assert.equal(config.enableChannelBinding,true);assert.equal(config.max,5);
  assert.equal(config.connectionString,undefined);
  process.env.DATABASE_URL='https://example.com/database';assert.throws(()=>require('../config/postgresql').options(),/Invalid PostgreSQL/);
 }finally{if(saved)process.env.DATABASE_URL=saved;else delete process.env.DATABASE_URL;}
});
test('backup verification handles lossless pg_restore CHECK re-parsing while detecting changed constraints',()=>{
 const {canonicalConstraint}=require('../scripts/migrate-neon');
 const original="CHECK (((type)::text = ANY ((ARRAY['cash'::character varying, 'other'::character varying])::text[])))";
 const restored="CHECK (((type)::text = ANY (ARRAY[('cash'::character varying)::text, ('other'::character varying)::text])))";
 assert.equal(canonicalConstraint(original),canonicalConstraint(restored));
 assert.notEqual(canonicalConstraint(original),canonicalConstraint(restored.replace("'cash'","'credit'")));
 assert.notEqual(canonicalConstraint('CHECK (total >= 0)'),canonicalConstraint('CHECK (total >= 1)'));
});
test('legacy SVG artwork can be imported but SVG uploads and active content are rejected',()=>{
 const {imageType}=require('../utils/productImages');
 const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
 assert.throws(()=>imageType(svg),/valid JPG/);
 assert.equal(imageType(svg,{bundledSvg:true}),'image/svg+xml');
 assert.throws(()=>imageType(Buffer.from('<svg onload="alert(1)"></svg>'),{bundledSvg:true}),/valid JPG/);
});
