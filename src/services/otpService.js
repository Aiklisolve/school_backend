import { query } from '../config/db.js';
import { config } from '../config/env.js';

function generateOtp() {
  // 4-digit OTP
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Create OTP for user
export async function createOtpForUser(user, explicitMobile) {
  const otpCode = generateOtp();
const now = Date.now();

  const expiresAt = new Date(
    now + config.otp.ttlMinutes * 60 * 1000
  ).toISOString();
  //  const expiresAt =  config.otp.ttlMinutes 
//   const expiresAt = new Date(config.otp.ttlMinutes).toLocaleString('en-IN', {
//   timeZone: 'Asia/Kolkata',
// });
  

  const mobile = explicitMobile || user.mobile_number;
  if (!mobile) throw new Error('No mobile number available for OTP');

  const sql = `
    insert into user_otp
      (user_id, mobile_number, otp_code, purpose,
       expires_at, is_used, attempts, created_by, "requestId")
    values
      ($1, $2, $3, 'login', $4, false, 0, 'System', $5)
    returning *;
  `;

  const { rows } = await query(sql, [
    user.user_id,
    mobile,
    otpCode,
    expiresAt,
    'dummy-request-id', // placeholder for MSG91 reqId
  ]);

  return { otpCode, expiresAt, row: rows[0] };
}

// Verify OTP for user
export async function verifyUserOtp(userId, mobile, otp) {
  const selectSql = `
    select otp_id, otp_code, expires_at, is_used
    from user_otp
    where user_id = $1
      and mobile_number = $2
      and purpose = 'login'
    order by created_time desc
    limit 1;
  `;
  const { rows } = await query(selectSql, [userId, mobile]);

  if (!rows.length) {
    return { valid: false, reason: 'otp_not_found' };
  }
  console.log(rows);

  const row = rows[0];
  const now = new Date();
  // const now = ""
  console.log(now);

  // const expiresAt = new Date(row.expires_at);
  const expiresAt = row.expires_at;
  console.log(expiresAt);
  

  if (row.is_used) {
    return { valid: false, reason: 'otp_already_used' };
  }
  if (now > expiresAt) {
    return { valid: false, reason: 'otp_expired' };
  }
  if (row.otp_code !== otp) {
    return { valid: false, reason: 'otp_mismatch' };
  }

  const updateSql = `
    update user_otp
    set is_used = true,
        used_at = $2
    where otp_id = $1;
  `;
  await query(updateSql, [row.otp_id, now.toISOString()]);

  return { valid: true, otpRow: row };
}
