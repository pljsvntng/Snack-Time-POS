const fs = require('node:fs');
const path = require('node:path');
const { Pool, types } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.postgresql') });
// NUMERIC remains a decimal string. Do not globally parse money as floating point.
types.setTypeParser(1082, value => value); // DATE is a business date, not a UTC instant.
types.setTypeParser(20, value => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new RangeError('PostgreSQL integer exceeds JavaScript safe integer range');
  return n;
});
function options(database = process.env.PG_DATABASE) {
  if (process.env.DATABASE_URL) {
    let url;
    try { url = new URL(process.env.DATABASE_URL); } catch { throw Error('DATABASE_URL must be a PostgreSQL connection URL.'); }
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) throw Error('Invalid PostgreSQL DATABASE_URL.');
    // Parse explicitly: pg's URL parser can otherwise replace verified TLS settings
    // when Neon's connection string contains sslmode=require.
    return {
      host: url.hostname, port: Number(url.port || 5432),
      database: decodeURIComponent(url.pathname.slice(1)),
      user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
      ssl: { rejectUnauthorized: true, servername: url.hostname },
      enableChannelBinding: true, application_name: 'snacktime-pos',
      max: 5, connectionTimeoutMillis: 30000, idleTimeoutMillis: 30000,
      options: '-c timezone=Asia/Manila',
    };
  }
  if (!database || !process.env.PG_USER) throw Error('Configure PG_DATABASE and PG_USER in backend/.env.postgresql');
  return { host: process.env.PG_HOST || 'localhost', port: Number(process.env.PG_PORT || 5432),
    database, user: process.env.PG_USER, password: process.env.PG_PASSWORD || '',
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: true, ...(process.env.PG_SSL_CA ? {ca:fs.readFileSync(process.env.PG_SSL_CA,'utf8')} : {}) } : false,
    options: '-c timezone=Asia/Manila', application_name: 'snacktime-pos',
    max: 10, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 };
}
module.exports = { Pool, options };
