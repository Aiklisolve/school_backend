// src/controllers/ptmBookingController.js
import { createPtmBooking, listPtmBookings } from "../services/ptmBookingService.js";

export async function createPtmBookingController(req, res) {
  try {
    const {
      ptm_session_id,
      teacher_id,
      student_id,
      parent_id,
      meeting_date,
      meeting_time,
      duration_minutes,
      meeting_purpose,
      parent_agenda,
      teacher_agenda,
      booked_by,
    } = req.body;

    if (
      !ptm_session_id ||
      !teacher_id ||
      !student_id ||
      !parent_id ||
      !meeting_date ||
      !meeting_time
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "ptm_session_id, teacher_id, student_id, parent_id, meeting_date, meeting_time are required",
      });
    }

    // IP from request (Express sets req.ip)
    const booking_ip = req.ip || req.connection?.remoteAddress || null;

    try {
      const booking = await createPtmBooking({
        ptm_session_id,
        teacher_id,
        student_id,
        parent_id,
        meeting_date,
        meeting_time,
        duration_minutes,
        meeting_purpose,
        parent_agenda,
        teacher_agenda,
        booked_by,
        booking_ip,
      });

      return res.status(201).json({
        status: "success",
        message: "PTM booking created successfully",
        data: booking,
      });
    } catch (err) {
      // Handle unique constraint: same teacher + session + slot
      if (
        err.code === "23505" &&
        err.constraint ===
          "ptm_bookings_ptm_session_id_teacher_id_meeting_date_meeting_key"
      ) {
        return res.status(409).json({
          status: "error",
          message:
            "This time slot is already booked for this teacher in this PTM session",
        });
      }

      throw err;
    }
  } catch (err) {
    console.error("Create PTM booking error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error while creating PTM booking",
    });
  }
}

export async function listPtmBookingsController(req, res) {
  try {
    const { sessionId, teacherId, parentId, studentId, status, page, limit } =
      req.query;

    const result = await listPtmBookings({
      sessionId,
      teacherId,
      parentId,
      studentId,
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
      count: result.bookings.length,
      data: result.bookings,
    });
  } catch (err) {
    console.error("List PTM bookings error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error while listing PTM bookings",
    });
  }
}
