import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { logError } from "./logger.js";

//RBAC implemented here
export function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    // Use the same JWT secret from config to ensure consistency
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    // Log the error for debugging
    logError(error, `JWT Verification Failed - ${req.method} ${req.url}`);
    
    // Return appropriate error message
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "Token expired" });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    return res.status(401).json({ message: "Authentication failed" });
  }
}
