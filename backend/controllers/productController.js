const pool = require('../config/db');
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

  const [groups] = await pool.query(
    `SELECT * FROM option_groups WHERE product_id IN (?) ORDER BY display_order ASC, id ASC`,
    [productIds]
  );
  const groupIds = groups.map((g) => g.id);

  let options = [];
  if (groupIds.length) {
    const [optRows] = await pool.query(
      `SELECT * FROM options WHERE option_group_id IN (?) ORDER BY display_order ASC, id ASC`,
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
  const [recipeRows] = await pool.query(
    `SELECT pi.product_id, pi.ingredient_id, pi.quantity_required, i.name, i.unit, i.current_stock
     FROM product_ingredients pi JOIN ingredients i ON i.id = pi.ingredient_id
     WHERE pi.product_id IN (?)`,
    [productIds]
  );
  const recipeByProduct = {};
  for (const r of recipeRows) {
    if (!recipeByProduct[r.product_id]) recipeByProduct[r.product_id] = [];
    recipeByProduct[r.product_id].push(toIngredient(r));
  }

  const ingredientsByOption = {};
  if (options.length) {
    const [optIngRows] = await pool.query(
      `SELECT oi.option_id, oi.ingredient_id, oi.quantity_required, i.name, i.unit, i.current_stock
       FROM option_ingredients oi JOIN ingredients i ON i.id = oi.ingredient_id
       WHERE oi.option_id IN (?)`,
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
    conditions.push('c.slug = ?');
    params.push(category);
  }
  if (search) {
    conditions.push(`(p.name LIKE ? OR c.name LIKE ? OR EXISTS (
      SELECT 1 FROM option_groups og JOIN options o ON o.option_group_id = og.id
      WHERE og.product_id = p.id AND o.name LIKE ?
    ))`);
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (!includeUnavailable) {
    conditions.push('p.available = 1');
  }

  const [rows] = await pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
        MIN(i.current_stock / pi.quantity_required) AS max_sellable_by_ingredients
     FROM products p
     JOIN categories c ON p.category_id = c.id
     LEFT JOIN product_ingredients pi ON pi.product_id = p.id
     LEFT JOIN ingredients i ON i.id = pi.ingredient_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY p.id
     ORDER BY c.display_order ASC, p.name ASC`,
    params
  );

  const withOptions = await attachOptionGroups(rows);
  const result = withOptions.map((p) => ({ ...p, status: computeStatus(p) }));
  res.json(result);
});

// GET /api/products/:id
const getProduct = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
        MIN(i.current_stock / pi.quantity_required) AS max_sellable_by_ingredients
     FROM products p
     JOIN categories c ON p.category_id = c.id
     LEFT JOIN product_ingredients pi ON pi.product_id = p.id
     LEFT JOIN ingredients i ON i.id = pi.ingredient_id
     WHERE p.id = ? AND p.deleted_at IS NULL
     GROUP BY p.id`,
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
  if (Number(price) < 0) throw new ApiError(400, 'Price cannot be negative.');

  const [result] = await pool.query(
    `INSERT INTO products (category_id, name, description, price, sku, track_stock, stock, low_stock_threshold)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [category_id, name.trim(), description || '', price, sku || null, track_stock ? 1 : 0,
      track_stock ? (stock || 0) : null, low_stock_threshold || 10]
  );

  res.status(201).json({ id: result.insertId, message: 'Product created.' });
});

// PUT /api/products/:id (admin) -- edit product / change price / set availability
const updateProduct = asyncHandler(async (req, res) => {
  const { category_id, name, description, price, available, track_stock, stock, low_stock_threshold, sku } = req.body;

  const [existing] = await pool.query(`SELECT id FROM products WHERE id = ? AND deleted_at IS NULL`, [req.params.id]);
  if (!existing.length) throw new ApiError(404, 'Product not found.');

  if (price !== undefined && Number(price) < 0) throw new ApiError(400, 'Price cannot be negative.');

  await pool.query(
    `UPDATE products SET
       category_id = COALESCE(?, category_id),
       name = COALESCE(?, name),
       description = COALESCE(?, description),
       price = COALESCE(?, price),
       available = COALESCE(?, available),
       track_stock = COALESCE(?, track_stock),
       stock = COALESCE(?, stock),
       low_stock_threshold = COALESCE(?, low_stock_threshold),
       sku = COALESCE(?, sku)
     WHERE id = ?`,
    [category_id, name, description, price, available, track_stock, stock, low_stock_threshold, sku, req.params.id]
  );

  res.json({ message: 'Product updated.' });
});

// DELETE /api/products/:id (admin) -- soft delete/deactivate, never hard-delete
// (keeps historical sales records intact)
const deactivateProduct = asyncHandler(async (req, res) => {
  const [existing] = await pool.query(`SELECT id FROM products WHERE id = ?`, [req.params.id]);
  if (!existing.length) throw new ApiError(404, 'Product not found.');

  await pool.query(
    `UPDATE products SET available = 0, deleted_at = NOW() WHERE id = ?`,
    [req.params.id]
  );
  res.json({ message: 'Product deactivated.' });
});

// PATCH /api/products/:id/restore (admin)
const restoreProduct = asyncHandler(async (req, res) => {
  await pool.query(`UPDATE products SET available = 1, deleted_at = NULL WHERE id = ?`, [req.params.id]);
  res.json({ message: 'Product restored.' });
});

// POST /api/products/:id/image (admin) -- expects multer to have placed the file in a temp folder;
// the product's real category is looked up from the database (never trusted from the client),
// then the file is moved into its final public folder.
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No image file was uploaded.');

  const [rows] = await pool.query(
    `SELECT c.slug AS category_slug FROM products p JOIN categories c ON p.category_id = c.id WHERE p.id = ?`,
    [req.params.id]
  );
  if (!rows.length) throw new ApiError(404, 'Product not found.');

  const category = rows[0].category_slug.replace(/[^a-z0-9-]/gi, '');
  const destDir = path.join(__dirname, '..', '..', 'frontend', 'public', 'images', 'products', category);
  fs.mkdirSync(destDir, { recursive: true });

  const destPath = path.join(destDir, req.file.filename);
  fs.renameSync(req.file.path, destPath);

  const relativePath = `/images/products/${category}/${req.file.filename}`;
  await pool.query(`UPDATE products SET image = ? WHERE id = ?`, [relativePath, req.params.id]);
  res.json({ message: 'Image uploaded.', image: relativePath });
});

// DELETE /api/products/:id/image (admin)
const removeImage = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`SELECT image FROM products WHERE id = ?`, [req.params.id]);
  if (!rows.length) throw new ApiError(404, 'Product not found.');

  const image = rows[0].image;
  if (image) {
    const filePath = path.join(__dirname, '..', '..', 'frontend', 'public', image);
    fs.unlink(filePath, () => {}); // best-effort; ignore if already missing
  }
  await pool.query(`UPDATE products SET image = NULL WHERE id = ?`, [req.params.id]);
  res.json({ message: 'Image removed.' });
});

module.exports = {
  getProducts, getProduct, createProduct, updateProduct,
  deactivateProduct, restoreProduct, uploadImage, removeImage,
};
