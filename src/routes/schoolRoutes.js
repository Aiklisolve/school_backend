import { Router } from "express";
import { registerSchool, getSchoolById,
  listSchools, } from "../controllers/schoolController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = Router();

// POST /api/schools/register - Create school
router.post("/register", authenticate, authorizeRoles('ADMIN'), registerSchool);
// List schools with optional filters
// GET /api/schools?city=&state=&board_type=&is_active=true
router.get("/", listSchools);

// Get single school by ID
// GET /api/schools/:schoolId
router.get("/:schoolId", getSchoolById);

export default router;
