import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,

  db: {
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  otp: {
    ttlMinutes: Number(process.env.OTP_TTL_MINUTES || 10),
  },

  session: {
    ttlHours: Number(process.env.SESSION_TTL_HOURS || 8),
  },
};

if (!config.jwt.secret) {
  console.error('JWT_SECRET is required in .env');
  process.exit(1);
}
