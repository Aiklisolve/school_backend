import dotenv from 'dotenv';


export const config = {
  session: {
    ttlHours: process.env.JWT_EXPIRES_IN, // session valid for 8 hours
  },
  jwt: {
    secret: process.env.JWT_SECRET || "dev_secret_change_me",
    expiresIn: "8h",
  },
  timezone: "Asia/Kolkata",
};
