// src/services/ptmSessionService.js
import { query } from "../config/db.js";

const ALLOWED_STATUS = ["SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"];

/**
 * Create a PTM session
 */
export async function createPtmSession(payload) {
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
  } = payload;

  const insertSql = `
    INSERT INTO public.ptm_sessions (
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
      created_by
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15
    )
    RETURNING
      session_id,
      school_id,
      class_id,
      year_id,
      session_name,
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
      created_at;
  `;

  const params = [
    school_id,
    class_id || null,
    year_id,
    session_name,
    session_description || null,
    session_date,
    start_time,
    end_time,
    slot_duration_minutes || 15,
    break_duration_minutes || 5,
    booking_opens_at,
    booking_closes_at,
    max_bookings_per_teacher || 25,
    status && ALLOWED_STATUS.includes(status) ? status : "SCHEDULED",
    created_by,
  ];

  const { rows } = await query(insertSql, params);
  return rows[0];
}

/**
 * List PTM sessions with filters + pagination
 */
export async function listPtmSessions({
  schoolId,
  classId,
  yearId,
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

  if (schoolId) {
    params.push(schoolId);
    where.push(`s.school_id = $${params.length}`);
  }
  if (classId) {
    params.push(classId);
    where.push(`s.class_id = $${params.length}`);
  }
  if (yearId) {
    params.push(yearId);
    where.push(`s.year_id = $${params.length}`);
  }
  if (status && ALLOWED_STATUS.includes(status)) {
    params.push(status);
    where.push(`s.status = $${params.length}`);
  }

  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  // Count for pagination
  const countSql = `
    SELECT COUNT(*) AS total
    FROM public.ptm_sessions s
    ${whereSql};
  `;
  const { rows: countRows } = await query(countSql, params);
  const total = Number(countRows[0]?.total || 0);
  const totalPages = Math.ceil(total / limit) || 1;

  // Data with joins to related tables
  const dataSql = `
    SELECT
      s.session_id,
      s.school_id,
      sc.school_name,
      s.class_id,
      c.class_name,
      s.year_id,
      ay.year_name,
      s.session_name,
      s.session_description,
      s.session_date,
      s.start_time,
      s.end_time,
      s.slot_duration_minutes,
      s.break_duration_minutes,
      s.booking_opens_at,
      s.booking_closes_at,
      s.max_bookings_per_teacher,
      s.status,
      s.created_by,
      u.full_name AS created_by_name,
      s.created_at
    FROM public.ptm_sessions s
    JOIN public.schools sc ON sc.school_id = s.school_id
    LEFT JOIN public.classes c ON c.class_id = s.class_id
    JOIN public.academic_years ay ON ay.year_id = s.year_id
    JOIN public.users u ON u.user_id = s.created_by
    ${whereSql}
    ORDER BY s.session_date DESC, s.start_time ASC
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
    sessions: rows,
  };
}
