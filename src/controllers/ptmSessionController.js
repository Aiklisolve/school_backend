// src/controllers/ptmSessionController.js
import { createPtmSession, listPtmSessions } from "../services/ptmSessionService.js";

export async function createPtmSessionController(req, res) {
  try {
    const {
      school_id,
      class_id,
      year_id,
      session_name,
      session_description,
      session_date,
      start_time,
      end_time,
      slot_duration_minutes,
      break_duration_minutes,
      booking_opens_at,
      booking_closes_at,
      max_bookings_per_teacher,
      status,
      created_by,
    } = req.body;

    // basic required fields check
    if (
      !school_id ||
      !year_id ||
      !session_name ||
      !session_date ||
      !start_time ||
      !end_time ||
      !booking_opens_at ||
      !booking_closes_at ||
      !created_by
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "school_id, year_id, session_name, session_date, start_time, end_time, booking_opens_at, booking_closes_at, created_by are required",
      });
    }

    const session = await createPtmSession({
      school_id,
      class_id,
      year_id,
      session_name,
      session_description,
      session_date,
      start_time,
      end_time,
      slot_duration_minutes,
      break_duration_minutes,
      booking_opens_at,
      booking_closes_at,
      max_bookings_per_teacher,
      status,
      created_by,
    });

    return res.status(201).json({
      status: "success",
      message: "PTM session created successfully",
      data: session,
    });
  } catch (err) {
    console.error("Create PTM session error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error while creating PTM session",
    });
  }
}

export async function listPtmSessionsController(req, res) {
  try {
    const { schoolId, classId, yearId, status, page, limit } = req.query;

    const result = await listPtmSessions({
      schoolId,
      classId,
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
      count: result.sessions.length,
      data: result.sessions,
    });
  } catch (err) {
    console.error("List PTM sessions error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error while listing PTM sessions",
    });
  }
}

import {
  listSessionsForTeacher,
  listSessionsForParent,
  listSessionsForStudent,
} from "../services/ptmSessionService.js";

export async function getSessionsByTeacherController(req, res) {
  try {
    const { teacherId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const sessions = await listSessionsForTeacher(teacherId, page, limit);

    return res.status(200).json({
      status: "success",
      count: sessions.length,
      data: sessions,
    });
  } catch (err) {
    console.error("Teacher sessions error:", err);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
}

export async function getSessionsByParentController(req, res) {
  try {
    const { parentId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const sessions = await listSessionsForParent(parentId, page, limit);

    return res.status(200).json({
      status: "success",
      count: sessions.length,
      data: sessions,
    });
  } catch (err) {
    console.error("Parent sessions error:", err);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
}

export async function getSessionsByStudentController(req, res) {
  try {
    const { studentId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const sessions = await listSessionsForStudent(studentId, page, limit);

    return res.status(200).json({
      status: "success",
      count: sessions.length,
      data: sessions,
    });
  } catch (err) {
    console.error("Student sessions error:", err);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
}
