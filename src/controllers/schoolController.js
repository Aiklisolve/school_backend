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

export async function getSchoolById(req, res) {
  try {
    const { schoolId } = req.params;

    if (!schoolId || isNaN(Number(schoolId))) {
      return res.status(400).json({
        status: "error",
        message: "Valid schoolId is required in path",
      });
    }

    const sql = `
      SELECT
        school_id,
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
        is_active,
        created_at,
        updated_at
      FROM public.schools
      WHERE school_id = $1;
    `;

    const { rows } = await query(sql, [schoolId]);

    if (!rows.length) {
      return res.status(404).json({
        status: "error",
        message: "School not found",
      });
    }

    return res.status(200).json({
      status: "success",
      data: rows[0],
    });
  } catch (err) {
    console.error("Get school by id error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
}

/**
 * GET /api/schools
 * Optional filters: ?city=&state=&board_type=&is_active=true
 */
export async function listSchools(req, res) {
  try {
    // 🔢 Pagination params
    let page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 10; // default 10

    if (page < 1) page = 1;
    if (limit < 1) limit = 10;

    const offset = (page - 1) * limit;

    const { city, state, board_type, is_active } = req.query;

    const whereClauses = [];
    const filterParams = [];

    // Dynamic filters
    if (city) {
      filterParams.push(city);
      whereClauses.push(`city = $${filterParams.length}`);
    }

    if (state) {
      filterParams.push(state);
      whereClauses.push(`state = $${filterParams.length}`);
    }

    if (board_type) {
      if (!ALLOWED_BOARD_TYPES.includes(board_type)) {
        return res.status(400).json({
          status: "error",
          message: `Invalid board_type. Allowed: ${ALLOWED_BOARD_TYPES.join(
            ", "
          )}`,
        });
      }
      filterParams.push(board_type);
      whereClauses.push(`board_type = $${filterParams.length}`);
    }

    // is_active filter (default = true if not provided)
    let activeFilter = true;
    if (typeof is_active !== "undefined") {
      activeFilter = is_active === "false" ? false : true;
    }
    filterParams.push(activeFilter);
    whereClauses.push(`is_active = $${filterParams.length}`);

    const whereSql =
      whereClauses.length > 0
        ? "WHERE " + whereClauses.join(" AND ")
        : "";

    // 1️⃣ Total count (for pagination metadata)
    const countSql = `
      SELECT COUNT(*) AS total
      FROM public.schools
      ${whereSql};
    `;
    const { rows: countRows } = await query(countSql, filterParams);
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;

    // 2️⃣ Paged data
    const dataSql = `
      SELECT
        school_id,
        school_code,
        school_name,
        city,
        state,
        pincode,
        phone,
        email,
        board_type,
        grading_system,
        is_active,
        created_at
      FROM public.schools
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT $${filterParams.length + 1}
      OFFSET $${filterParams.length + 2};
    `;

    const dataParams = [...filterParams, limit, offset];
    const { rows } = await query(dataSql, dataParams);

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
    console.error("List schools (paginated) error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
}