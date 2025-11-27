// src/controllers/teacherDashboardController.js
import { query } from "../config/db.js";

export async function getTeacherDashboard(req, res) {
  const teacherId = Number(req.params.teacherId);

  if (!teacherId) {
    return res.status(400).json({ message: "Invalid teacherId" });
  }

  try {
    // 1) Teacher profile (assuming users table)
    const profileResult = await query(
      `
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.phone,
        u.role,
        u.designation,
        u.employee_id,
        u.school_id,
        u.branch_id
      FROM public.users u
      WHERE u.user_id = $1
        AND u.role = 'TEACHER'
      `,
      [teacherId]
    );

    if (profileResult.rowCount === 0) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const profile = profileResult.rows[0];

    // 2) Current assignments (class/section/year)
    const assignmentsResult = await query(
      `
      SELECT
        ta.section_id,
        ta.year_id,
        ta.is_class_teacher,
        sec.section_name,
        c.class_id,
        c.class_name,
        ay.year_name,
        ay.is_current
      FROM public.teacher_assignments ta
      JOIN public.sections sec ON sec.section_id = ta.section_id
      JOIN public.classes c ON c.class_id = sec.class_id
      JOIN public.academic_years ay ON ay.year_id = ta.year_id
      WHERE ta.teacher_id = $1
      ORDER BY ay.start_date DESC, c.class_order, sec.section_name
      `,
      [teacherId]
    );

    const currentAssignments = assignmentsResult.rows;

    // 3) Stats & other widgets in parallel
    const [
      totalStudentsResult,
      recentAttendanceMarkedResult,
      upcomingPtmsResult,
      teacherCircularsResult,
    ] = await Promise.all([
      // Total students across all their sections
      query(
        `
        SELECT
          COUNT(DISTINCT se.student_id) AS total_students
        FROM public.teacher_assignments ta
        JOIN public.student_enrollments se
          ON se.section_id = ta.section_id
         AND se.year_id = ta.year_id
        WHERE ta.teacher_id = $1
        `,
        [teacherId]
      ),

      // Recently marked attendance
      query(
        `
        SELECT
          a.attendance_date,
          a.section_id,
          sec.section_name,
          c.class_name,
          COUNT(*) FILTER (WHERE a.status = 'PRESENT') AS present_count,
          COUNT(*) FILTER (WHERE a.status = 'ABSENT')  AS absent_count,
          COUNT(*) FILTER (WHERE a.status = 'LATE')    AS late_count
        FROM public.attendance a
        JOIN public.sections sec ON sec.section_id = a.section_id
        JOIN public.classes c ON c.class_id = sec.class_id
        WHERE a.marked_by = $1
        GROUP BY a.attendance_date, a.section_id, sec.section_name, c.class_name
        ORDER BY a.attendance_date DESC
        LIMIT 7
        `,
        [teacherId]
      ),

      // Upcoming PTM sessions where this teacher is available
      query(
        `
        SELECT
          ps.session_id,
          ps.session_name,
          ps.session_date,
          ps.start_time,
          ps.end_time,
          ay.year_name,
          c.class_name,
          t_av.available_start_time,
          t_av.available_end_time,
          t_av.current_bookings,
          t_av.max_bookings
        FROM public.ptm_teacher_availability t_av
        JOIN public.ptm_sessions ps ON ps.session_id = t_av.ptm_session_id
        JOIN public.academic_years ay ON ay.year_id = ps.year_id
        LEFT JOIN public.classes c ON c.class_id = ps.class_id
        WHERE t_av.teacher_id = $1
          AND ps.session_date >= CURRENT_DATE
          AND t_av.is_available = true
        ORDER BY ps.session_date, ps.start_time
        LIMIT 5
        `,
        [teacherId]
      ),

      // Circulars targeted to TEACHER / ALL for this teacher's school
      query(
        `
        SELECT
          c.circular_id,
          c.title,
          c.circular_number,
          c.content,
          c.attachment_url,
          c.target_audience,
          c.created_at
        FROM public.circulars c
        WHERE c.school_id = $1
          AND c.target_audience IN ('TEACHER', 'ALL')
        ORDER BY c.created_at DESC
        LIMIT 10
        `,
        [profile.school_id]
      ),
    ]);

    const stats = {
      totalSections: currentAssignments.length,
      totalStudents:
        Number(totalStudentsResult.rows[0]?.total_students || 0),
    };

    return res.json({
      profile,
      currentAssignments,
      stats,
      recentAttendanceMarked: recentAttendanceMarkedResult.rows,
      upcomingPtms: upcomingPtmsResult.rows,
      recentCirculars: teacherCircularsResult.rows,
    });
  } catch (err) {
    console.error("getTeacherDashboard error:", err);
    return res.status(500).json({
      message: "Error fetching teacher dashboard",
      error: err.message,
    });
  }
}
