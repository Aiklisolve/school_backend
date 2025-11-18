import pkg from 'pg';
import { config } from './env.js';

const { Pool } = pkg;

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
});

// simple helper
// export async function query(sql, params) {
//   const client = await pool.connect();
//   try {
//     const res = await client.query(sql, params);
//     return res;
//   } finally {
//     client.release();
//   }
// }
export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('DB QUERY', { text, duration, rows: res.rowCount });
  return res;
}