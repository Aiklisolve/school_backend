import { Router } from "express";
import { getStudentsBySchoolId, registerStudent } from "../controllers/studentController.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = Router();

// POST /api/students/register

// router.post(
//     "/register",
//     authenticate,
//     authorizeRoles("ADMIN", "PRINCIPAL"),
//     registerStudent
//   );
  
router.post("/register", registerStudent);
router.get('/school/:school_id', getStudentsBySchoolId);

export default router;
