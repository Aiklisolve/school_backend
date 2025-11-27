import { Router } from "express";
import { getStudentsBySchoolId, registerStudent, listStudents, getStudentDashboard } from "../controllers/studentController.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = Router();

// POST /api/students/register - Create student
router.post(
    "/register",
    authenticate,
    authorizeRoles("ADMIN", "PRINCIPAL"),
    registerStudent
  );

// GET /api/students - List all students with pagination
// Query params: page, limit, school_id, branch_id, current_status, is_active
router.get('/', listStudents);
  
// GET /api/students/school/:school_id - Get students by school ID
router.get('/school/:school_id', getStudentsBySchoolId);

router.get("/:studentId/dashboard", getStudentDashboard);

export default router;
