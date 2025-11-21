// src/routes/parentStudentRelationshipRoutes.js
import { Router } from "express";
import {
  createRelationshipController,
  listRelationshipsController,
  getByStudentController,
  getByParentController,
  updateRelationshipController,
  deleteRelationshipController,
} from "../controllers/parentStudentRelationshipController.js";
// import { authMiddleware } from "../middleware/auth.js"; // if you want protected

const router = Router();

// Create relationship
router.post("/", /*authMiddleware,*/ createRelationshipController);

// List (with filters & pagination)
router.get("/", /*authMiddleware,*/ listRelationshipsController);

// Get by student
router.get("/student/:studentId", /*authMiddleware,*/ getByStudentController);

// Get by parent
router.get("/parent/:parentId", /*authMiddleware,*/ getByParentController);

// Update
router.patch("/:relationshipId", /*authMiddleware,*/ updateRelationshipController);

// Delete
router.delete("/:relationshipId", /*authMiddleware,*/ deleteRelationshipController);

export default router;
