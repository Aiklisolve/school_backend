import { Router } from "express";
import {
  validateSessionController,
  logoutController,
} from "../controllers/sessionController.js";

const router = Router();

// POST /api/sessions/validate
router.post("/validate", validateSessionController);

// POST /api/sessions/logout
router.post("/logout", logoutController);

export default router;
