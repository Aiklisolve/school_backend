import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export function signJwt(payload) {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

export function verifyJwt(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch {
    return null;
  }
}
