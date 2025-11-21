// src/routes/masterDataRoutes.js
import { Router } from "express";
import {
  getClassesController,
  getSectionsController,
  getParentsController,
  getStudentsController,
  getTeachersController,
} from "../controllers/masterDataController.js";

const router = Router();

// Classes
router.get("/classes", getClassesController);

// Sections
router.get("/sections", getSectionsController);

// Parents
router.get("/parents", getParentsController);

// Students
router.get("/students", getStudentsController);

// Teachers
router.get("/teachers", getTeachersController);

export default router;
