import { query } from '../config/db.js';
import { config } from '../config/env.js';

// Create session row in user_session_details
export async function createSessionForUser(userId, token, ip, userAgent) {
  const sessionId = cryptoRandomUUID();
  const now = Date.now();
  const expiresAt = new Date(
    now + config.session.ttlHours * 60 * 60 * 1000
  ).toISOString();
  const lastActivity = new Date().toISOString();

  const sql = `
    insert into user_session_details
      (session_id, user_id, jwt_token, remember_me_flag,
       ip_address, user_agent, expires_at, last_activity,
       is_active, created_by, updated_by, updated_time)
    values
      ($1, $2, $3, false,
       $4, $5, $6, $7,
       true, 'system', 'system', $6)
    returning *;
  `;

  const { rows } = await query(sql, [
    sessionId,
    userId,
    token,
    ip || null,
    userAgent || null,
    expiresAt,
    lastActivity,
  ]);

  return { sessionId, expiresAt, dbRow: rows[0] };
}

// Node 18+ has crypto.randomUUID; for older, use uuid lib
function cryptoRandomUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  } else {
    // fallback to uuid library if needed (import v4 from 'uuid')
    const { v4: uuidv4 } = require('uuid');
    return uuidv4();
  }
}
