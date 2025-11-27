// src/routes/teacherDashboardRoutes.js
import express from "express";
import { getTeacherDashboard } from "../controllers/teacherDashboardController.js";

const router = express.Router();

// GET /api/teachers/:teacherId/dashboard
router.get("/:teacherId/dashboard", getTeacherDashboard);

export default router;
