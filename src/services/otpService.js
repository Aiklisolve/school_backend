import { query } from '../config/db.js';
import { config } from '../config/env.js';
import { v4 as uuidv4 } from 'uuid';
import moment from "moment-timezone";
function generateOtp() {
  // 4-digit OTP
  return Math.floor(1000 + Math.random() * 9000).toString();
}


export async function createOtpForUser(user, explicitMobile) {
  const otpCode = generateOtp();
  const ttl = Number(config.otp.ttlMinutes || 30);

const nowIST = moment().tz("Asia/Kolkata");

// EXPIRY in IST (+TTL minutes)
const expiresIST = nowIST.clone().add(ttl, "minutes");

// Convert IST → UTC DATE OBJECT for Postgres
const expiresUTC = expiresIST.tz("UTC").toDate();

// For logs only (optional)
// console.log("NOW IST       =", nowIST.format("DD/MM/YYYY HH:mm:ss"));
// console.log("EXPIRES IST   =", expiresIST.format("DD/MM/YYYY HH:mm:ss"));
// console.log("EXPIRES UTC   =", expiresUTC.toISOString());


  const mobile = explicitMobile || user.phone;

  const sql = `
    insert into users_otps
      (user_id, phone, otp_code, otp_type,
       expires_at, is_used, attempts_count, email, ip_address)
    values
      ($1, $2, $3, 'LOGIN', $4,
       false, 0, $5, $6)
    returning *;
  `;

  const { rows } = await query(sql, [
    user.user_id,
    mobile,
    otpCode,
    expiresUTC,   // store UTC timestamp
    user.email,
    "127.0.0.1"
  ]);

  return {
    otpCode,
    expiresIST: expiresIST.format("DD/MM/YYYY HH:mm:ss"),
    expiresUTC,
    row: rows[0]
  };
}



// Verify OTP for user
export async function verifyUserOtp(userId, mobile, otp) {
  const sql = `
    select otp_id, otp_code, expires_at, is_used
    from users_otps
    where user_id=$1 and phone=$2 and otp_type='LOGIN'
    order by created_at desc limit 1;
  `;

  const { rows } = await query(sql, [userId, mobile]);
  if (!rows.length) return { valid: false, reason: "otp_not_found" };

  const row = rows[0];

  const nowIST = moment().tz("Asia/Kolkata");
  const expiresIST = moment(row.expires_at).tz("Asia/Kolkata");

  // console.log("NOW IST       =", nowIST.format("DD/MM/YYYY HH:mm:ss"));
  // console.log("EXPIRES IST   =", expiresIST.format("DD/MM/YYYY HH:mm:ss"));
// console.log('otp_code',row.otp_code);
// console.log('otp',otp);

  if (row.is_used) return { valid: false, reason: "otp_used" };
  if (nowIST.isAfter(expiresIST)) return { valid: false, reason: "otp_expired" };
if (String(row.otp_code).trim() !== String(otp).trim()) {
  return { valid: false, reason: "otp_mismatch" };
}

  return { valid: true , otpRow: row };
}



