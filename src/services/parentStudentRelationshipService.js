// src/services/parentStudentRelationshipService.js
import { query } from "../config/db.js";

const ALLOWED_REL_TYPES = [
  "FATHER",
  "MOTHER",
  "GUARDIAN",
  "UNCLE",
  "AUNT",
  "GRANDFATHER",
  "GRANDMOTHER",
];

/**
 * Create a parent-student relationship
 */
export async function createRelationship({
  parent_id,
  student_id,
  relationship_type,
  is_primary_contact = false,
  is_fee_responsible = false,
  is_emergency_contact = false,
}) {
  if (!ALLOWED_REL_TYPES.includes(relationship_type)) {
    throw new Error("invalid_relationship_type");
  }

  const sql = `
    INSERT INTO public.parent_student_relationships (
      parent_id,
      student_id,
      relationship_type,
      is_primary_contact,
      is_fee_responsible,
      is_emergency_contact
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;

  try {
    const { rows } = await query(sql, [
      parent_id,
      student_id,
      relationship_type,
      is_primary_contact,
      is_fee_responsible,
      is_emergency_contact,
    ]);
    return rows[0];
  } catch (err) {
    // UNIQUE (parent_id, student_id, relationship_type)
    if (err.code === "23505" && err.constraint === "parent_student_relationships_parent_id_student_id_relations_key") {
      const e = new Error("relationship_already_exists");
      e.code = "relationship_already_exists";
      throw e;
    }

    // EXCLUDE constraint single_primary_contact_per_student
    if (err.code === "23P01" && err.constraint === "single_primary_contact_per_student") {
      const e = new Error("primary_contact_already_exists");
      e.code = "primary_contact_already_exists";
      throw e;
    }

    throw err;
  }
}

/**
 * Get all relationships, optional filters + pagination
 */
export async function listRelationships({
  parent_id,
  student_id,
  relationship_type,
  page = 1,
  pageSize = 20,
}) {
  const offset = (page - 1) * pageSize;

  const where = [];
  const params = [];
  let idx = 1;

  if (parent_id) {
    where.push(`parent_id = $${idx++}`);
    params.push(parent_id);
  }
  if (student_id) {
    where.push(`student_id = $${idx++}`);
    params.push(student_id);
  }
  if (relationship_type) {
    where.push(`relationship_type = $${idx++}`);
    params.push(relationship_type);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      r.relationship_id,
      r.parent_id,
      p.full_name AS parent_name,
      r.student_id,
      s.full_name AS student_name,
      r.relationship_type,
      r.is_primary_contact,
      r.is_fee_responsible,
      r.is_emergency_contact,
      r.created_at
    FROM public.parent_student_relationships r
    JOIN public.parents p ON p.parent_id = r.parent_id
    JOIN public.students s ON s.student_id = r.student_id
    ${whereClause}
    ORDER BY r.created_at DESC
    LIMIT $${idx++} OFFSET $${idx++};
  `;

  params.push(pageSize, offset);

  const { rows } = await query(sql, params);
  return rows;
}

/**
 * Get relationships by student
 */
export async function getRelationshipsByStudent(studentId) {
  const sql = `
    SELECT
      r.relationship_id,
      r.parent_id,
      p.full_name AS parent_name,
      p.phone AS parent_phone,
      p.email AS parent_email,
      r.relationship_type,
      r.is_primary_contact,
      r.is_fee_responsible,
      r.is_emergency_contact,
      r.created_at
    FROM public.parent_student_relationships r
    JOIN public.parents p ON p.parent_id = r.parent_id
    WHERE r.student_id = $1
    ORDER BY r.is_primary_contact DESC, r.created_at ASC;
  `;

  const { rows } = await query(sql, [studentId]);
  return rows;
}

/**
 * Get relationships by parent
 */
export async function getRelationshipsByParent(parentId) {
  const sql = `
    SELECT
      r.relationship_id,
      r.student_id,
      s.full_name AS student_name,
      s.admission_number,
      s.current_status,
      r.relationship_type,
      r.is_primary_contact,
      r.is_fee_responsible,
      r.is_emergency_contact,
      r.created_at
    FROM public.parent_student_relationships r
    JOIN public.students s ON s.student_id = r.student_id
    WHERE r.parent_id = $1
    ORDER BY r.created_at DESC;
  `;

  const { rows } = await query(sql, [parentId]);
  return rows;
}

/**
 * Update flags or relationship_type
 */
export async function updateRelationship(relationshipId, fields) {
  const {
    relationship_type,
    is_primary_contact,
    is_fee_responsible,
    is_emergency_contact,
  } = fields;

  const sets = [];
  const params = [];
  let idx = 1;

  if (relationship_type) {
    if (!ALLOWED_REL_TYPES.includes(relationship_type)) {
      throw new Error("invalid_relationship_type");
    }
    sets.push(`relationship_type = $${idx++}`);
    params.push(relationship_type);
  }

  if (typeof is_primary_contact === "boolean") {
    sets.push(`is_primary_contact = $${idx++}`);
    params.push(is_primary_contact);
  }

  if (typeof is_fee_responsible === "boolean") {
    sets.push(`is_fee_responsible = $${idx++}`);
    params.push(is_fee_responsible);
  }

  if (typeof is_emergency_contact === "boolean") {
    sets.push(`is_emergency_contact = $${idx++}`);
    params.push(is_emergency_contact);
  }

  if (!sets.length) {
    throw new Error("no_fields_to_update");
  }

  const sql = `
    UPDATE public.parent_student_relationships
    SET ${sets.join(", ")}
    WHERE relationship_id = $${idx}
    RETURNING *;
  `;
  params.push(relationshipId);

  try {
    const { rows } = await query(sql, params);
    if (!rows.length) return null;
    return rows[0];
  } catch (err) {
    if (err.code === "23P01" && err.constraint === "single_primary_contact_per_student") {
      const e = new Error("primary_contact_already_exists");
      e.code = "primary_contact_already_exists";
      throw e;
    }
    throw err;
  }
}

/**
 * Delete relationship (hard delete)
 */
export async function deleteRelationship(relationshipId) {
  const sql = `
    DELETE FROM public.parent_student_relationships
    WHERE relationship_id = $1;
  `;
  const { rowCount } = await query(sql, [relationshipId]);
  return rowCount > 0;
}
