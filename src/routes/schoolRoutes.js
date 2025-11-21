import { Router } from "express";
import { registerSchool, getSchoolById,
  listSchools, } from "../controllers/schoolController.js";

const router = Router();

router.post("/register", registerSchool);
// List schools with optional filters
// GET /api/schools?city=&state=&board_type=&is_active=true
router.get("/", listSchools);

// Get single school by ID
// GET /api/schools/:schoolId
router.get("/:schoolId", getSchoolById);

export default router;
