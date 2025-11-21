import { query } from '../config/db.js';
import { config } from '../config/env.js';
import moment from "moment-timezone";
// Create session row in user_session_details
export async function createSessionForUser(userId, token, ip, userAgent) {
  const sessionId = cryptoRandomUUID();
  const now = Date.now();
const utcTime = now;

  // const expiresAt = new Date(
  //   now + config.session.ttlHours * 60 * 60 * 1000
  // ).toISOString();

const expiresAt = moment(utcTime)
  .tz("Asia/Kolkata")
  .add(config.session.ttlHours, "hours")
  .format("YYYY-MM-DD HH:mm:ss");

  const lastActivity = new Date().toISOString();

  const sql = `
    insert into user_sessions
      (session_id, user_id, jwt_token, device_type,
       ip_address, user_agent, expires_at, last_activity_at,
        created_at,is_active)
    values
      ($1, $2, $3, 'system',
       $4, $5, $6, $7,
       $6,true)
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

/**
 * Validate session by session_id
 */
export async function validateSession(sessionId) {
  const sql = `
    SELECT
      session_id,
      user_id,
      jwt_token,
      expires_at,
      is_active
    FROM public.user_sessions
    WHERE session_id = $1;
  `;

  const { rows } = await query(sql, [sessionId]);
  if (!rows.length) {
    return { valid: false, reason: "not_found" };
  }

  const session = rows[0];
  const now = new Date();

  if (!session.is_active) {
    return { valid: false, reason: "inactive" };
  }

  if (session.expires_at <= now) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, session };
}

/**
 * Destroy session by session_id (logout)
 */
export async function destroySession(sessionId) {
  const sql = `
    UPDATE public.user_sessions
    SET is_active = false,
        last_activity_at = NOW()
    WHERE session_id = $1;
  `;

  await query(sql, [sessionId]);
}

/**
 * Optionally: destroy all sessions for a user (force logout everywhere)
 */
export async function destroyAllSessionsForUser(userId) {
  const sql = `
    UPDATE public.user_sessions
    SET is_active = false,
        last_activity = NOW()
    WHERE user_id = $1;
  `;
  await query(sql, [userId]);
}