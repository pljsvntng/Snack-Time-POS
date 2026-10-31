const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
function load(file, defines = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'));
  const code = esbuild.transformSync(fs.readFileSync(filename, 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic', define: defines }).code;
  const mod = { exports: {} };
  const localRequire = (name) => name.startsWith('.') ? load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(filename), name + (path.extname(name) ? '' : '.js')))) : require(name);
  new Function('require', 'module', 'exports', code)(localRequire, mod, mod.exports);
  return mod.exports;
}
test('shared ingredient stock is aggregated across cart lines and option recipes', () => {
  const stock = load('utils/stock.js');
  const ingredient = { ingredient_id: 1, name: 'Milk', unit: 'ml', quantity_required: 2, current_stock: 10 };
  const product = { id: 1, recipe: [ingredient], option_groups: [], track_stock: false };
  const other = { ...product, id: 2 };
  const catalog = stock.buildCatalog([product, other]);
  const items = [{product, selectedOptions: [], quantity: 3}];
  assert.equal(stock.availability(other, [], items, catalog).max, 2);
  assert.equal(stock.availability(other, [{ingredients:[ingredient]}], items, catalog).max, 1);
  assert.equal(stock.findStockIssues([{product, selectedOptions: [], quantity: 6}], catalog).length, 1);
});
test('stock helper handles fractional exact stock and direct product limits', () => {
  const stock=load('utils/stock.js');const p={id:1,track_stock:true,stock:3,recipe:[{ingredient_id:1,quantity_required:0.1,current_stock:0.3,name:'Mix',unit:'g'}]};
  const catalog=stock.buildCatalog([p]);assert.equal(stock.availability(p,[],[],catalog).max,3);
});
test('receipt renders saved historical options and immediate checkout options', () => {
  const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');const Receipt=load('components/ReceiptView.jsx').default;
  for(const option of [{option_name:'Pearl',price_modifier:10},{name:'Pearl',price_modifier:10}]) {
    const html=renderToStaticMarkup(React.createElement(Receipt,{order:{order_number:'FH-test',created_at:'2026-10-31T00:00:00Z',items:[{product_name:'Milk tea',quantity:1,subtotal:39,options:[option]}],subtotal:39,total:39,discount_amount:0,payment_method:'cash',cash_received:50,change_amount:11},settings:{}}));
    assert.ok(html.includes('Pearl'));assert.ok(html.includes('Milk tea'));assert.ok(html.includes('11.00'));
  }
});
test('business dates follow Manila around UTC midnight',()=>{
  const {businessDate}=load('utils/currency.js');assert.equal(businessDate(new Date('2026-10-30T17:00:00Z')),'2026-10-31');
});
test('API uses backend images, preserves errors, clears expired sessions and reports network failure',async()=>{
  const data=new Map([['fh_token','token'],['fh_user','{}']]);global.localStorage={getItem:k=>data.get(k),removeItem:k=>data.delete(k)};
  let event;global.window={location:{protocol:'http:',hostname:'localhost'},dispatchEvent:e=>event=e.type};
  const {api,imageUrl}=load('services/api.js',{'import.meta.env.VITE_API_URL':'"https://pos.example/api"'});
  assert.equal(imageUrl('/images/item.png'),'https://pos.example/images/item.png');
  assert.equal(imageUrl('https://external.example/item.png'),'https://external.example/item.png');
  global.fetch=async()=>({ok:false,status:401,json:async()=>({error:'Expired'})});
  await assert.rejects(api.get('/products'),e=>e.status===401 && e.message==='Expired');assert.equal(data.has('fh_token'),false);assert.equal(event,'pos:unauthorized');
  global.fetch=async()=>{throw new Error('fetch failed')};await assert.rejects(api.get('/products'),/Cannot reach the POS server/);
});

test('Render web build resolves /api and product photos on its deployed origin',async()=>{
 global.window={location:{origin:'https://snack-time-pos.onrender.com',protocol:'https:',hostname:'snack-time-pos.onrender.com'},dispatchEvent:()=>{}};
 global.localStorage={getItem:()=>null};let requested;
 global.fetch=async url=>{requested=url;return {ok:true,json:async()=>[]};};
 const {api,imageUrl}=load('services/api.js',{'import.meta.env.VITE_API_URL':'"/api"'});
 await api.get('/products');assert.equal(requested,'https://snack-time-pos.onrender.com/api/products');
 assert.equal(imageUrl('/images/item.png'),'https://snack-time-pos.onrender.com/images/item.png');
});

test('cart discounts round half up in integer cents',()=>{ const {cartAmounts}=load('utils/money.js');assert.deepEqual(cartAmounts([{unitPrice:0.35,quantity:1}],{type:'percent',value:'10.00'}),{subtotal:0.35,discountAmount:0.04,total:0.31}); });
