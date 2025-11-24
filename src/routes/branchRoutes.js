// src/routes/branchRoutes.js
import { Router } from "express";
import {
  createBranchController,
  getBranchController,
  listBranchesForSchoolController,
  updateBranchController,
  deactivateBranchController,
   listAllBranchesController,
} from "../controllers/branchController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = Router();

// Create branch
// POST /api/branches
router.post("/", authenticate, authorizeRoles('ADMIN', 'PRINCIPAL'), createBranchController);


router.get("/", listAllBranchesController);
// Get single branch by ID
// GET /api/branches/:branchId
router.get("/:branchId", getBranchController);

// List branches for a school
// GET /api/branches/school/:schoolId?active=true|false
router.get("/school/:schoolId", listBranchesForSchoolController);

// Update branch
// PUT /api/branches/:branchId
router.put("/:branchId", authenticate, authorizeRoles('ADMIN', 'PRINCIPAL'), updateBranchController);

// Soft delete / deactivate branch
// DELETE /api/branches/:branchId
router.delete("/:branchId", authenticate, authorizeRoles('ADMIN', 'PRINCIPAL'), deactivateBranchController);

export default router;
