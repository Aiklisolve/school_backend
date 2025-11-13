import { query } from '../config/db.js';

// Get user by email + role
export async function findUserByEmailAndRole(email, role) {
  const sql = `
    select user_id, email, mobile_number, role, password_hash, status
    from users
    where email = $1
      and role = $2
      and deleted_flag = false
    limit 1;
  `;
  const { rows } = await query(sql, [email, role]);
  return rows[0] || null;
}

// Get user by mobile + role
export async function findUserByMobileAndRole(mobile, role) {
  const sql = `
    select user_id, email, mobile_number, role, password_hash, status
    from users
    where mobile_number = $1
      and role = $2
      and deleted_flag = false
    limit 1;
  `;
  const { rows } = await query(sql, [mobile, role]);
  return rows[0] || null;
}
