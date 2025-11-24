// src/services/masterDataService.js
import { query } from "../config/db.js";

/**
 * Generic pagination helper
 */
function normalizePagination(page, limit) {
  let p = parseInt(page, 10) || 1;
  let l = parseInt(limit, 10) || 10;
  if (p < 1) p = 1;
  if (l < 1) l = 10;
  return { page: p, limit: l, offset: (p - 1) * l };
}

/**
 * CLASSES
 * GET /api/master/classes?schoolId=1&isActive=true&page=1&limit=20
 */
export async function listClasses({ schoolId, isActive, page, limit }) {
  const { page: p, limit: l, offset } = normalizePagination(page, limit);

  const where = [];
  const params = [];

  if (schoolId) {
    params.push(schoolId);
    where.push(`c.school_id = $${params.length}`);
  }
  if (isActive !== undefined) {
    const activeFlag = isActive === "false" ? false : true;
    params.push(activeFlag);
    where.push(`c.is_active = $${params.length}`);
  }

  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  const countSql = `
    SELECT COUNT(*) AS total
    FROM public.classes c
    ${whereSql};
  `;
  const { rows: countRows } = await query(countSql, params);
  const total = Number(countRows[0]?.total || 0);
  const totalPages = Math.ceil(total / l) || 1;

  const dataSql = `
    SELECT
      c.class_id,
      c.school_id,
      c.class_name,
      c.class_order,
      c.class_category,
      c.subjects,
      c.passing_percentage,
      c.max_students_per_section,
      c.is_active,
      c.created_at
    FROM public.classes c
    ${whereSql}
    ORDER BY c.class_order ASC, c.class_name ASC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2};
  `;
  const { rows } = await query(dataSql, [...params, l, offset]);

  return { page: p, limit: l, total, totalPages, classes: rows };
}

/**
 * SECTIONS
 * GET /api/master/sections?schoolId=1&classId=2&yearId=1&branchId=1&isActive=true
 */
export async function listSections({
  schoolId,
  classId,
  yearId,
  branchId,
  isActive,
  page,
  limit,
}) {
  const { page: p, limit: l, offset } = normalizePagination(page, limit);

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
  if (branchId) {
    params.push(branchId);
    where.push(`s.branch_id = $${params.length}`);
  }
  if (isActive !== undefined) {
    const activeFlag = isActive === "false" ? false : true;
    params.push(activeFlag);
    where.push(`s.is_active = $${params.length}`);
  }

  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  const countSql = `
    SELECT COUNT(*) AS total
    FROM public.sections s
    ${whereSql};
  `;
  const { rows: countRows } = await query(countSql, params);
  const total = Number(countRows[0]?.total || 0);
  const totalPages = Math.ceil(total / l) || 1;

  const dataSql = `
    SELECT
      s.section_id,
      s.school_id,
      s.branch_id,
      s.class_id,
      c.class_name,
      s.year_id,
      ay.year_name,
      s.section_name,
      s.class_teacher_id,
      ct.full_name AS class_teacher_name,
      s.max_students,
      s.current_students,
      s.is_active,
      s.created_at
    FROM public.sections s
    JOIN public.classes c       ON c.class_id = s.class_id
    JOIN public.academic_years ay ON ay.year_id = s.year_id
    LEFT JOIN public.users ct   ON ct.user_id = s.class_teacher_id
    ${whereSql}
    ORDER BY c.class_order ASC, c.class_name ASC, s.section_name ASC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2};
  `;
  const { rows } = await query(dataSql, [...params, l, offset]);

  return { page: p, limit: l, total, totalPages, sections: rows };
}

/**
 * PARENTS
 * GET /api/master/parents?schoolId=1&isActive=true&page=1&limit=10
 */
export async function listParents({ schoolId, isActive, page, limit }) {
  const { page: p, limit: l, offset } = normalizePagination(page, limit);

  const where = [];
  const params = [];

  if (schoolId) {
    params.push(schoolId);
    where.push(`p.school_id = $${params.length}`);
  }
  if (isActive !== undefined) {
    const activeFlag = isActive === "false" ? false : true;
    params.push(activeFlag);
    where.push(`p.is_active = $${params.length}`);
  }

  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  const countSql = `
    SELECT COUNT(*) AS total
    FROM public.parents p
    ${whereSql};
  `;
  const { rows: countRows } = await query(countSql, params);
  const total = Number(countRows[0]?.total || 0);
  const totalPages = Math.ceil(total / l) || 1;

  const dataSql = `
    SELECT
      p.parent_id,
      p.school_id,
      p.full_name,
      p.phone,
      p.whatsapp_number,
      p.email,
      p.occupation,
      p.annual_income_range,
      p.education_level,
      p.city,
      p.state,
      p.pincode,
      p.is_active,
      p.created_at,
      p.updated_at
    FROM public.parents p
    ${whereSql}
    ORDER BY p.full_name ASC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2};
  `;
  const { rows } = await query(dataSql, [...params, l, offset]);

  return { page: p, limit: l, total, totalPages, parents: rows };
}

/**
 * STUDENTS
 * GET /api/master/students?schoolId=1&classId=2&sectionId=3&yearId=1&status=ACTIVE
 */
export async function listStudents({
  schoolId,
  classId,
  sectionId,
  yearId,
  status,
  page,
  limit,
}) {
  const { page: p, limit: l, offset } = normalizePagination(page, limit);

  const where = [];
  const params = [];

  if (schoolId) {
    params.push(schoolId);
    where.push(`st.school_id = $${params.length}`);
  }
  if (classId) {
    // via sections table
    params.push(classId);
    where.push(`sec.class_id = $${params.length}`);
  }
  if (sectionId) {
    params.push(sectionId);
    where.push(`sec.section_id = $${params.length}`);
  }
  if (yearId) {
    params.push(yearId);
    where.push(`sec.year_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`st.current_status = $${params.length}`);
  }

  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  const countSql = `
    SELECT COUNT(*) AS total
    FROM public.students st
    LEFT JOIN public.sections sec ON sec.school_id = st.school_id
                                  AND sec.class_id = sec.class_id
    ${whereSql};
  `;
  // NOTE: The join for count can be simplified (or you can just count from students only using schoolId/status)

  const { rows: countRows } = await query(countSql, params);
  const total = Number(countRows[0]?.total || 0);
  const totalPages = Math.ceil(total / l) || 1;

  const dataSql = `
    SELECT
      st.student_id,
      st.school_id,
      st.branch_id,
      st.admission_number,
      st.roll_number,
      st.full_name,
      st.date_of_birth,
      st.gender,
      st.blood_group,
      st.aadhar_number,
      st.admission_date,
      st.admission_class,
      st.current_status,
      st.address_line1,
      st.city,
      st.state,
      st.pincode,
      st.medical_conditions,
      st.emergency_contact_name,
      st.emergency_contact_phone,
      st.student_photo_url,
      st.is_active,
      st.created_at,
      st.updated_at,
      sec.section_id,
      sec.section_name,
      sec.year_id,
      ay.year_name,
      c.class_id,
      c.class_name
    FROM public.students st
    LEFT JOIN public.sections sec
      ON sec.school_id = st.school_id
     AND sec.branch_id = st.branch_id
    LEFT JOIN public.academic_years ay
      ON ay.year_id = sec.year_id
    LEFT JOIN public.classes c
      ON c.class_id = sec.class_id
    ${whereSql}
    ORDER BY st.full_name ASC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2};
  `;
  const { rows } = await query(dataSql, [...params, l, offset]);

  return { page: p, limit: l, total, totalPages, students: rows };
}

/**
 * TEACHERS (from users table)
 * GET /api/master/teachers?schoolId=1&isActive=true&page=1&limit=10
 */
export async function listTeachers({ schoolId, isActive, page, limit }) {
  const { page: p, limit: l, offset } = normalizePagination(page, limit);

  const where = [`u.role = 'TEACHER'`];
  const params = [];

  if (schoolId) {
    params.push(schoolId);
    where.push(`u.school_id = $${params.length}`);
  }
  if (isActive !== undefined) {
    const activeFlag = isActive === "false" ? false : true;
    params.push(activeFlag);
    where.push(`u.is_active = $${params.length}`);
  }

  const whereSql = "WHERE " + where.join(" AND ");

  const countSql = `
    SELECT COUNT(*) AS total
    FROM public.users u
    ${whereSql};
  `;
  const { rows: countRows } = await query(countSql, params);
  const total = Number(countRows[0]?.total || 0);
  const totalPages = Math.ceil(total / l) || 1;

  const dataSql = `
    SELECT
      u.user_id,
      u.school_id,
      u.full_name,
      u.email,
      u.phone,
      u.role,
      u.employee_id,
      u.designation,
      u.is_active,
      u.created_at,
      u.updated_at
    FROM public.users u
    ${whereSql}
    ORDER BY u.full_name ASC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2};
  `;
  const { rows } = await query(dataSql, [...params, l, offset]);

  return { page: p, limit: l, total, totalPages, teachers: rows };
}
