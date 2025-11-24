import { Router } from "express";
import { getStudentsBySchoolId, registerStudent } from "../controllers/studentController.js";
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
  
router.get('/school/:school_id', getStudentsBySchoolId);

export default router;
