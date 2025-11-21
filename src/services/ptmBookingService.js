// src/services/ptmBookingService.js
import { query } from "../config/db.js";

const ALLOWED_BOOKING_STATUS = [
  "SCHEDULED",
  "CONFIRMED",
  "RESCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

/**
 * Create PTM booking (parent / admin books a slot)
 * NOTE: DB unique key prevents double-booking same slot
 */
export async function createPtmBooking(payload) {
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
    booking_ip,
  } = payload;

  const insertSql = `
    INSERT INTO public.ptm_bookings (
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
      status,
      booked_by,
      booking_ip
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      'SCHEDULED', $11, $12
    )
    RETURNING
      booking_id,
      ptm_session_id,
      teacher_id,
      student_id,
      parent_id,
      meeting_date,
      meeting_time,
      duration_minutes,
      meeting_purpose,
      status,
      booked_by,
      booking_ip,
      created_at;
  `;

  const params = [
    ptm_session_id,
    teacher_id,
    student_id,
    parent_id,
    meeting_date,
    meeting_time,
    duration_minutes || 15,
    meeting_purpose || null,
    parent_agenda || null,
    teacher_agenda || null,
    booked_by || parent_id,       // default: parent booked themselves
    booking_ip || null,
  ];

  const { rows } = await query(insertSql, params);
  return rows[0];
}

/**
 * List PTM bookings with rich joined data
 */
export async function listPtmBookings({
  sessionId,
  teacherId,
  parentId,
  studentId,
  status,
  page = 1,
  limit = 10,
}) {
  page = parseInt(page, 10) || 1;
  limit = parseInt(limit, 10) || 10;
  if (page < 1) page = 1;
  if (limit < 1) limit = 10;

  const offset = (page - 1) * limit;

  const where = [];
  const params = [];

  if (sessionId) {
    params.push(sessionId);
    where.push(`b.ptm_session_id = $${params.length}`);
  }
  if (teacherId) {
    params.push(teacherId);
    where.push(`b.teacher_id = $${params.length}`);
  }
  if (parentId) {
    params.push(parentId);
    where.push(`b.parent_id = $${params.length}`);
  }
  if (studentId) {
    params.push(studentId);
    where.push(`b.student_id = $${params.length}`);
  }
  if (status && ALLOWED_BOOKING_STATUS.includes(status)) {
    params.push(status);
    where.push(`b.status = $${params.length}`);
  }

  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  // Count
  const countSql = `
    SELECT COUNT(*) AS total
    FROM public.ptm_bookings b
    ${whereSql};
  `;
  const { rows: countRows } = await query(countSql, params);
  const total = Number(countRows[0]?.total || 0);
  const totalPages = Math.ceil(total / limit) || 1;

  // Data with joins: sessions, teacher(user), student, parent, class, year
  const dataSql = `
    SELECT
      b.booking_id,
      b.ptm_session_id,
      b.teacher_id,
      t.full_name AS teacher_name,
      b.student_id,
      st.full_name AS student_name,
      b.parent_id,
      p.full_name AS parent_name,
      p.phone AS parent_phone,
      b.meeting_date,
      b.meeting_time,
      b.duration_minutes,
      b.meeting_purpose,
      b.parent_agenda,
      b.teacher_agenda,
      b.student_performance_summary,
      b.suggested_discussion_points,
      b.academic_highlights,
      b.status,
      b.confirmation_sent_at,
      b.reminder_sent_at,
      b.meeting_notes,
      b.action_items,
      b.follow_up_required,
      b.follow_up_date,
      b.parent_satisfaction_rating,
      b.booked_by,
      b.booking_ip,
      b.created_at,
      s.session_name,
      s.session_date,
      s.start_time,
      s.end_time,
      s.slot_duration_minutes,
      s.school_id,
      sc.school_name,
      s.class_id,
      c.class_name,
      s.year_id,
      ay.year_name
    FROM public.ptm_bookings b
    JOIN public.ptm_sessions s   ON s.session_id = b.ptm_session_id
    JOIN public.schools sc       ON sc.school_id = s.school_id
    LEFT JOIN public.classes c   ON c.class_id = s.class_id
    JOIN public.academic_years ay ON ay.year_id = s.year_id
    JOIN public.users t          ON t.user_id = b.teacher_id     -- teacher user record
    JOIN public.students st      ON st.student_id = b.student_id
    JOIN public.parents p        ON p.parent_id = b.parent_id
    ${whereSql}
    ORDER BY b.meeting_date ASC, b.meeting_time ASC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2};
  `;

  const dataParams = [...params, limit, offset];
  const { rows } = await query(dataSql, dataParams);

  return {
    page,
    limit,
    total,
    totalPages,
    bookings: rows,
  };
}
