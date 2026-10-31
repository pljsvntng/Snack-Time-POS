const fs = require('node:fs/promises');
const pool = require('../config/db');
const ApiError = require('./ApiError');
const asyncHandler = require('./asyncHandler');

function imageType(data, {bundledSvg=false}={}) {
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return 'image/jpeg';
  if (data.length >= 12 && data.toString('ascii',0,4) === 'RIFF' && data.toString('ascii',8,12) === 'WEBP') return 'image/webp';
  // Only existing, repository-owned SVG illustrations may be imported. Uploads
  // never enable this flag and continue to accept raster images only.
  if (bundledSvg && /^\s*(?:<\?xml[^>]*>\s*)?<svg\b/.test(data.toString('utf8')) && !/<script|<foreignObject|\bon\w+\s*=|javascript:|<!DOCTYPE/i.test(data.toString('utf8'))) return 'image/svg+xml';
  throw new ApiError(400, 'The file must contain a valid JPG, PNG, or WEBP image.');
}
async function saveImage(productId, relativePath, upload) {
  try {
    const data = await fs.readFile(upload.path), mime = imageType(data);
    if (mime !== upload.mimetype) throw new ApiError(400, 'Image contents do not match the uploaded file type.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const {rows:[product]} = await client.query('SELECT image FROM products WHERE id=$1 FOR UPDATE',[productId]);
      if (!product) throw new ApiError(404, 'Product not found.');
      await client.query('INSERT INTO product_images(path,mime_type,contents) VALUES($1,$2,$3)',[relativePath,mime,data]);
      await client.query('UPDATE products SET image=$1 WHERE id=$2',[relativePath,productId]);
      if (product.image) await client.query('DELETE FROM product_images WHERE path=$1',[product.image]);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  } finally { await fs.unlink(upload.path).catch(()=>{}); }
}
async function removeImage(productId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {rows:[product]} = await client.query('SELECT image FROM products WHERE id=$1 FOR UPDATE',[productId]);
    if (!product) throw new ApiError(404,'Product not found.');
    await client.query('UPDATE products SET image=NULL WHERE id=$1',[productId]);
    if (product.image) await client.query('DELETE FROM product_images WHERE path=$1',[product.image]);
    await client.query('COMMIT');
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
const serveImage = asyncHandler(async (req,res,next) => {
  if (process.env.PRODUCT_IMAGE_STORAGE !== 'postgres') return next();
  const {rows:[image]} = await pool.query('SELECT mime_type,contents FROM product_images WHERE path=$1',['/images'+req.path]);
  if (!image) return next();
  res.set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; sandbox");
  res.set('Cache-Control','public, max-age=86400').type(image.mime_type).send(image.contents);
});
module.exports = {imageType,saveImage,removeImage,serveImage};
