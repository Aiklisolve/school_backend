// src/controllers/branchController.js
import {
  createBranch,
  getBranchById,
  listBranchesBySchool,
  updateBranch,
  deactivateBranch,
    listAllBranches,
} from "../services/branchService.js";

/**
 * POST /api/branches
 * Body: { school_id, branch_code, branch_name, address_line1, city, state, pincode, phone?, is_main_branch?, max_students? }
 */
export async function createBranchController(req, res) {
  try {
    const {
      school_id,
      branch_code,
      branch_name,
      address_line1,
      city,
      state,
      pincode,
      phone,
      is_main_branch,
      max_students,
    } = req.body;

    // Basic validation
    if (
      !school_id ||
      !branch_code ||
      !branch_name ||
      !address_line1 ||
      !city ||
      !state ||
      !pincode
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "school_id, branch_code, branch_name, address_line1, city, state, pincode are required",
      });
    }

    const branch = await createBranch({
      school_id,
      branch_code,
      branch_name,
      address_line1,
      city,
      state,
      pincode,
      phone,
      is_main_branch,
      max_students,
    });

    return res.status(201).json({
      status: "success",
      message: "Branch created successfully",
      data: branch,
    });
  } catch (err) {
    // console.error("Create branch error:", err);

    if (err.code === "23505") {
      // unique violation
      return res.status(409).json({
        status: "error",
        message:
          "Branch code already exists for this school (school_id, branch_code must be unique)",
      });
    }

    if (err.code === "23503") {
      // foreign key violation
      return res.status(400).json({
        status: "error",
        message: "Invalid school_id (school does not exist)",
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Internal server error while creating branch",
    });
  }
}

/**
 * GET /api/branches/:branchId
 */
export async function getBranchController(req, res) {
  try {
    const { branchId } = req.params;

    const branch = await getBranchById(branchId);
    if (!branch) {
      return res.status(404).json({
        status: "error",
        message: "Branch not found",
      });
    }

    return res.status(200).json({
      status: "success",
      data: branch,
    });
  } catch (err) {
    // console.error("Get branch error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error while fetching branch",
    });
  }
}

/**
 * GET /api/branches/school/:schoolId?active=true
 */
export async function listBranchesForSchoolController(req, res) {
  try {
    const { schoolId } = req.params;
    const { active, page, limit } = req.query;

    if (!schoolId) {
      return res.status(400).json({
        status: "error",
        message: "schoolId is required",
      });
    }

    const onlyActive = active === "false" ? false : true;

    const result = await listBranchesBySchool(
      schoolId,
      onlyActive,
      page,
      limit
    );

    return res.status(200).json({
      status: "success",
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      count: result.branches.length,
      data: result.branches,
    });
  } catch (err) {
    // console.error("List branches error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error while listing branches",
    });
  }
}

/**
 * PUT /api/branches/:branchId
 */
export async function updateBranchController(req, res) {
  try {
    const { branchId } = req.params;
    const updates = req.body;

    const updated = await updateBranch(branchId, updates);
    if (!updated) {
      return res.status(404).json({
        status: "error",
        message: "Branch not found",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Branch updated successfully",
      data: updated,
    });
  } catch (err) {
    // console.error("Update branch error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error while updating branch",
    });
  }
}

/**
 * DELETE /api/branches/:branchId  (soft delete → is_active = false)
 */
export async function deactivateBranchController(req, res) {
  try {
    const { branchId } = req.params;

    const updated = await deactivateBranch(branchId);
    if (!updated) {
      return res.status(404).json({
        status: "error",
        message: "Branch not found",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Branch deactivated successfully",
      data: updated,
    });
  } catch (err) {
    // console.error("Deactivate branch error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error while deactivating branch",
    });
  }
}

export async function listAllBranchesController(req, res) {
  try {
    const { page, limit, active, schoolId } = req.query;

    const onlyActive = active === "false" ? false : true;

    const result = await listAllBranches({
      page,
      limit,
      onlyActive,
      schoolId,
    });

    return res.status(200).json({
      status: "success",
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      count: result.branches.length,
      data: result.branches,
    });
  } catch (err) {
    // console.error("List all branches error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error while listing branches",
    });
  }
}

