// controllers/bulkUploadController.js
import fs from "fs";
import crypto from "crypto";
import { parse } from "csv-parse";
import * as XLSX from "xlsx";
import { query } from "../config/db.js";

// ---------- helpers ----------
function toBool(v) {
  if (v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  return ["true", "1", "yes", "y"].includes(s);
}

function hashPassword(plain) {
  return crypto.createHash("sha256").update(plain).digest("hex");
}

const REQUIRED_COLUMNS = [
  "school_id",
  "parent_full_name",
  "parent_phone",
  "student_admission_number",
  "student_full_name",
  "student_date_of_birth",
  "student_admission_date",
  "student_admission_class",
];

// read file and return array of row objects (supports CSV & XLSX)
async function loadRecordsFromFile(file) {
  const buffer = await fs.promises.readFile(file.path);

  // detect XLSX by magic header "PK\u0003\u0004"
  const isXlsx =
    buffer.length > 4 &&
    buffer[0] === 0x50 && // 'P'
    buffer[1] === 0x4b && // 'K'
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;

  if (isXlsx) {
    // ----- Excel (.xlsx) -----
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }); // header = first row
    return rows;
  }

  // ----- CSV -----
  return await new Promise((resolve, reject) => {
    parse(
      buffer,
      {
        columns: true,
        trim: true,
        skip_empty_lines: true,
      },
      (err, records) => {
        if (err) return reject(err);
        resolve(records);
      }
    );
  });
}

// ---------- main controller ----------
export async function bulkUploadFamilies(req, res) {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "File is required (field name: file)" });
    }

    // read rows from CSV or XLSX
    const records = await loadRecordsFromFile(req.file);

    if (!records.length) {
      return res.status(400).json({ message: "File is empty" });
    }

    const headers = Object.keys(records[0]);
    const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
    if (missing.length) {
      return res.status(400).json({
        message: "Missing required columns",
        missing,
        received_headers: headers,
      });
    }

    const results = {
      total_rows: records.length,
      success_rows: 0,
      failed_rows: 0,
      errors: [],
    };

    for (let index = 0; index < records.length; index++) {
      const row = records[index];

      try {
        const school_id = Number(row.school_id);
        const branch_id = row.branch_id ? Number(row.branch_id) : null;
        const defaultPassword = row.default_password || "Password@123";
        const passwordHash = hashPassword(defaultPassword);

        // ---------- PARENT USER + PARENT ----------
        const parent_phone = row.parent_phone;
        const parent_email = row.parent_email || null;

        let parentUserId, parentId;

        const existingParent = await query(
          `SELECT u.user_id, p.parent_id
             FROM parents p
             JOIN users u ON u.user_id = p.user_id
            WHERE p.school_id = $1
              AND p.phone = $2`,
          [school_id, parent_phone]
        );

        if (existingParent.rows.length) {
          parentUserId = existingParent.rows[0].user_id;
          parentId = existingParent.rows[0].parent_id;
        } else {
          const parentUsername =
            row.parent_username || `P_${school_id}_${parent_phone}`;

          const parentUserInsert = await query(
            `INSERT INTO public.users
             (school_id, branch_id, username, email, phone, password_hash, full_name, role, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'PARENT',true)
             RETURNING user_id`,
            [
              school_id,
              branch_id,
              parentUsername,
              parent_email,
              parent_phone,
              passwordHash,
              row.parent_full_name,
            ]
          );
          parentUserId = parentUserInsert.rows[0].user_id;

          const parentInsert = await query(
            `INSERT INTO public.parents
             (school_id, full_name, phone, whatsapp_number, email, occupation,
              annual_income_range, education_level, address_line1, address_line2,
              city, state, pincode, user_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
             RETURNING parent_id`,
            [
              school_id,
              row.parent_full_name,
              parent_phone,
              row.parent_whatsapp_number || null,
              parent_email,
              row.parent_occupation || null,
              row.parent_annual_income_range || null,
              row.parent_education_level || null,
              row.parent_address_line1 || null,
              row.parent_address_line2 || null,
              row.parent_city || null,
              row.parent_state || null,
              row.parent_pincode || null,
              parentUserId,
            ]
          );

          parentId = parentInsert.rows[0].parent_id;
        }

        // ---------- STUDENT USER + STUDENT ----------
        const admission_number = row.student_admission_number;

        let studentUserId, studentId;

        const existingStudent = await query(
          `SELECT s.student_id, s.user_id
             FROM students s
            WHERE s.school_id = $1
              AND s.admission_number = $2`,
          [school_id, admission_number]
        );

        if (existingStudent.rows.length) {
          studentId = existingStudent.rows[0].student_id;
          studentUserId = existingStudent.rows[0].user_id;
        } else {
          const studentUsername =
            row.student_username || `S_${school_id}_${admission_number}`;

          const studentUserInsert = await query(
            `INSERT INTO public.users
             (school_id, branch_id, username, email, phone, password_hash, full_name, role, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'STUDENT',true)
             RETURNING user_id`,
            [
              school_id,
              branch_id,
              studentUsername,
              row.student_email || null,
              row.student_phone || null,
              passwordHash,
              row.student_full_name,
            ]
          );
          studentUserId = studentUserInsert.rows[0].user_id;

          const studentInsert = await query(
            `INSERT INTO public.students
             (school_id, branch_id, admission_number, roll_number, full_name,
              date_of_birth, gender, blood_group, aadhar_number, admission_date,
              admission_class, address_line1, city, state, pincode,
              medical_conditions, emergency_contact_name, emergency_contact_phone,
              student_photo_url, user_id)
             VALUES
             ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
              $12,$13,$14,$15,$16,$17,$18,$19,$20)
             RETURNING student_id`,
            [
              school_id,
              branch_id,
              admission_number,
              row.student_roll_number || null,
              row.student_full_name,
              row.student_date_of_birth,
              row.student_gender || null,
              row.student_blood_group || null,
              row.student_aadhar_number || null,
              row.student_admission_date,
              row.student_admission_class,
              row.student_address_line1 || null,
              row.student_city || null,
              row.student_state || null,
              row.student_pincode || null,
              row.student_medical_conditions || null,
              row.student_emergency_contact_name || null,
              row.student_emergency_contact_phone || null,
              row.student_photo_url || null,
              studentUserId,
            ]
          );

          studentId = studentInsert.rows[0].student_id;
        }

        // ---------- RELATIONSHIP ----------
        const relationship_type = row.relationship_type || "FATHER";

        await query(
          `INSERT INTO public.parent_student_relationships
           (parent_id, student_id, relationship_type,
            is_primary_contact, is_fee_responsible, is_emergency_contact)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (parent_id, student_id, relationship_type) DO UPDATE
             SET is_primary_contact = EXCLUDED.is_primary_contact,
                 is_fee_responsible = EXCLUDED.is_fee_responsible,
                 is_emergency_contact = EXCLUDED.is_emergency_contact`,
          [
            parentId,
            studentId,
            relationship_type,
            toBool(row.is_primary_contact),
            toBool(row.is_fee_responsible),
            toBool(row.is_emergency_contact),
          ]
        );

        results.success_rows += 1;
      } catch (e) {
        console.error(`Row ${index + 1} failed:`, e);
        results.failed_rows += 1;
        results.errors.push({ row: index + 1, error: e.message });
      }
    }

    fs.unlink(req.file.path, () => {});

    return res.json({
      status: "completed",
      headers: Object.keys(records[0]),
      ...results,
    });
  } catch (err) {
    console.error("Bulk upload error:", err);
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    return res.status(500).json({ status: "error", message: err.message });
  }
}
