// Read-only source export, followed by a full SQL restore verification in a scratch database.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env.mariadb') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const digest = data => crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
async function backup() {
  const source = process.env.DB_NAME;
  if (!source || !/^[a-zA-Z0-9_]+$/.test(source)) throw Error('A safe source DB_NAME is required');
  const config = { host: process.env.DB_HOST || 'localhost', port: process.env.DB_PORT || 3306, user: process.env.DB_USER, password: process.env.DB_PASSWORD || '', dateStrings: true, supportBigNumbers: true, bigNumberStrings: true, multipleStatements: true };
  const connection = await mysql.createConnection(config);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.resolve(__dirname, '../../database/backups', `${source}-${stamp}`);
  fs.mkdirSync(dir, { recursive: true });
  const scratch = `snacktime_restore_${Date.now()}`;
  let scratchCreated = false;
  try {
    await connection.query("SET time_zone = '+00:00'");
    await connection.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    const [tables] = await connection.query('SELECT * FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME', [source]);
    if (tables.some(t => t.TABLE_TYPE !== 'BASE TABLE' || t.ENGINE !== 'InnoDB')) throw Error('Review non-InnoDB tables/views before exporting');
    const snapshot = { source, exportedAt: new Date().toISOString(), timeZone: 'UTC', tables: {}, metadata: {} };
    for (const section of ['COLUMNS','STATISTICS','TABLE_CONSTRAINTS','KEY_COLUMN_USAGE','REFERENTIAL_CONSTRAINTS','TRIGGERS','ROUTINES','EVENTS']) {
      const field = section === 'ROUTINES' ? 'ROUTINE_SCHEMA' : section === 'EVENTS' ? 'EVENT_SCHEMA' : section === 'TRIGGERS' ? 'TRIGGER_SCHEMA' : section === 'REFERENTIAL_CONSTRAINTS' ? 'CONSTRAINT_SCHEMA' : 'TABLE_SCHEMA';
      const [rows] = await connection.query(`SELECT * FROM information_schema.${section} WHERE ${field} = ?`, [source]);
      snapshot.metadata[section] = rows;
    }
    if (snapshot.metadata.TRIGGERS.length || snapshot.metadata.ROUTINES.length || snapshot.metadata.EVENTS.length) throw Error('Stored routines/triggers/events need explicit conversion before migration');
    for (const table of tables) {
      const name = table.TABLE_NAME;
      const pk = snapshot.metadata.KEY_COLUMN_USAGE.filter(k => k.TABLE_NAME === name && k.CONSTRAINT_NAME === 'PRIMARY').sort((a,b)=>a.ORDINAL_POSITION-b.ORDINAL_POSITION).map(k=>k.COLUMN_NAME);
      if (!pk.length) throw Error('No primary key: ' + name);
      const [rows] = await connection.query('SELECT * FROM ?? . ?? ORDER BY ' + pk.map(k=>connection.escapeId(k)).join(','), [source, name]);
      const [[ddl]] = await connection.query('SHOW CREATE TABLE ?? . ??', [source, name]);
      snapshot.tables[name] = { rows, count: rows.length, sha256: digest(rows), ddl: ddl['Create Table'], autoIncrement: table.AUTO_INCREMENT };
    }
    await connection.commit();
    fs.writeFileSync(path.join(dir, 'snapshot.json'), JSON.stringify(snapshot, null, 2));
    const file = path.join(dir, 'mariadb.sql');
    const dump = process.env.MARIADB_DUMP || 'C:/xampp/mysql/bin/mysqldump.exe';
    const result = spawnSync(dump, ['--host='+config.host, '--port='+config.port, '--user='+config.user, '--single-transaction', '--skip-lock-tables', '--routines', '--events', '--triggers', '--hex-blob', '--default-character-set=utf8mb4', '--result-file='+file, source], { env: {...process.env, MYSQL_PWD: config.password}, encoding:'utf8', windowsHide:true });
    if (result.status !== 0) throw Error('mysqldump failed: ' + (result.stderr || result.error?.message));
    if (!fs.statSync(file).size || !fs.readFileSync(file,'utf8').includes('Dump completed')) throw Error('Incomplete SQL dump');
    await connection.query('CREATE DATABASE ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', [scratch]); scratchCreated = true;
    await connection.query('USE ??', [scratch]);
    await connection.query(fs.readFileSync(file, 'utf8'));
    await connection.query("SET time_zone = '+00:00'");
    for (const [name, table] of Object.entries(snapshot.tables)) {
      const pk = snapshot.metadata.KEY_COLUMN_USAGE.filter(k=>k.TABLE_NAME===name && k.CONSTRAINT_NAME==='PRIMARY').sort((a,b)=>a.ORDINAL_POSITION-b.ORDINAL_POSITION).map(k=>k.COLUMN_NAME);
      const [restored] = await connection.query('SELECT * FROM ?? ORDER BY '+pk.map(k=>connection.escapeId(k)).join(','), [name]);
      if (digest(restored) !== table.sha256) throw Error(`Backup restore differs for ${name}. Stop sales and repeat backup.`);
    }
    const manifest = { source, verifiedAt: new Date().toISOString(), restoredAndCompared: true, dumpSHA256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), snapshotSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,'snapshot.json'))).digest('hex'), tables: Object.fromEntries(Object.entries(snapshot.tables).map(([n,t])=>[n,{count:t.count,sha256:t.sha256}])) };
    fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
    console.log(JSON.stringify({ backup:dir, verified:true, tables:manifest.tables }, null, 2));
  } finally {
    if (scratchCreated) await connection.query('DROP DATABASE ??', [scratch]);
    await connection.end();
  }
}
backup().catch(err=>{console.error(err.message);process.exitCode=1;});
