// src/controllers/schoolController.js
import validator from "validator";
import { query } from "../config/db.js";

const ALLOWED_BOARD_TYPES = ["CBSE", "ICSE", "STATE_BOARD"];
const ALLOWED_GRADING = ["PERCENTAGE", "GRADE_POINTS", "LETTER_GRADES"];

export async function registerSchool(req, res) {
  try {
    const {
      school_code,
      school_name,
      address_line1,
      address_line2,
      city,
      state,
      pincode,
      phone,
      email,
      website,
      board_type,
      academic_session_start_month,
      grading_system,
      affiliation_number,
      recognition_status,
      rte_compliance
    } = req.body;

    // Required fields
    if (!school_code || !school_name || !address_line1 ||
        !city || !state || !pincode || !board_type) {
      return res.status(400).json({
        status: "error",
        message: "school_code, school_name, address_line1, city, state, pincode, board_type are required"
      });
    }

    // Email validation (optional)
    if (email && !validator.isEmail(email)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid email format"
      });
    }

    // Website validation (optional)
    if (website && !validator.isURL(website)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid website URL"
      });
    }

    // Board type validation
    if (!ALLOWED_BOARD_TYPES.includes(board_type)) {
      return res.status(400).json({
        status: "error",
        message: `Invalid board_type. Allowed: ${ALLOWED_BOARD_TYPES.join(", ")}`
      });
    }

    // Grading system validation
    if (grading_system && !ALLOWED_GRADING.includes(grading_system)) {
      return res.status(400).json({
        status: "error",
        message: `Invalid grading_system. Allowed: ${ALLOWED_GRADING.join(", ")}`
      });
    }

    const insertSql = `
      INSERT INTO public.schools (
        school_code,
        school_name,
        address_line1,
        address_line2,
        city,
        state,
        pincode,
        phone,
        email,
        website,
        board_type,
        academic_session_start_month,
        grading_system,
        affiliation_number,
        recognition_status,
        rte_compliance,
        is_active
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, true
      )
      RETURNING
        school_id, school_code, school_name, city, state,
        board_type, grading_system, is_active, created_at;
    `;

    const params = [
      school_code,
      school_name,
      address_line1,
      address_line2 || null,
      city,
      state,
      pincode,
      phone || null,
      email || null,
      website || null,
      board_type,
      academic_session_start_month || 4,
      grading_system || "PERCENTAGE",
      affiliation_number || null,
      recognition_status || "RECOGNIZED",
      rte_compliance !== undefined ? rte_compliance : true
    ];

    const { rows } = await query(insertSql, params);
    const school = rows[0];

    return res.status(201).json({
      status: "success",
      message: "School registered successfully",
      data: school
    });

  } catch (err) {
    console.error("School registration error:", err);

    // Unique constraint
    if (err.code === "23505" && err.constraint === "schools_school_code_key") {
      return res.status(409).json({
        status: "error",
        message: "School code already exists"
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
}
