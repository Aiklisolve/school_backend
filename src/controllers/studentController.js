import validator from "validator";
import { query } from "../config/db.js";

const ALLOWED_GENDER = ["M", "F", "O"];
const ALLOWED_STATUS = ["ACTIVE", "TRANSFERRED", "GRADUATED", "DROPPED_OUT"];

export async function registerStudent(req, res) {
  try {
    const {
      school_id,
      branch_id,
      admission_number,
      roll_number,
      full_name,
      date_of_birth,          // 'YYYY-MM-DD'
      gender,                 // 'M' | 'F' | 'O'
      blood_group,
      aadhar_number,
      admission_date,         // 'YYYY-MM-DD'
      admission_class,
      current_status,
      address_line1,
      city,
      state,
      pincode,
      medical_conditions,
      emergency_contact_name,
      emergency_contact_phone,
      student_photo_url, user_id
    } = req.body;

    const isYmdDate = (value) =>
      validator.isDate(value, { format: "YYYY-MM-DD", strictMode: true });


    // 1. Required field validation
    if (
      !school_id ||
      !user_id ||
      !admission_number ||
      !full_name ||
      !date_of_birth ||
      !admission_date ||
      !admission_class
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "school_id, admission_number, full_name, date_of_birth, admission_date and admission_class are required",
      });
    }

    // After required field checks

    if (!isYmdDate(date_of_birth)) {
      return res.status(400).json({
        status: "error",
        message: "date_of_birth must be in YYYY-MM-DD format",
      });
    }

    if (!isYmdDate(admission_date)) {
      return res.status(400).json({
        status: "error",
        message: "admission_date must be in YYYY-MM-DD format",
      });
    }

    // 2. Gender validation (optional)
    if (gender && !ALLOWED_GENDER.includes(gender)) {
      return res.status(400).json({
        status: "error",
        message: `Invalid gender. Allowed: ${ALLOWED_GENDER.join(", ")}`,
      });
    }

    // 3. Status validation (optional)
    const finalStatus = current_status || "ACTIVE";
    if (!ALLOWED_STATUS.includes(finalStatus)) {
      return res.status(400).json({
        status: "error",
        message: `Invalid current_status. Allowed: ${ALLOWED_STATUS.join(", ")}`,
      });
    }

    // 4. Emergency contact phone validation (optional)
    if (emergency_contact_phone && !validator.isMobilePhone(emergency_contact_phone, "any")) {
      return res.status(400).json({
        status: "error",
        message: "Invalid emergency_contact_phone number",
      });
    }

    // 5. Basic pincode check (optional)
    if (pincode && !validator.isLength(pincode, { min: 4, max: 10 })) {
      return res.status(400).json({
        status: "error",
        message: "Invalid pincode length",
      });
    }

    const insertSql = `
      INSERT INTO public.students (
        school_id,
        branch_id,
        admission_number,
        roll_number,
        full_name,
        date_of_birth,
        gender,
        blood_group,
        aadhar_number,
        admission_date,
        admission_class,
        current_status,
        address_line1,
        city,
        state,
        pincode,
        medical_conditions,
        emergency_contact_name,
        emergency_contact_phone,
        student_photo_url,
        is_active,
        user_id
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        true, $21
      )
      RETURNING
        student_id,
        school_id,
        branch_id,
        admission_number,
        roll_number,
        full_name,
        date_of_birth,
        gender,
        admission_date,
        admission_class,
        current_status,
        is_active,
        created_at,
        user_id;
    `;

    const params = [
      school_id,
      branch_id || null,
      admission_number,
      roll_number || null,
      full_name,
      date_of_birth,           // expect 'YYYY-MM-DD'
      gender || null,
      blood_group || null,
      aadhar_number || null,
      admission_date,          // expect 'YYYY-MM-DD'
      admission_class,
      finalStatus,
      address_line1 || null,
      city || null,
      state || null,
      pincode || null,
      medical_conditions || null,
      emergency_contact_name || null,
      emergency_contact_phone || null,
      student_photo_url || null,
      user_id,
    ];

    const { rows } = await query(insertSql, params);
    const student = rows[0];

    // helper to ensure we always return "YYYY-MM-DD"
    const toYMD = (v) => {
      if (!v) return null;
      if (typeof v === "string") {
        // handles "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SSZ"
        return v.slice(0, 10);
      }
      if (v instanceof Date) {
        return v.toISOString().slice(0, 10);
      }
      return String(v).slice(0, 10);
    };

    // override the fields in the response to be clean dates
    student.date_of_birth = toYMD(student.date_of_birth || date_of_birth);
    student.admission_date = toYMD(student.admission_date || admission_date);
    student.created_at = toYMD(student.created_at);

    return res.status(201).json({
      status: "success",
      message: "Student registered successfully",
      data: student,
    });
  } catch (err) {
    console.error("Student registration error:", err);

    // Unique constraint: (school_id, admission_number)
    if (err.code === "23505") {
      if (err.constraint === "students_school_id_admission_number_key") {
        return res.status(409).json({
          status: "error",
          message: "Admission number already exists for this school",
        });
      }
      return res.status(409).json({
        status: "error",
        message: "Student already exists (unique constraint)",
      });
    }

    // Foreign key violations for school/branch
    if (err.code === "23503") {
      return res.status(400).json({
        status: "error",
        message: "Invalid school_id or branch_id (foreign key violation)",
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Internal server error during student registration",
    });
  }
}

// src/controllers/studentController.js

/**
 * GET /api/students
 * List all students with pagination and optional filters
 * Query params: page, limit, school_id, branch_id, current_status, is_active
 */
export async function listStudents(req, res) {
  try {
    // Pagination params
    let page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 10;

    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    if (limit > 10000) limit = 10000; // Max limit

    const offset = (page - 1) * limit;

    // Filter params
    const { school_id, branch_id, current_status, is_active } = req.query;

    const whereClauses = [];
    const filterParams = [];

    // Dynamic filters
    if (school_id) {
      filterParams.push(parseInt(school_id));
      whereClauses.push(`s.school_id = $${filterParams.length}`);
    }

    if (branch_id) {
      filterParams.push(parseInt(branch_id));
      whereClauses.push(`s.branch_id = $${filterParams.length}`);
    }

    if (current_status) {
      if (!ALLOWED_STATUS.includes(current_status)) {
        return res.status(400).json({
          status: "error",
          message: `Invalid current_status. Allowed: ${ALLOWED_STATUS.join(", ")}`,
        });
      }
      filterParams.push(current_status);
      whereClauses.push(`s.current_status = $${filterParams.length}`);
    }

    // is_active filter (default = true if not provided)
    let activeFilter = true;
    if (typeof is_active !== "undefined") {
      activeFilter = is_active === "false" ? false : true;
    }
    filterParams.push(activeFilter);
    whereClauses.push(`s.is_active = $${filterParams.length}`);

    const whereSql =
      whereClauses.length > 0
        ? "WHERE " + whereClauses.join(" AND ")
        : "";

    // 1️⃣ Total count (for pagination metadata)
    const countSql = `
      SELECT COUNT(*) AS total
      FROM public.students s
      ${whereSql};
    `;
    const { rows: countRows } = await query(countSql, filterParams);
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;

    // 2️⃣ Paged data with joins
    const dataSql = `
      SELECT 
        s.student_id,
        s.school_id,
        s.branch_id,
        s.admission_number,
        s.roll_number,
        s.full_name,
        s.date_of_birth,
        s.gender,
        s.blood_group,
        s.admission_date,
        s.admission_class,
        s.current_status,
        s.is_active,
        s.created_at,
        s.user_id,

        -- school details
        sch.school_name,
        sch.school_code,
        sch.city        AS school_city,
        sch.state       AS school_state,
        sch.pincode     AS school_pincode,
        sch.board_type,

        -- branch details
        b.branch_name,
        b.branch_code,
        b.city          AS branch_city,
        b.state         AS branch_state,
        b.pincode       AS branch_pincode,
        b.is_main_branch

      FROM public.students s
      JOIN public.schools sch
        ON s.school_id = sch.school_id
      LEFT JOIN public.branches b
        ON s.branch_id = b.branch_id
       AND b.school_id = s.school_id
      ${whereSql}
      ORDER BY s.student_id DESC
      LIMIT $${filterParams.length + 1}
      OFFSET $${filterParams.length + 2};
    `;

    const dataParams = [...filterParams, limit, offset];
    const { rows } = await query(dataSql, dataParams);

    // Clean date formatting
    const toYMD = (v) =>
      v ? (v.toISOString ? v.toISOString().slice(0, 10) : String(v).slice(0, 10)) : null;

    rows.forEach((student) => {
      student.date_of_birth = toYMD(student.date_of_birth);
      student.admission_date = toYMD(student.admission_date);
      student.created_at = toYMD(student.created_at);
    });

    return res.status(200).json({
      status: "success",
      page,
      limit,
      total,
      totalPages,
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error("List students (paginated) error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
}

export async function getStudentsBySchoolId(req, res) {
  try {
    const { school_id } = req.params;

    if (!school_id) {
      return res.status(400).json({
        status: "error",
        message: "school_id is required",
      });
    }

    const sql = `
      SELECT 
        s.student_id,
        s.school_id,
        s.branch_id,
        s.admission_number,
        s.roll_number,
        s.full_name,
        s.date_of_birth,
        s.gender,
        s.blood_group,
        s.admission_date,
        s.admission_class,
        s.current_status,
        s.is_active,
        s.created_at,

        -- school details
        sch.school_name,
        sch.school_code,
        sch.city        AS school_city,
        sch.state       AS school_state,
        sch.pincode     AS school_pincode,
        sch.board_type,

        -- branch details
        b.branch_name,
        b.branch_code,
        b.city          AS branch_city,
        b.state         AS branch_state,
        b.pincode       AS branch_pincode,
        b.is_main_branch

      FROM public.students s
      JOIN public.schools sch
        ON s.school_id = sch.school_id
      LEFT JOIN public.branches b
        ON s.branch_id = b.branch_id
       AND b.school_id = s.school_id
      WHERE s.school_id = $1
      ORDER BY s.student_id DESC;
    `;

    const { rows } = await query(sql, [school_id]);

    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No students found for this school",
      });
    }

    // clean date formatting
    const toYMD = (v) =>
      v ? v.toISOString ? v.toISOString().slice(0, 10) : String(v).slice(0, 10) : null;

    rows.forEach((student) => {
      student.date_of_birth = toYMD(student.date_of_birth);
      student.admission_date = toYMD(student.admission_date);
      student.created_at = toYMD(student.created_at);
    });

    return res.status(200).json({
      status: "success",
      data: rows,
    });

  } catch (err) {
    console.error("Get student list error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
}

export async function getStudentDashboard(req, res) {
  const studentId = Number(req.params.studentId);

  if (!studentId) {
    return res.status(400).json({ message: "Invalid studentId" });
  }

  try {
    // 1) Basic profile + school/branch
    const profileResult = await query(
      `
      SELECT
        s.student_id,
        s.full_name,
        s.admission_number,
        s.roll_number,
        s.gender,
        s.date_of_birth,
        s.admission_class,
        s.current_status,
        s.address_line1,
        s.city,
        s.state,
        s.pincode,
        s.student_photo_url,
        sc.school_id,
        sc.school_name,
        b.branch_id,
        b.branch_name
      FROM public.students s
      JOIN public.schools sc ON sc.school_id = s.school_id
      LEFT JOIN public.branches b ON b.branch_id = s.branch_id
      WHERE s.student_id = $1
      `,
      [studentId]
    );

    if (profileResult.rowCount === 0) {
      return res.status(404).json({ message: "Student not found" });
    }

    const profile = profileResult.rows[0];

    // 2) Current enrollment (active year/class/section)
    const enrollmentResult = await query(
      `
      SELECT
        se.section_id,
        se.year_id,
        se.enrollment_date,
        se.is_active,
        sec.section_name,
        c.class_id,
        c.class_name,
        ay.year_name,
        ay.is_current
      FROM public.student_enrollments se
      JOIN public.sections sec ON sec.section_id = se.section_id
      JOIN public.classes c ON c.class_id = sec.class_id
      JOIN public.academic_years ay ON ay.year_id = se.year_id
      WHERE se.student_id = $1
      ORDER BY ay.start_date DESC
      LIMIT 1
      `,
      [studentId]
    );

    const currentEnrollment = enrollmentResult.rows[0] || null;
    const currentYearId = currentEnrollment?.year_id || null;

    // Fire everything else in parallel for speed
    const [
      attendanceSummaryResult,
      recentAttendanceResult,
      feeAssignmentResult,
      recentReportCardsResult,
      circularsResult,
    ] = await Promise.all([
      // 3) Attendance summary (per month) for current year
      currentYearId
        ? query(
          `
          SELECT
            month,
            total_school_days,
            present_days,
            absent_days,
            late_days,
            half_days,
            attendance_percentage,
            updated_at
          FROM public.attendance_summary
          WHERE student_id = $1 AND year_id = $2
          ORDER BY month
          `,
          [studentId, currentYearId]
        )
        : { rows: [] },

      // 4) Recent attendance records
      query(
        `
        SELECT
          attendance_date,
          status,
          check_in_time,
          check_out_time,
          remarks
        FROM public.attendance
        WHERE student_id = $1
        ORDER BY attendance_date DESC
        LIMIT 30
        `,
        [studentId]
      ),

      // 5) Fee assignment for current year (if any)
      currentYearId
        ? query(
          `
          SELECT
            assignment_id,
            total_fee_amount,
            concession_amount,
            concession_reason
          FROM public.student_fee_assignments
          WHERE student_id = $1 AND year_id = $2
          `,
          [studentId, currentYearId]
        )
        : { rows: [] },

      // 6) Latest report cards
      query(
        `
       SELECT
  rc.report_id,
  rc.year_id,
  ay.year_name,
  rc.term,
  rc.overall_percentage,
  rc.overall_grade,
  rc.class_rank,
  rc.section_rank,
  rc.total_students,
  rc.attendance_percentage,
  rc.status,
  COALESCE(
    json_agg(
      json_build_object(
        'report_card_subject_id', rcs.subject_id,
        'subject_name',           rcs.subject_name,
        'max_marks',              rcs.max_marks,
        'obtained_marks',         rcs.total_marks,
        'grade',                  rcs.grade,
        'teacher_remarks',        rcs.teacher_remarks
      )
      ORDER BY rcs.subject_name
    ) FILTER (WHERE rcs.subject_id IS NOT NULL),
    '[]'::json
  ) AS subjects
FROM public.report_cards rc
JOIN public.academic_years ay
  ON ay.year_id = rc.year_id
LEFT JOIN public.report_card_subjects rcs
  ON rcs.report_id = rc.report_id
WHERE rc.student_id = $1
GROUP BY
  rc.report_id,
  rc.year_id,
  ay.year_name,
  rc.term,
  rc.overall_percentage,
  rc.overall_grade,
  rc.class_rank,
  rc.section_rank,
  rc.total_students,
  rc.attendance_percentage,
  rc.status,
  ay.start_date
ORDER BY ay.start_date DESC, rc.term DESC
LIMIT 3;

        `,
        [studentId]
      ),

      // 7) Recent circulars for this student c.circ
// ular_number,
      query(
        `
        SELECT
          c.circular_id,
          c.title,
          
          c.content,
          c.attachment_url,
          c.target_audience,
          c.created_at,
          cr.status AS delivery_status,
          cr.read_at
        FROM public.circular_recipients cr
        JOIN public.circulars c ON c.circular_id = cr.circular_id
        WHERE cr.student_id = $1
        ORDER BY c.created_at DESC
        LIMIT 10
        `,
        [studentId]
      ),
    ]);

    // 8) Fee summary + upcoming payments
    let feeSummary = null;
    let upcomingPayments = [];

    if (feeAssignmentResult.rows.length > 0) {
      const fa = feeAssignmentResult.rows[0];

      // total paid / balance from fee_payments
      const paymentsAggResult = await query(
        `
        SELECT
          COALESCE(SUM(amount_paid + late_fee_paid), 0) AS total_paid,
          COALESCE(SUM(balance_amount + late_fee_applicable - late_fee_paid), 0) AS total_balance
        FROM public.fee_payments
        WHERE fee_assignment_id = $1
        `,
        [fa.assignment_id]
      );

      const paymentsAgg = paymentsAggResult.rows[0];

      // upcoming / pending installments
      const upcomingResult = await query(
        `
        SELECT
          payment_id,
          installment_number,
          amount_due,
          amount_paid,
          balance_amount,
          late_fee_applicable,
          due_date,
          payment_date,
          payment_mode,
          status
        FROM public.fee_payments
        WHERE fee_assignment_id = $1
          AND status <> 'PAID'
        ORDER BY due_date
        `,
        [fa.assignment_id]
      );

      feeSummary = {
        assignment_id: fa.assignment_id,
        total_fee_amount: fa.total_fee_amount,
        concession_amount: fa.concession_amount,
        concession_reason: fa.concession_reason,
        total_paid: Number(paymentsAgg.total_paid || 0),
        total_balance: Number(paymentsAgg.total_balance || 0),
      };

      upcomingPayments = upcomingResult.rows;
    }

    return res.json({
      profile,
      currentEnrollment,
      attendanceSummary: attendanceSummaryResult.rows,
      recentAttendance: recentAttendanceResult.rows,
      feeSummary,
      upcomingPayments,
      recentReportCards: recentReportCardsResult.rows,
      recentCirculars: circularsResult.rows,
    });
  } catch (err) {
    console.error("getStudentDashboard error:", err);
    return res.status(500).json({
      message: "Error fetching student dashboard",
      error: err.message,
    });
  }
}