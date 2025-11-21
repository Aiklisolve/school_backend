// src/services/branchService.js
import { query } from "../config/db.js";

/**
 * Create a new branch for a school
 */
export async function createBranch({
  school_id,
  branch_code,
  branch_name,
  address_line1,
  city,
  state,
  pincode,
  phone,
  is_main_branch,
  max_students,
}) {
  const sql = `
    INSERT INTO public.branches (
      school_id,
      branch_code,
      branch_name,
      address_line1,
      city,
      state,
      pincode,
      phone,
      is_main_branch,
      max_students
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, COALESCE($9, false),
      COALESCE($10, 1000)
    )
    RETURNING
      branch_id,
      school_id,
      branch_code,
      branch_name,
      address_line1,
      city,
      state,
      pincode,
      phone,
      is_main_branch,
      max_students,
      current_students,
      is_active,
      created_at;
  `;

  const params = [
    school_id,
    branch_code,
    branch_name,
    address_line1,
    city,
    state,
    pincode,
    phone || null,
    is_main_branch,
    max_students,
  ];

  const { rows } = await query(sql, params);
  return rows[0];
}

/**
 * Get a single branch by ID
 */
export async function getBranchById(branchId) {
  const sql = `
    SELECT
      branch_id,
      school_id,
      branch_code,
      branch_name,
      address_line1,
      city,
      state,
      pincode,
      phone,
      is_main_branch,
      max_students,
      current_students,
      is_active,
      created_at
    FROM public.branches
    WHERE branch_id = $1;
  `;

  const { rows } = await query(sql, [branchId]);
  return rows[0] || null;
}

/**
 * List branches for a given school (optionally filter active)
 */
export async function listBranchesBySchool(
  schoolId,
  onlyActive = true,
  page = 1,
  limit = 10
) {
  page = parseInt(page, 10) || 1;
  limit = parseInt(limit, 10) || 10;
  if (page < 1) page = 1;
  if (limit < 1) limit = 10;

  const offset = (page - 1) * limit;

  const whereClauses = ["school_id = $1"];
  const params = [schoolId];

  if (onlyActive) {
    whereClauses.push("is_active = true");
  }

  const whereSql = "WHERE " + whereClauses.join(" AND ");

  // 1️⃣ total count for pagination metadata
  const countSql = `
    SELECT COUNT(*) AS total
    FROM public.branches
    ${whereSql};
  `;
  const { rows: countRows } = await query(countSql, params);
  const total = Number(countRows[0]?.total || 0);
  const totalPages = Math.ceil(total / limit) || 1;

  // 2️⃣ paged data
  const dataSql = `
    SELECT
      branch_id,
      school_id,
      branch_code,
      branch_name,
      address_line1,
      city,
      state,
      pincode,
      phone,
      is_main_branch,
      max_students,
      current_students,
      is_active,
      created_at
    FROM public.branches
    ${whereSql}
    ORDER BY created_at DESC
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
    branches: rows,
  };
}

/**
 * Update branch basic info
 */
export async function updateBranch(branchId, updates) {
  const {
    branch_name,
    address_line1,
    city,
    state,
    pincode,
    phone,
    is_main_branch,
    max_students,
    is_active,
  } = updates;

  const sql = `
    UPDATE public.branches
    SET
      branch_name    = COALESCE($2, branch_name),
      address_line1  = COALESCE($3, address_line1),
      city           = COALESCE($4, city),
      state          = COALESCE($5, state),
      pincode        = COALESCE($6, pincode),
      phone          = COALESCE($7, phone),
      is_main_branch = COALESCE($8, is_main_branch),
      max_students   = COALESCE($9, max_students),
      is_active      = COALESCE($10, is_active)
    WHERE branch_id = $1
    RETURNING
      branch_id,
      school_id,
      branch_code,
      branch_name,
      address_line1,
      city,
      state,
      pincode,
      phone,
      is_main_branch,
      max_students,
      current_students,
      is_active,
      created_at;
  `;

  const params = [
    branchId,
    branch_name ?? null,
    address_line1 ?? null,
    city ?? null,
    state ?? null,
    pincode ?? null,
    phone ?? null,
    is_main_branch ?? null,
    max_students ?? null,
    is_active ?? null,
  ];

  const { rows } = await query(sql, params);
  return rows[0] || null;
}

/**
 * Soft delete / deactivate branch
 */
export async function deactivateBranch(branchId) {
  const sql = `
    UPDATE public.branches
    SET is_active = false
    WHERE branch_id = $1
    RETURNING branch_id, school_id, branch_name, is_active;
  `;

  const { rows } = await query(sql, [branchId]);
  return rows[0] || null;
}

export async function listAllBranches(options = {}) {
  let { page = 1, limit = 10, onlyActive = true, schoolId } = options;

  page = parseInt(page, 10) || 1;
  limit = parseInt(limit, 10) || 10;
  if (page < 1) page = 1;
  if (limit < 1) limit = 10;

  const offset = (page - 1) * limit;

  const whereClauses = [];
  const params = [];

  if (schoolId) {
    params.push(schoolId);
    whereClauses.push(`school_id = $${params.length}`);
  }

  if (onlyActive) {
    params.push(true);
    whereClauses.push(`is_active = $${params.length}`);
  }

  const whereSql =
    whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

  // 1️⃣ total count
  const countSql = `
    SELECT COUNT(*) AS total
    FROM public.branches
    ${whereSql};
  `;
  const { rows: countRows } = await query(countSql, params);
  const total = Number(countRows[0]?.total || 0);
  const totalPages = Math.ceil(total / limit) || 1;

  // 2️⃣ paged data
  const dataSql = `
    SELECT
      branch_id,
      school_id,
      branch_code,
      branch_name,
      address_line1,
      city,
      state,
      pincode,
      phone,
      is_main_branch,
      max_students,
      current_students,
      is_active,
      created_at
    FROM public.branches
    ${whereSql}
    ORDER BY created_at DESC
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
    branches: rows,
  };
}