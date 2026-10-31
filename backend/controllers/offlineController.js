const pool=require('../config/db');
const asyncHandler=require('../utils/asyncHandler');
// One consistent snapshot; never exports login hashes or other users' records.
async function readSnapshot(c,userId){

  const {rows:categories}=await c.query('SELECT * FROM categories ORDER BY display_order,id');
  const {rows:products}=await c.query('SELECT p.*,c.name category_name,c.slug category_slug FROM products p JOIN categories c ON c.id=p.category_id WHERE p.deleted_at IS NULL ORDER BY p.id');
  const {rows:groups}=await c.query('SELECT * FROM option_groups ORDER BY display_order,id');
  const {rows:options}=await c.query('SELECT * FROM options ORDER BY display_order,id');
  const {rows:ingredients}=await c.query('SELECT id,name,unit,current_stock,min_stock FROM ingredients ORDER BY id');
  const {rows:recipes}=await c.query('SELECT * FROM product_ingredients ORDER BY id');
  const {rows:optionRecipes}=await c.query('SELECT * FROM option_ingredients ORDER BY id');
  const {rows:discounts}=await c.query('SELECT * FROM discounts WHERE active=1 ORDER BY id');
  const {rows:settingRows}=await c.query('SELECT * FROM settings');
  const {rows:orders}=await c.query("SELECT o.*,COALESCE(s.payload->'receipt'->>'cashier_name',u.full_name) cashier_name,s.client_id offline_client_id,s.payload->'receipt'->'receipt_settings' receipt_settings,s.payload->'receipt'->>'discount_name' discount_name FROM orders o JOIN users u ON u.id=o.user_id LEFT JOIN offline_sales s ON s.order_id=o.id WHERE o.user_id=$1 ORDER BY o.created_at DESC LIMIT 100",[userId]);
  const ids=orders.map(o=>o.id);
  const {rows:items}=await c.query('SELECT * FROM order_items WHERE order_id=ANY($1::integer[]) ORDER BY id',[ids]);
  const {rows:itemOptions}=await c.query('SELECT * FROM order_item_options WHERE order_item_id=ANY($1::integer[]) ORDER BY id',[items.map(i=>i.id)]);
  const byIngredient=new Map(ingredients.map(i=>[i.id,i]));
  const ingredient=r=>({...byIngredient.get(r.ingredient_id),ingredient_id:r.ingredient_id,quantity_required:r.quantity_required});
  for(const o of options)o.ingredients=optionRecipes.filter(r=>r.option_id===o.id).map(ingredient);
  for(const g of groups)g.options=options.filter(o=>o.option_group_id===g.id);
  for(const p of products){p.recipe=recipes.filter(r=>r.product_id===p.id).map(ingredient);p.option_groups=groups.filter(g=>g.product_id===p.id);}
  for(const o of orders)o.items=items.filter(i=>i.order_id===o.id).map(i=>({...i,options:itemOptions.filter(v=>v.order_item_id===i.id)}));
  return {schema_version:1,prepared_at:new Date().toISOString(),user_id:userId,categories,products,ingredients,discounts,settings:Object.fromEntries(settingRows.map(s=>[s.setting_key,s.setting_value])),orders};
}
const bootstrap=asyncHandler(async(req,res)=>{
 const c=await pool.connect();try{await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const data=await readSnapshot(c,req.user.id);await c.query('COMMIT');res.set('Cache-Control','no-store').json(data);}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
});
module.exports={bootstrap,readSnapshot};
