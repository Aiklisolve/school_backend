import { query } from '../config/db.js';

// Get user by email + role
export async function findUserByEmailAndRole(email, role) {
  const sql = `
    select user_id, email, phone, role, password_hash, is_active
    from users
    where email = $1
      and role = $2
      and email_verified = false
    limit 1;
  `;
  const { rows } = await query(sql, [email, role]);
  
  return rows[0] || null;
}

// Get user by mobile + role
export async function findUserByMobileAndRole(mobile, role) {
  const sql = `
    select user_id, email, phone, role, password_hash, is_active
    from users
    where phone = $1
      and role = $2
      and email_verified = false
    limit 1;
  `;
  const { rows } = await query(sql, [mobile, role]);
  // console.log(rows);
  
  return rows[0] || null;
}
