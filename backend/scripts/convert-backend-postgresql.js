const fs=require('fs'),path=require('path');
if(fs.readFileSync('backend/config/db.js','utf8').includes("require('./postgresql')")) throw Error('Backend is already converted; this one-time helper must not be rerun');
const saved='database/backups/pre-postgresql-backend';
if(!fs.existsSync(saved)){fs.mkdirSync(saved,{recursive:true});for(const n of ['config','controllers','middleware','utils','tests'])fs.cpSync('backend/'+n,saved+'/'+n,{recursive:true});}
const files=[...fs.readdirSync('backend/controllers').map(n=>'backend/controllers/'+n),'backend/middleware/auth.js','backend/utils/orderNumber.js'];
for(const p of files){
 let s=fs.readFileSync(p,'utf8');
 s=s.replace(/const \[\[(\w+)\]\] = await/g,'const { rows: [$1] } = await');
 s=s.replace(/const \[(\w+)\] = (await|groups.length|itemIds.length)/g,(_,n,r)=>`const ${['result','orderResult','itemResult','upd'].includes(n)?n:'{ rows: '+n+' }'} = ${r}`);
 s=s.replaceAll(': [[]]',': { rows: [] }');
 s=s.replaceAll('.insertId','.rows[0].id').replaceAll('.affectedRows','.rowCount');
 s=s.replaceAll('pool.getConnection()','pool.connect()').replaceAll('connection.beginTransaction()',"connection.query('BEGIN')").replaceAll('connection.commit()',"connection.query('COMMIT')").replaceAll('connection.rollback()',"connection.query('ROLLBACK')");
 s=s.replace(/(`[^`]*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/g,(str)=>{
  if(!/\b(SELECT|INSERT|UPDATE|DELETE)\b/.test(str))return str;
  let i=0;str=str.replace(/\?/g,()=>'$'+(++i));
  str=str.replace(/IN \((\$\d+)\)/g,'= ANY($1::integer[])');
  // RETURNING only needed by inserts whose identifiers are used; harmless on other ID tables.
  if(/^.[\s]*INSERT INTO (?!settings\b)/.test(str))str=str.slice(0,-1)+' RETURNING id'+str.at(-1);
  return str;
 });
 // Native PG folds unquoted aliases to lowercase.
 s=s.replace('AS fullName','AS "fullName"');
 fs.writeFileSync(p,s);
}
const edit=(p,a,b)=>{let s=fs.readFileSync(p,'utf8');if(!s.includes(a))throw Error(p+': '+a);fs.writeFileSync(p,s.split(a).join(b));};
let p='backend/controllers/productController.js';
edit(p,"conditions.push('c.slug = ?');","conditions.push(`c.slug = $${params.length + 1}`);");
edit(p,'(p.name LIKE $1 OR c.name LIKE $2 OR EXISTS (','(unaccent(p.name COLLATE "C") ILIKE unaccent($${params.length + 1}::text) OR unaccent(c.name COLLATE "C") ILIKE unaccent($${params.length + 2}::text) OR EXISTS (');
edit(p,'AND o.name LIKE $3','AND unaccent(o.name COLLATE "C") ILIKE unaccent($${params.length + 3}::text)');
edit(p,'CASE WHEN $12 IS NULL','CASE WHEN $12::text IS NULL');
edit(p,'[category_id, name?.trim(), description, price, available, track_stock, track_stock, track_stock, stock, stock, low_stock_threshold, sku, sku, req.params.id]',`[category_id, name?.trim(), description, price, available === undefined ? null : flag(available, 'Available'),
      track_stock === undefined ? null : flag(track_stock, 'Track stock'),
      track_stock === undefined ? null : flag(track_stock, 'Track stock'),
      track_stock === undefined ? null : flag(track_stock, 'Track stock'), stock, stock, low_stock_threshold, sku, sku, req.params.id]`);
p='backend/controllers/orderController.js';
let s=fs.readFileSync(p,'utf8');s=s.replace('  let numberLock = false;','');
const start=s.indexOf('    // Lock before row locks');const end=s.indexOf('    // ---- Resolve',start);
s=s.slice(0,start)+`    await connection.query('BEGIN');
    await connection.query("SET LOCAL lock_timeout = '10s'");
    // Transaction advisory lock releases automatically on commit, rollback, or disconnect.
    await connection.query('SELECT pg_advisory_xact_lock(731042, 1)');

`+s.slice(end);
s=s.replace('    try { if (numberLock) await connection.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(), \':checkout\'))"); }\n    finally { connection.release(); }','    connection.release();');
s=s.replaceAll("conditions.push('o.user_id = ?');","conditions.push(`o.user_id = $${params.length + 1}`);");
s=s.replaceAll("conditions.push('o.created_at >= ?');","conditions.push(`o.created_at >= $${params.length + 1}`);").replaceAll("conditions.push('o.created_at <= ?');","conditions.push(`o.created_at <= $${params.length + 1}`);").replaceAll("conditions.push('o.status = ?');","conditions.push(`o.status = $${params.length + 1}`);");
s=s.replace("conditions.push('(o.order_number LIKE $1 OR EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.product_name LIKE $2))');",'conditions.push(`(o.order_number COLLATE "C" ILIKE $${params.length + 1} OR EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND unaccent(oi.product_name COLLATE "C") ILIKE unaccent($${params.length + 2}::text)))`);');
s=s.replace('LIMIT $1`','LIMIT $${params.length + 1}`').replace("const conditions = ['o.id = ?'];","const conditions = ['o.id = $1'];");fs.writeFileSync(p,s);
p='backend/controllers/inventoryController.js';s=fs.readFileSync(p,'utf8');for(const condition of ['t.ingredient_id =','t.created_at >=','t.created_at <='])s=s.replace(`conditions.push('${condition} ?');`,'conditions.push(`'+condition+' $${params.length + 1}`);');fs.writeFileSync(p,s);
p='backend/controllers/reportController.js';s=fs.readFileSync(p,'utf8').replaceAll('DATE_SUB(CURDATE(), INTERVAL 6 DAY)',"(CURRENT_DATE - INTERVAL '6 days')").replaceAll('DATE_SUB(CURDATE(), INTERVAL 30 DAY)',"(CURRENT_DATE - INTERVAL '30 days')").replaceAll('CURDATE()','CURRENT_DATE');fs.writeFileSync(p,s);
p='backend/utils/orderNumber.js';edit(p,'MAX(CAST(SUBSTRING(order_number, 13) AS UNSIGNED))',"MAX(CAST(SUBSTRING(order_number FROM 13) AS integer))");edit(p,'order_number LIKE $1','order_number COLLATE "C" LIKE $1');
p='backend/controllers/settingsController.js';edit(p,'ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)','ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value');
p='backend/controllers/userController.js';edit(p,'[full_name, email, roleId, active, passwordHash, req.params.id]',"[full_name, email, roleId, active === undefined ? null : flag(active, 'Active'), passwordHash, req.params.id]");
p='backend/controllers/categoryController.js';edit(p,'[name, icon, display_order, active, req.params.id]',"[name, icon, display_order, active === undefined ? null : Number(active), req.params.id]");
