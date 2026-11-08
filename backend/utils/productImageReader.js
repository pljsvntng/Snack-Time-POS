const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

// Only public product photos are cached. Stock, sales and authorization stay live.
function createImageReader({ query, root, maxBytes = 32 * 1024 * 1024, maxEntries = 64, ttl = 6 * 60 * 60 * 1000, now = Date.now, readFile = fs.readFile }) {
  const cache = new Map(), pending = new Map();
  const directory = path.resolve(root);
  let bytes = 0;
  function remove(key) {
    const entry = cache.get(key);
    if (entry) { bytes -= entry.image.contents.length; cache.delete(key); }
  }
  function invalidate(key) { remove(key); pending.delete(key); }
  async function read(key) {
    // Compare the bundled file with the DB checksum before using it. Matching
    // repository photos require a tiny metadata result rather than a BYTEA export.
    const { rows: [metadata] } = await query("SELECT mime_type, encode(sha256(contents),'hex') AS content_hash FROM product_images WHERE path=$1", [key]);
    if (!metadata) return null;
    const candidate = path.resolve(directory, key.slice('/images/'.length));
    if (key.startsWith('/images/') && candidate.startsWith(directory + path.sep)) {
      try {
        const contents = await readFile(candidate);
        if (createHash('sha256').update(contents).digest('hex') === metadata.content_hash) return { mime_type: metadata.mime_type, contents };
      } catch { /* Missing local files are read from their authoritative DB row. */ }
    }
    const { rows: [image] } = await query('SELECT mime_type,contents FROM product_images WHERE path=$1', [key]);
    return image || null;
  }
  function load(key) {
    const hit = cache.get(key);
    if (hit && hit.expires > now()) { cache.delete(key); cache.set(key, hit); return Promise.resolve(hit.image); }
    remove(key);
    if (pending.has(key)) return pending.get(key).promise;
    const request = {};
    request.promise = read(key).then(image => {
      // An upload/removal invalidating an in-flight read must not repopulate it.
      if (image && pending.get(key) === request && image.contents.length <= maxBytes) {
        while (cache.size && (bytes + image.contents.length > maxBytes || cache.size >= maxEntries)) remove(cache.keys().next().value);
        cache.set(key, { image, expires: now() + ttl }); bytes += image.contents.length;
      }
      return image;
    }).finally(() => { if (pending.get(key) === request) pending.delete(key); });
    pending.set(key, request);
    return request.promise;
  }
  return { load, invalidate };
}
module.exports = { createImageReader };
