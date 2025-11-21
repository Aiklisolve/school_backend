import { Router } from "express";
import { getStudentsBySchoolId, registerStudent } from "../controllers/studentController.js";

const router = Router();

// POST /api/students/register
router.post("/register", registerStudent);
router.get('/school/:school_id', getStudentsBySchoolId);

export default router;
