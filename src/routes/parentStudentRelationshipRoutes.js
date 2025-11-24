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
import { authenticate } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = Router();

// Create relationship
// POST /api/relationships - Create parent-student relationship
router.post("/", authenticate, authorizeRoles('ADMIN', 'PRINCIPAL'), createRelationshipController);

// List (with filters & pagination)
router.get("/", listRelationshipsController);

// Get by student
router.get("/student/:studentId", getByStudentController);

// Get by parent
router.get("/parent/:parentId", getByParentController);

// Update
// PATCH /api/relationships/:relationshipId - Update relationship
router.patch("/:relationshipId", authenticate, authorizeRoles('ADMIN', 'PRINCIPAL'), updateRelationshipController);

// Delete
router.delete("/:relationshipId", authenticate, authorizeRoles('ADMIN', 'PRINCIPAL'), deleteRelationshipController);

export default router;
