import { findUserByEmailAndRole, findUserByMobileAndRole } from '../services/userService.js';
import { createOtpForUser, verifyUserOtp } from '../services/otpService.js';
import { createSessionForUser } from '../services/sessionService.js';
import { signJwt } from '../utils/jwt.js';

export async function loginController(req, res) {
  const { step, login_type, email, password, mobile, otp, role } = req.body || {};

  if (!step) {
    return res.status(400).json({ status: 400, message: 'step is required' });
  }

  try {
    // STEP 1: credential_validation (email + password)
    if (step === 'credential_validation') {
      if (login_type !== 'email_password') {
        return res.status(400).json({
          status: 400,
          message: 'login_type must be email_password',
        });
      }
      if (!email || !password || !role) {
        return res.status(400).json({
          status: 400,
          message: 'email, password, role are required',
        });
      }

      const user = await findUserByEmailAndRole(email, role);
      // console.log(user);
      // console.log(user.is_active);


      if (!user || String(user.is_active).trim() !== 'true') {
        return res.status(401).json({
          status: 401,
          message: 'invalid user credentials',
        });
      }
      // console.log(user.password_hash);

      // TODO: if using bcrypt, compare hash here
      if (user.password_hash !== password) {
        return res.status(401).json({
          status: 401,
          message: 'invalid user credentials',
        });
      }

      const { otpCode, expiresAt } = await createOtpForUser(user);

      return res.json({
        status: 200,
        message: 'valid details. otp sent',
        otp: otpCode, // TODO: remove in production
        expires_at: expiresAt,
        user_id: user.user_id,
        login_type,
      });
    }

    // STEP 2: send_otp (mobile only)
    if (step === 'send_otp') {
      if (login_type !== 'mobile') {
        return res.status(400).json({
          status: 400,
          message: 'login_type must be mobile',
        });
      }
      if (!mobile || !role) {
        return res.status(400).json({
          status: 400,
          message: 'mobile and role are required',
        });
      }

      const user = await findUserByMobileAndRole(mobile, role);
      if (!user || String(user.is_active).trim() !== 'true') {
        return res.status(401).json({
          status: 401,
          message: 'invalid user credentials',
        });
      }

      const { otpCode, expiresAt } = await createOtpForUser(user, mobile);

      return res.json({
        status: 200,
        message: 'otp sent',
        otp: otpCode, // TODO: remove in production
        expires_at: expiresAt,
        user_id: user.user_id,
        login_type,
      });
    }

    // STEP 3: final_login (OTP verification -> session + JWT)
    if (step === 'final_login') {
      if (!role) {
        return res.status(400).json({ status: 400, message: 'role is required' });
      }
      if (!otp) {
        return res.status(400).json({ status: 400, message: 'otp is required' });
      }

      let user = null;
      if (email) {
        user = await findUserByEmailAndRole(email, role);
      } else if (mobile) {
        user = await findUserByMobileAndRole(mobile, role);
      }
      // console.log('user', user);
      // console.log('user is_active', user.is_active);

      if (!user || String(user.is_active).trim() !== 'true') {
        return res.status(401).json({
          status: 401,
          message: 'invalid user credentials',
        });
      }

      const mobileToUse = mobile || user.phone;
      if (!mobileToUse) {
        return res.status(400).json({
          status: 400,
          message: 'mobile is required for OTP verification',
        });
      }

      const { valid, reason } = await verifyUserOtp(user.user_id, mobileToUse, otp);
      if (!valid) {
        return res.status(401).json({
          status: 401,
          message: 'invalid otp',
          reason,
        });
      }

      const token = signJwt({
        user_id: user.user_id,
        email: user.email,
        role: user.role,
      });

      function normalizeIp(ip) {
        if (!ip) return null;

        // ::1  →  127.0.0.1
        if (ip === "::1") return "127.0.0.1";

        // ::ffff:192.168.1.10 → 192.168.1.10
        if (ip.startsWith("::ffff:")) return ip.replace("::ffff:", "");

        return ip;
      }

      const forwarded = req.headers["x-forwarded-for"];
      const rawIp = forwarded ? forwarded.split(",")[0].trim() : req.socket.remoteAddress;
      const ip = normalizeIp(rawIp);

      // console.log("Client IP:", ip);


      const userAgent = req.headers['user-agent'] || null;

      const { sessionId, expiresAt , dbRow} = await createSessionForUser(
        user.user_id,
        token,
        ip,
        userAgent
      );

      return res.json({
        status: 200,
        message: 'Login successful',
        session_id: sessionId,
        user_id: user.user_id,
        token,
        expiry: expiresAt,
        role: user.role,
        email: user.email,
        session_status: dbRow['is_active'],
      });
    }

    // Unknown step
    return res.status(400).json({
      status: 400,
      message: `Unknown step: ${step}`,
    });
  } catch (err) {
    // console.error('Login error:', err);
    return res.status(500).json({
      status: 500,
      message: 'Internal server error',
      error: err.message,
    });
  }
}
