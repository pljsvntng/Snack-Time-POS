const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path'), { createHash } = require('node:crypto');
const { createImageReader } = require('../utils/productImageReader');
const root = path.resolve('test-only-images');
const digest = contents => createHash('sha256').update(contents).digest('hex');

test('matching bundled photos need metadata only; concurrent and repeated reads share a bounded cache', async () => {
  const contents = Buffer.from('bundled photo'); let queries = 0, reads = 0;
  const reader = createImageReader({ root, query: async () => { queries++; return { rows: [{ mime_type: 'image/png', content_hash: digest(contents) }] }; }, readFile: async () => { reads++; return contents; } });
  const values = await Promise.all(Array.from({ length: 12 }, () => reader.load('/images/photo.png')));
  assert.ok(values.every(value => value.contents.equals(contents)));
  assert.equal(queries, 1); assert.equal(reads, 1);
  await reader.load('/images/photo.png'); assert.equal(queries, 1);
  reader.invalidate('/images/photo.png'); await reader.load('/images/photo.png'); assert.equal(queries, 2);
});

test('custom/mismatched photos retain authoritative DB bytes; TTL and memory bounds evict old entries', async () => {
  let clock = 0, queries = 0;
  const reader = createImageReader({ root, maxBytes: 4, maxEntries: 2, ttl: 10, now: () => clock, readFile: async () => Buffer.from('different'), query: async (sql, [key]) => {
    queries++; return { rows: [sql.includes('content_hash') ? { mime_type: 'image/png', content_hash: digest(Buffer.from('db')) } : { mime_type: 'image/png', contents: Buffer.from(key.endsWith('large') ? 'large' : 'db') }] };
  } });
  assert.equal((await reader.load('/images/a')).contents.toString(), 'db');
  await reader.load('/images/b'); await reader.load('/images/a'); assert.equal(queries, 4);
  await reader.load('/images/c'); await reader.load('/images/b'); assert.equal(queries, 8, 'least recently used entry was evicted');
  clock = 11; await reader.load('/images/b'); assert.equal(queries, 10, 'expired photos are revalidated');
  await reader.load('/images/large'); await reader.load('/images/large'); assert.equal(queries, 14, 'oversized objects are never cached');
});

test('failed/missing reads are not cached, and invalidated in-flight results cannot refill the cache', async () => {
  let calls = 0, unblock;
  const reader = createImageReader({ root, readFile: async () => { throw Error('Not found'); }, query: async sql => {
    calls++; if (calls === 1) throw Object.assign(Error('quota'), { code: '53000' });
    if (calls === 2) return { rows: [] };
    if (sql.includes('content_hash')) return { rows: [{ mime_type: 'image/png', content_hash: 'not local' }] };
    if (calls === 4) await new Promise(resolve => { unblock = resolve; });
    return { rows: [{ mime_type: 'image/png', contents: Buffer.from('db') }] };
  } });
  await assert.rejects(reader.load('/images/a'), { code: '53000' }); assert.equal(await reader.load('/images/a'), null);
  const outstanding = reader.load('/images/a'); while (!unblock) await new Promise(resolve => setImmediate(resolve));
  reader.invalidate('/images/a'); unblock(); await outstanding; await reader.load('/images/a'); assert.equal(calls, 6);
});

test('DB image paths cannot read files outside the bundled image directory', async () => {
  let reads = 0;
  const reader = createImageReader({ root, readFile: async () => { reads++; throw Error('Must not read'); }, query: async sql => ({ rows: [sql.includes('content_hash') ? { mime_type: 'image/png', content_hash: 'hash' } : { mime_type: 'image/png', contents: Buffer.from('db') }] }) });
  await reader.load('/images/../../private'); assert.equal(reads, 0);
});
