const pool = require('../config/db');
const { number, text, flag } = require('../utils/validation');
const path = require('path');
const fs = require('fs');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// Computes a friendly stock status for a product row that already has
// `max_sellable_by_ingredients` (from the ingredient-based query below).
function computeStatus(product) {
  if (!product.available) return 'unavailable';

  if (product.track_stock) {
    if (product.stock <= 0) return 'out_of_stock';
    if (product.stock <= product.low_stock_threshold) return 'low_stock';
  }

  if (product.max_sellable_by_ingredients !== null) {
    const maxSellable = Math.floor(Number(product.max_sellable_by_ingredients));
    if (maxSellable <= 0) return 'out_of_stock';
    if (maxSellable <= 10) return 'low_stock';
  }

  return 'available';
}

async function attachOptionGroups(products) {
  if (!products.length) return products;
  const productIds = products.map((p) => p.id);

  const { rows: groups } = await pool.query(
    `SELECT * FROM option_groups WHERE product_id = ANY($1::integer[]) ORDER BY display_order ASC, id ASC`,
    [productIds]
  );
  const groupIds = groups.map((g) => g.id);

  let options = [];
  if (groupIds.length) {
    const { rows: optRows } = await pool.query(
      `SELECT * FROM options WHERE option_group_id = ANY($1::integer[]) ORDER BY display_order ASC, id ASC`,
      [groupIds]
    );
    options = optRows;
  }

  // Ingredient requirements (with current stock) so the POS can work out how many orders the
  // available stock can fulfil. Read-only: nothing here changes any data.
  const toIngredient = (r) => ({
    ingredient_id: r.ingredient_id, name: r.name, unit: r.unit,
    quantity_required: Number(r.quantity_required), current_stock: Number(r.current_stock),
  });
  const { rows: recipeRows } = await pool.query(
    `SELECT pi.product_id, pi.ingredient_id, pi.quantity_required, i.name, i.unit, i.current_stock
     FROM product_ingredients pi JOIN ingredients i ON i.id = pi.ingredient_id
     WHERE pi.product_id = ANY($1::integer[])`,
    [productIds]
  );
  const recipeByProduct = {};
  for (const r of recipeRows) {
    if (!recipeByProduct[r.product_id]) recipeByProduct[r.product_id] = [];
    recipeByProduct[r.product_id].push(toIngredient(r));
  }

  const ingredientsByOption = {};
  if (options.length) {
    const { rows: optIngRows } = await pool.query(
      `SELECT oi.option_id, oi.ingredient_id, oi.quantity_required, i.name, i.unit, i.current_stock
       FROM option_ingredients oi JOIN ingredients i ON i.id = oi.ingredient_id
       WHERE oi.option_id = ANY($1::integer[])`,
      [options.map((o) => o.id)]
    );
    for (const r of optIngRows) {
      if (!ingredientsByOption[r.option_id]) ingredientsByOption[r.option_id] = [];
      ingredientsByOption[r.option_id].push(toIngredient(r));
    }
  }
  for (const o of options) o.ingredients = ingredientsByOption[o.id] || [];

  const groupsByProduct = {};
  for (const g of groups) {
    g.options = options.filter((o) => o.option_group_id === g.id);
    if (!groupsByProduct[g.product_id]) groupsByProduct[g.product_id] = [];
    groupsByProduct[g.product_id].push(g);
  }

  for (const p of products) {
    p.option_groups = groupsByProduct[p.id] || [];
    p.recipe = recipeByProduct[p.id] || [];
  }
  return products;
}

// GET /api/products?category=slug&search=term&includeUnavailable=true
const getProducts = asyncHandler(async (req, res) => {
  const { category, search, includeUnavailable } = req.query;

  const conditions = ['p.deleted_at IS NULL'];
  const params = [];

  if (category) {
    conditions.push(`c.slug = $${params.length + 1}`);
    params.push(category);
  }
  if (search) {
    conditions.push(`(unaccent(p.name COLLATE "C") ILIKE unaccent($${params.length + 1}::text) OR unaccent(c.name COLLATE "C") ILIKE unaccent($${params.length + 2}::text) OR EXISTS (
      SELECT 1 FROM option_groups og JOIN options o ON o.option_group_id = og.id
      WHERE og.product_id = p.id AND unaccent(o.name COLLATE "C") ILIKE unaccent($${params.length + 3}::text)
    ))`);
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (includeUnavailable !== 'true') {
    conditions.push('p.available = 1');
  }

  const { rows: rows } = await pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
        (SELECT MIN(i.current_stock / NULLIF(pi.quantity_required, 0)) FROM product_ingredients pi JOIN ingredients i ON i.id = pi.ingredient_id WHERE pi.product_id = p.id) AS max_sellable_by_ingredients
     FROM products p
     JOIN categories c ON p.category_id = c.id
     WHERE ${conditions.join(' AND ')}

     ORDER BY c.display_order ASC, p.name ASC`,
    params
  );

  const withOptions = await attachOptionGroups(rows);
  const result = withOptions.map((p) => ({ ...p, status: computeStatus(p) }));
  res.json(result);
});

// GET /api/products/:id
const getProduct = asyncHandler(async (req, res) => {
  const { rows: rows } = await pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
        (SELECT MIN(i.current_stock / NULLIF(pi.quantity_required, 0)) FROM product_ingredients pi JOIN ingredients i ON i.id = pi.ingredient_id WHERE pi.product_id = p.id) AS max_sellable_by_ingredients
     FROM products p
     JOIN categories c ON p.category_id = c.id
     WHERE p.id = $1 AND p.deleted_at IS NULL
`,
    [req.params.id]
  );
  if (!rows.length) throw new ApiError(404, 'Product not found.');

  const [withOptions] = [await attachOptionGroups(rows)];
  const product = { ...withOptions[0], status: computeStatus(withOptions[0]) };
  res.json(product);
});

// POST /api/products (admin)
const createProduct = asyncHandler(async (req, res) => {
  const { category_id, name, description, price, sku, track_stock, stock, low_stock_threshold } = req.body;

  if (!category_id || !name || price === undefined) {
    throw new ApiError(400, 'Category, name, and price are required.');
  }
  text(name, 'Product name');
  number(category_id, 'Category', { min: 1, integer: true });
  number(price, 'Price');
  if (track_stock !== undefined) flag(track_stock, 'Track stock');
  if (stock != null) number(stock, 'Stock', { integer: true });
  if (low_stock_threshold !== undefined) number(low_stock_threshold, 'Low stock threshold', { integer: true });

  const result = await pool.query(
    `INSERT INTO products (category_id, name, description, price, sku, track_stock, stock, low_stock_threshold)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [category_id, name.trim(), description || '', price, sku || null, track_stock ? 1 : 0,
      track_stock ? (stock || 0) : null, low_stock_threshold ?? 10]
  );

  res.status(201).json({ id: result.rows[0].id, message: 'Product created.' });
});

// PUT /api/products/:id (admin) -- edit product / change price / set availability
const updateProduct = asyncHandler(async (req, res) => {
  const { category_id, name, description, price, available, track_stock, stock, low_stock_threshold, sku } = req.body;

  const { rows: existing } = await pool.query(`SELECT id FROM products WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
  if (!existing.length) throw new ApiError(404, 'Product not found.');

  if (name !== undefined) text(name, 'Product name');
  if (category_id !== undefined) number(category_id, 'Category', { min: 1, integer: true });
  if (price !== undefined) number(price, 'Price');
  if (stock != null) number(stock, 'Stock', { integer: true });
  if (low_stock_threshold !== undefined) number(low_stock_threshold, 'Low stock threshold', { integer: true });
  if (available !== undefined) flag(available, 'Available');
  if (track_stock !== undefined) flag(track_stock, 'Track stock');

  await pool.query(
    `UPDATE products SET
       category_id = COALESCE($1, category_id),
       name = COALESCE($2, name),
       description = COALESCE($3, description),
       price = COALESCE($4, price),
       available = COALESCE($5, available),
       track_stock = COALESCE($6, track_stock),
       stock = CASE WHEN $7 = 0 THEN NULL WHEN $8 = 1 THEN COALESCE($9, stock, 0) ELSE COALESCE($10, stock) END,
       low_stock_threshold = COALESCE($11, low_stock_threshold),
       sku = CASE WHEN $12::text IS NULL THEN sku ELSE NULLIF($13, '') END
     WHERE id = $14`,
    [category_id, name?.trim(), description, price, available === undefined ? null : flag(available, 'Available'),
      track_stock === undefined ? null : flag(track_stock, 'Track stock'),
      track_stock === undefined ? null : flag(track_stock, 'Track stock'),
      track_stock === undefined ? null : flag(track_stock, 'Track stock'), stock, stock, low_stock_threshold, sku, sku, req.params.id]
  );

  res.json({ message: 'Product updated.' });
});

// DELETE /api/products/:id (admin) -- soft delete/deactivate, never hard-delete
// (keeps historical sales records intact)
const deactivateProduct = asyncHandler(async (req, res) => {
  const { rows: existing } = await pool.query(`SELECT id FROM products WHERE id = $1`, [req.params.id]);
  if (!existing.length) throw new ApiError(404, 'Product not found.');

  await pool.query(
    `UPDATE products SET available = 0, deleted_at = NOW() WHERE id = $1`,
    [req.params.id]
  );
  res.json({ message: 'Product deactivated.' });
});

// PATCH /api/products/:id/restore (admin)
const restoreProduct = asyncHandler(async (req, res) => {
  const result = await pool.query(`UPDATE products SET available = 1, deleted_at = NULL WHERE id = $1`, [req.params.id]);
  if (!result.rowCount) throw new ApiError(404, 'Product not found.');
  res.json({ message: 'Product restored.' });
});

// POST /api/products/:id/image (admin) -- expects multer to have placed the file in a temp folder;
// the product's real category is looked up from the database (never trusted from the client),
// then the file is moved into its final public folder.
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No image file was uploaded.');

  const { rows: rows } = await pool.query(
    `SELECT c.slug AS category_slug FROM products p JOIN categories c ON p.category_id = c.id WHERE p.id = $1`,
    [req.params.id]
  );
  if (!rows.length) { fs.unlink(req.file.path, () => {}); throw new ApiError(404, 'Product not found.'); }

  const category = rows[0].category_slug.replace(/[^a-z0-9-]/gi, '');
  if (process.env.PRODUCT_IMAGE_STORAGE === 'postgres') {
    const image = `/images/products/${category}/${req.file.filename}`;
    await require('../utils/productImages').saveImage(req.params.id, image, req.file);
    return res.json({message: 'Image uploaded.', image});
  }
  const destDir = path.join(__dirname, '..', '..', 'frontend', 'public', 'images', 'products', category);
  fs.mkdirSync(destDir, { recursive: true });

  const destPath = path.join(destDir, req.file.filename);
  try { fs.renameSync(req.file.path, destPath); }
  catch (err) {
    if (err.code !== 'EXDEV') throw err;
    fs.copyFileSync(req.file.path, destPath); fs.unlinkSync(req.file.path);
  }

  const relativePath = `/images/products/${category}/${req.file.filename}`;
  try { await pool.query('UPDATE products SET image = $1 WHERE id = $2', [relativePath, req.params.id]); }
  catch (err) { fs.unlink(destPath, () => {}); throw err; }
  res.json({ message: 'Image uploaded.', image: relativePath });
});

// DELETE /api/products/:id/image (admin)
const removeImage = asyncHandler(async (req, res) => {
  if (process.env.PRODUCT_IMAGE_STORAGE === 'postgres') {
    await require('../utils/productImages').removeImage(req.params.id);
    return res.json({message: 'Image removed.'});
  }
  const { rows: rows } = await pool.query(`SELECT image FROM products WHERE id = $1`, [req.params.id]);
  if (!rows.length) throw new ApiError(404, 'Product not found.');

  const image = rows[0].image;
  if (image) {
    const filePath = path.join(__dirname, '..', '..', 'frontend', 'public', image);
    fs.unlink(filePath, () => {}); // best-effort; ignore if already missing
  }
  await pool.query(`UPDATE products SET image = NULL WHERE id = $1`, [req.params.id]);
  res.json({ message: 'Image removed.' });
});

module.exports = {
  getProducts, getProduct, createProduct, updateProduct,
  deactivateProduct, restoreProduct, uploadImage, removeImage,
};
