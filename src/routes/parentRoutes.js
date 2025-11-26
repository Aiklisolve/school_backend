// src/routes/parentRoutes.js
import { Router } from "express";
import { registerParent, listParents } from "../controllers/parentController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = Router();

// POST /api/parents/register - Create parent
router.post(
    "/register",
    authenticate,
    authorizeRoles("ADMIN", "PRINCIPAL"),
    registerParent
  );

// GET /api/parents - List all parents with pagination
// Query params: page, limit, school_id, is_active
router.get('/', listParents);
  // GET /api/parents/school/:school_id - Get parents by school ID
// router.get('/school/:school_id', listParentsBySchoolId);   

export default router;
