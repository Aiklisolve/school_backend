// src/routes/parentRoutes.js
import { Router } from "express";
import { getParentsBySchoolId, registerParent } from "../controllers/parentController.js";
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

  
router.get('/school/:school_id', getParentsBySchoolId);

export default router;
