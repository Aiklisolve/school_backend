import { Router } from "express";
import { registerStudent } from "../controllers/studentController.js";

const router = Router();

// POST /api/students/register
router.post("/register", registerStudent);

export default router;
