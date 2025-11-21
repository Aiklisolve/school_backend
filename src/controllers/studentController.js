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
      student_photo_url
    } = req.body;

    const isYmdDate = (value) =>
      validator.isDate(value, { format: "YYYY-MM-DD", strictMode: true });


    // 1. Required field validation
    if (
      !school_id ||
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
        is_active
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        true
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
        created_at;
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
