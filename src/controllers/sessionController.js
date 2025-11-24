// src/controllers/sessionController.js
import jwt from "jsonwebtoken";
import { validateSession, destroySession } from "../services/sessionService.js";
import { config } from "../config/config.js";

export async function validateSessionController(req, res) {
  try {
    const { session_id, token } = req.body;

    if (!session_id || !token) {
      return res.status(400).json({
        status: "error",
        message: "session_id and token are required",
      });
    }

    const result = await validateSession(session_id);
    if (!result.valid) {
      return res.status(401).json({
        status: "error",
        message: `Invalid session: ${result.reason}`,
      });
    }

    // verify JWT also
    try {
      jwt.verify(token, config.jwt.secret);
    } catch (err) {
      return res.status(401).json({
        status: "error",
        message: "Invalid or expired token",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Session is valid",
      data: {
        session_id,
        user_id: result.session.user_id,
        expires_at: result.session.expires_at,
      },
    });
  } catch (err) {
    console.error("Session validate error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error during session validation",
    });
  }
}

export async function logoutController(req, res) {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({
        status: "error",
        message: "session_id is required",
      });
    }

    await destroySession(session_id);

    return res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error during logout",
    });
  }
}
