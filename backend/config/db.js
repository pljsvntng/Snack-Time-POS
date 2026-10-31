const { Pool, options } = require('./postgresql');
const pool = new Pool(options());
pool.on('error', err => console.error('[PostgreSQL pool]', { code: /^[A-Z0-9_]{1,40}$/.test(err.code||'')?err.code:'UNEXPECTED' }));
module.exports = pool;
