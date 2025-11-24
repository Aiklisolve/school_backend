// src/controllers/masterDataController.js
import {
  listClasses,
  listSections,
  listParents,
  listStudents,
  listTeachers,
} from "../services/masterDataService.js";

export async function getClassesController(req, res) {
  try {
    const { schoolId, isActive, page, limit } = req.query;

    if (!schoolId) {
      return res.status(400).json({
        status: "error",
        message: "schoolId is required",
      });
    }

    const result = await listClasses({ schoolId, isActive, page, limit });

    return res.status(200).json({
      status: "success",
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      count: result.classes.length,
      data: result.classes,
    });
  } catch (err) {
    console.error("Get classes error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error while fetching classes",
    });
  }
}

export async function getSectionsController(req, res) {
  try {
    const { schoolId, classId, yearId, branchId, isActive, page, limit } =
      req.query;

    if (!schoolId) {
      return res.status(400).json({
        status: "error",
        message: "schoolId is required",
      });
    }

    const result = await listSections({
      schoolId,
      classId,
      yearId,
      branchId,
      isActive,
      page,
      limit,
    });

    return res.status(200).json({
      status: "success",
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      count: result.sections.length,
      data: result.sections,
    });
  } catch (err) {
    console.error("Get sections error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error while fetching sections",
    });
  }
}

export async function getParentsController(req, res) {
  try {
    const { schoolId, isActive, page, limit } = req.query;

    if (!schoolId) {
      return res.status(400).json({
        status: "error",
        message: "schoolId is required",
      });
    }

    const result = await listParents({ schoolId, isActive, page, limit });

    return res.status(200).json({
      status: "success",
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      count: result.parents.length,
      data: result.parents,
    });
  } catch (err) {
    console.error("Get parents error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error while fetching parents",
    });
  }
}

export async function getStudentsController(req, res) {
  try {
    const { schoolId, classId, sectionId, yearId, status, page, limit } =
      req.query;

    if (!schoolId) {
      return res.status(400).json({
        status: "error",
        message: "schoolId is required",
      });
    }

    const result = await listStudents({
      schoolId,
      classId,
      sectionId,
      yearId,
      status,
      page,
      limit,
    });

    return res.status(200).json({
      status: "success",
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      count: result.students.length,
      data: result.students,
    });
  } catch (err) {
    console.error("Get students error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error while fetching students",
    });
  }
}

export async function getTeachersController(req, res) {
  try {
    const { schoolId, isActive, page, limit } = req.query;

    if (!schoolId) {
      return res.status(400).json({
        status: "error",
        message: "schoolId is required",
      });
    }

    const result = await listTeachers({ schoolId, isActive, page, limit });

    return res.status(200).json({
      status: "success",
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      count: result.teachers.length,
      data: result.teachers,
    });
  } catch (err) {
    console.error("Get teachers error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error while fetching teachers",
    });
  }
}
