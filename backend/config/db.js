const { Pool, options } = require('./postgresql');
const pool = new Pool(options());
pool.on('error', err => console.error('[PostgreSQL pool]', { code: err.code, message: err.message }));
module.exports = pool;
