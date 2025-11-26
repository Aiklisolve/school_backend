import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { parse } from "csv-parse";
import { pool } from "../config/db.js";

// ---------- helpers ----------
const normalizeName = (name) =>
  name.toLowerCase().replace(/[\s-]/g, "_");

const getCol = (row, ...names) => {
  for (const n of names) {
    if (n in row && row[n] !== null && row[n] !== undefined) {
      const v = String(row[n]).trim();
      if (v !== "") return v;
    }
  }
  return null;
};

const parseDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
};

const parseNumber = (v, fallback = 0) => {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return isNaN(n) ? fallback : n;
};

// general CSV loader
const loadCsv = (filePath) =>
  new Promise((resolve, reject) => {
    const content = fs.readFileSync(filePath, "utf8");
    parse(content, { columns: true, trim: true }, (err, records) => {
      if (err) return reject(err);
      resolve(records);
    });
  });

// ---------- import functions for each table ----------

// SCHOOLS
async function importSchools(rows, client) {
  let count = 0;
  for (const row of rows) {
    const schoolCode = getCol(row, "school_code", "SCHOOL_CODE", "School Code");
    const schoolName = getCol(row, "school_name", "SCHOOL_NAME", "School Name");
    if (!schoolCode || !schoolName) continue;

    const address1 = getCol(row, "address_line1", "School Address Line1");
    const address2 = getCol(row, "address_line2", "School Address Line2");
    const city = getCol(row, "city", "School City");
    const state = getCol(row, "state", "School State");
    const pincode = getCol(row, "pincode", "PINCODE", "School Pincode");
    const phone = getCol(row, "phone", "School Phone");
    const email = getCol(row, "email", "School Email");
    const website = getCol(row, "website", "School Website");
    const boardType = getCol(row, "board_type", "BOARD_TYPE", "Board Type") || "CBSE";

    await client.query(
      `
      INSERT INTO public.schools
        (school_code, school_name, address_line1, address_line2,
         city, state, pincode, phone, email, website, board_type)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (school_code)
      DO UPDATE SET
        school_name = EXCLUDED.school_name,
        address_line1 = EXCLUDED.address_line1,
        address_line2 = EXCLUDED.address_line2,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        pincode = EXCLUDED.pincode,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        website = EXCLUDED.website,
        board_type = EXCLUDED.board_type;
      `,
      [schoolCode, schoolName, address1, address2, city, state, pincode, phone, email, website, boardType]
    );

    count++;
  }
  return count;
}

async function getSchoolIdByCode(client, schoolCode) {
  const res = await client.query(
    `SELECT school_id FROM public.schools WHERE school_code = $1`,
    [schoolCode]
  );
  if (!res.rowCount) {
    throw new Error(`School not found for code ${schoolCode}`);
  }
  return res.rows[0].school_id;
}

// BRANCHES
async function importBranches(rows, client) {
  let count = 0;
  for (const row of rows) {
    const schoolCode = getCol(row, "school_code", "SCHOOL_CODE", "School Code");
    const branchCode = getCol(row, "branch_code", "BRANCH_CODE", "Branch Code");
    const branchName = getCol(row, "branch_name", "BRANCH_NAME", "Branch Name");

    if (!schoolCode || !branchCode || !branchName) continue;

    const schoolId = await getSchoolIdByCode(client, schoolCode);
    const address1 = getCol(row, "address_line1", "Branch Address Line1");
    const city = getCol(row, "city", "Branch City");
    const state = getCol(row, "state", "Branch State");
    const pincode = getCol(row, "pincode", "Branch Pincode");
    const phone = getCol(row, "phone", "Branch Phone");
    const isMain = getCol(row, "is_main_branch") === "true";

    await client.query(
      `
      INSERT INTO public.branches
        (school_id, branch_code, branch_name, address_line1,
         city, state, pincode, phone, is_main_branch)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (school_id, branch_code)
      DO UPDATE SET
        branch_name = EXCLUDED.branch_name,
        address_line1 = EXCLUDED.address_line1,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        pincode = EXCLUDED.pincode,
        phone = EXCLUDED.phone,
        is_main_branch = EXCLUDED.is_main_branch;
      `,
      [schoolId, branchCode, branchName, address1, city, state, pincode, phone, isMain]
    );

    count++;
  }
  return count;
}

// ACADEMIC YEARS
async function importAcademicYears(rows, client) {
  let count = 0;
  for (const row of rows) {
    const schoolCode = getCol(row, "school_code", "SCHOOL_CODE");
    const yearName = getCol(row, "year_name", "ACADEMIC_YEAR", "Academic Year");
    if (!schoolCode || !yearName) continue;

    const schoolId = await getSchoolIdByCode(client, schoolCode);
    const startDate = parseDate(getCol(row, "start_date", "Start Date")) || new Date("2024-04-01");
    const endDate = parseDate(getCol(row, "end_date", "End Date")) || new Date("2025-03-31");
    const isCurrent = String(getCol(row, "is_current") || "").toLowerCase() === "true";

    await client.query(
      `
      INSERT INTO public.academic_years
        (school_id, year_name, start_date, end_date, is_current)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (school_id, year_name)
      DO UPDATE SET
        start_date = EXCLUDED.start_date,
        end_date   = EXCLUDED.end_date,
        is_current = EXCLUDED.is_current;
      `,
      [schoolId, yearName, startDate, endDate, isCurrent]
    );

    count++;
  }
  return count;
}

async function getYearId(client, schoolId, yearName) {
  const res = await client.query(
    `SELECT year_id FROM public.academic_years WHERE school_id=$1 AND year_name=$2`,
    [schoolId, yearName]
  );
  if (!res.rowCount) throw new Error(`Year not found: ${yearName} for school ${schoolId}`);
  return res.rows[0].year_id;
}

// CLASSES
async function importClasses(rows, client) {
  let count = 0;
  for (const row of rows) {
    const schoolCode = getCol(row, "school_code", "SCHOOL_CODE");
    const className = getCol(row, "class_name", "CLASS_NAME", "Class Name");
    if (!schoolCode || !className) continue;

    const schoolId = await getSchoolIdByCode(client, schoolCode);
    const classOrder = parseInt(getCol(row, "class_order", "Class Order") || "1", 10);
    const classCategory = getCol(row, "class_category", "CLASS_CATEGORY") || "PRIMARY";

    await client.query(
      `
      INSERT INTO public.classes
        (school_id, class_name, class_order, class_category)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (school_id, class_name)
      DO UPDATE SET
        class_order    = EXCLUDED.class_order,
        class_category = EXCLUDED.class_category;
      `,
      [schoolId, className, classOrder, classCategory]
    );
    count++;
  }
  return count;
}

async function getClassId(client, schoolId, className) {
  const res = await client.query(
    `SELECT class_id FROM public.classes WHERE school_id=$1 AND class_name=$2`,
    [schoolId, className]
  );
  if (!res.rowCount) throw new Error(`Class not found: ${className} for school ${schoolId}`);
  return res.rows[0].class_id;
}

// SECTIONS
async function importSections(rows, client) {
  let count = 0;
  for (const row of rows) {
    const schoolCode = getCol(row, "school_code", "SCHOOL_CODE");
    const branchCode = getCol(row, "branch_code", "BRANCH_CODE");
    const className = getCol(row, "class_name", "CLASS_NAME");
    const yearName = getCol(row, "year_name", "ACADEMIC_YEAR");
    const sectionName = getCol(row, "section_name", "SECTION_NAME", "Section Name");

    if (!schoolCode || !className || !yearName || !sectionName) continue;

    const schoolId = await getSchoolIdByCode(client, schoolCode);
    const classId = await getClassId(client, schoolId, className);
    const yearId = await getYearId(client, schoolId, yearName);

    let branchId = null;
    if (branchCode) {
      const b = await client.query(
        `SELECT branch_id FROM public.branches WHERE school_id=$1 AND branch_code=$2`,
        [schoolId, branchCode]
      );
      if (b.rowCount) branchId = b.rows[0].branch_id;
    }

    await client.query(
      `
      INSERT INTO public.sections
        (school_id, branch_id, class_id, year_id, section_name)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (school_id, class_id, year_id, section_name)
      DO UPDATE SET
        branch_id = EXCLUDED.branch_id;
      `,
      [schoolId, branchId, classId, yearId, sectionName]
    );
    count++;
  }
  return count;
}

async function getSectionId(client, schoolId, classId, yearId, sectionName) {
  const res = await client.query(
    `SELECT section_id FROM public.sections
     WHERE school_id=$1 AND class_id=$2 AND year_id=$3 AND section_name=$4`,
    [schoolId, classId, yearId, sectionName]
  );
  if (!res.rowCount) throw new Error(`Section not found: ${sectionName}`);
  return res.rows[0].section_id;
}

// PARENTS
async function importParents(rows, client) {
  let count = 0;
  for (const row of rows) {
    const schoolCode = getCol(row, "school_code", "SCHOOL_CODE");
    const fullName = getCol(row, "parent_name", "PARENT_NAME", "Parent Name");
    const phone = getCol(row, "phone", "PARENT_PHONE", "Parent Phone");
    if (!schoolCode || !fullName || !phone) continue;

    const schoolId = await getSchoolIdByCode(client, schoolCode);
    const email = getCol(row, "email", "PARENT_EMAIL");
    const whatsapp = getCol(row, "whatsapp_number", "WhatsApp");
    const occupation = getCol(row, "occupation");
    const incomeRange = getCol(row, "annual_income_range");
    const education = getCol(row, "education_level");
    const address1 = getCol(row, "address_line1");
    const address2 = getCol(row, "address_line2");
    const city = getCol(row, "city");
    const state = getCol(row, "state");
    const pincode = getCol(row, "pincode");

    await client.query(
      `
      INSERT INTO public.parents
        (school_id, full_name, phone, whatsapp_number, email,
         occupation, annual_income_range, education_level,
         address_line1, address_line2, city, state, pincode, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true)
      ON CONFLICT (phone)
      DO UPDATE SET
        full_name           = EXCLUDED.full_name,
        whatsapp_number     = EXCLUDED.whatsapp_number,
        email               = EXCLUDED.email,
        occupation          = EXCLUDED.occupation,
        annual_income_range = EXCLUDED.annual_income_range,
        education_level     = EXCLUDED.education_level,
        address_line1       = EXCLUDED.address_line1,
        address_line2       = EXCLUDED.address_line2,
        city                = EXCLUDED.city,
        state               = EXCLUDED.state,
        pincode             = EXCLUDED.pincode;
      `,
      [
        schoolId,
        fullName,
        phone,
        whatsapp,
        email,
        occupation,
        incomeRange,
        education,
        address1,
        address2,
        city,
        state,
        pincode
      ]
    );
    count++;
  }
  return count;
}

async function getParentId(client, phone) {
  const res = await client.query(
    `SELECT parent_id FROM public.parents WHERE phone=$1`,
    [phone]
  );
  if (!res.rowCount) throw new Error(`Parent not found by phone ${phone}`);
  return res.rows[0].parent_id;
}

// STUDENTS
async function importStudents(rows, client) {
  let count = 0;
  for (const row of rows) {
    const schoolCode = getCol(row, "school_code", "SCHOOL_CODE");
    const branchCode = getCol(row, "branch_code", "BRANCH_CODE");
    const admissionNo = getCol(row, "admission_number", "ADMISSION_NO", "Admission Number");
    const fullName = getCol(row, "student_name", "STUDENT_NAME", "Full Name");

    if (!schoolCode || !admissionNo || !fullName) continue;

    const schoolId = await getSchoolIdByCode(client, schoolCode);

    let branchId = null;
    if (branchCode) {
      const b = await client.query(
        `SELECT branch_id FROM public.branches WHERE school_id=$1 AND branch_code=$2`,
        [schoolId, branchCode]
      );
      if (b.rowCount) branchId = b.rows[0].branch_id;
    }

    const rollNumber = getCol(row, "roll_number", "ROLL_NO");
    const dob = parseDate(getCol(row, "date_of_birth", "DOB"));
    const genderRaw = getCol(row, "gender", "Gender");
    const gender = genderRaw ? genderRaw[0].toUpperCase() : null;
    const blood = getCol(row, "blood_group", "Blood Group");
    const aadhar = getCol(row, "aadhar_number", "AADHAR", "Aadhaar");
    const admissionDate = parseDate(getCol(row, "admission_date", "Admission Date")) || new Date();
    const admissionClass = getCol(row, "admission_class", "Admission Class");
    const status = getCol(row, "current_status") || "ACTIVE";
    const address1 = getCol(row, "address_line1");
    const city = getCol(row, "city");
    const state = getCol(row, "state");
    const pincode = getCol(row, "pincode");
    const medical = getCol(row, "medical_conditions");
    const emergencyName = getCol(row, "emergency_contact_name", "Emergency Name");
    const emergencyPhone = getCol(row, "emergency_contact_phone", "Emergency Phone");

    await client.query(
      `
      INSERT INTO public.students
        (school_id, branch_id, admission_number, roll_number, full_name,
         date_of_birth, gender, blood_group, aadhar_number,
         admission_date, admission_class, current_status,
         address_line1, city, state, pincode,
         medical_conditions, emergency_contact_name, emergency_contact_phone)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      ON CONFLICT (school_id, admission_number)
      DO UPDATE SET
        branch_id          = EXCLUDED.branch_id,
        roll_number        = EXCLUDED.roll_number,
        full_name          = EXCLUDED.full_name,
        date_of_birth      = EXCLUDED.date_of_birth,
        gender             = EXCLUDED.gender,
        blood_group        = EXCLUDED.blood_group,
        aadhar_number      = EXCLUDED.aadhar_number,
        admission_date     = EXCLUDED.admission_date,
        admission_class    = EXCLUDED.admission_class,
        current_status     = EXCLUDED.current_status,
        address_line1      = EXCLUDED.address_line1,
        city               = EXCLUDED.city,
        state              = EXCLUDED.state,
        pincode            = EXCLUDED.pincode,
        medical_conditions = EXCLUDED.medical_conditions,
        emergency_contact_name  = EXCLUDED.emergency_contact_name,
        emergency_contact_phone = EXCLUDED.emergency_contact_phone;
      `,
      [
        schoolId,
        branchId,
        admissionNo,
        rollNumber,
        fullName,
        dob,
        gender,
        blood,
        aadhar,
        admissionDate,
        admissionClass,
        status,
        address1,
        city,
        state,
        pincode,
        medical,
        emergencyName,
        emergencyPhone
      ]
    );
    count++;
  }
  return count;
}

async function getStudentIdByAdmission(client, schoolId, admissionNo) {
  const res = await client.query(
    `SELECT student_id FROM public.students WHERE school_id=$1 AND admission_number=$2`,
    [schoolId, admissionNo]
  );
  if (!res.rowCount) throw new Error(`Student not found: ${admissionNo}`);
  return res.rows[0].student_id;
}

// PARENT-STUDENT RELATIONSHIPS
async function importParentStudentRelations(rows, client) {
  let count = 0;
  for (const row of rows) {
    const schoolCode = getCol(row, "school_code", "SCHOOL_CODE");
    const admissionNo = getCol(row, "admission_number", "ADMISSION_NO");
    const parentPhone = getCol(row, "parent_phone", "PARENT_PHONE");
    if (!schoolCode || !admissionNo || !parentPhone) continue;

    const schoolId = await getSchoolIdByCode(client, schoolCode);
    const studentId = await getStudentIdByAdmission(client, schoolId, admissionNo);
    const parentId = await getParentId(client, parentPhone);
    const relType = getCol(row, "relationship_type", "RELATIONSHIP_TYPE") || "FATHER";

    await client.query(
      `
      INSERT INTO public.parent_student_relationships
        (parent_id, student_id, relationship_type,
         is_primary_contact, is_fee_responsible, is_emergency_contact)
      VALUES ($1,$2,$3,true,true,true)
      ON CONFLICT (parent_id, student_id, relationship_type)
      DO NOTHING;
      `,
      [parentId, studentId, relType]
    );
    count++;
  }
  return count;
}

// STUDENT ENROLLMENTS
async function importStudentEnrollments(rows, client) {
  let count = 0;
  for (const row of rows) {
    const schoolCode = getCol(row, "school_code", "SCHOOL_CODE");
    const admissionNo = getCol(row, "admission_number", "ADMISSION_NO");
    const className = getCol(row, "class_name", "CLASS_NAME");
    const sectionName = getCol(row, "section_name", "SECTION_NAME");
    const yearName = getCol(row, "year_name", "ACADEMIC_YEAR");
    if (!schoolCode || !admissionNo || !className || !sectionName || !yearName) continue;

    const schoolId = await getSchoolIdByCode(client, schoolCode);
    const studentId = await getStudentIdByAdmission(client, schoolId, admissionNo);
    const classId = await getClassId(client, schoolId, className);
    const yearId = await getYearId(client, schoolId, yearName);
    const sectionId = await getSectionId(client, schoolId, classId, yearId, sectionName);
    const enrollDate = parseDate(getCol(row, "enrollment_date", "ENROLLMENT_DATE")) || new Date();
    const rollInSection = parseInt(getCol(row, "roll_number_in_section", "Roll In Section") || "0", 10) || null;

    await client.query(
      `
      INSERT INTO public.student_enrollments
        (student_id, section_id, year_id, enrollment_date, roll_number_in_section, is_active)
      VALUES ($1,$2,$3,$4,$5,true)
      ON CONFLICT (student_id, year_id)
      DO UPDATE SET
        section_id             = EXCLUDED.section_id,
        enrollment_date        = EXCLUDED.enrollment_date,
        roll_number_in_section = EXCLUDED.roll_number_in_section,
        is_active              = EXCLUDED.is_active;
      `,
      [studentId, sectionId, yearId, enrollDate, rollInSection]
    );
    count++;
  }
  return count;
}

// FEE STRUCTURES
async function importFeeStructures(rows, client) {
  let count = 0;
  for (const row of rows) {
    const schoolCode = getCol(row, "school_code", "SCHOOL_CODE");
    const className = getCol(row, "class_name", "CLASS_NAME");
    const yearName = getCol(row, "year_name", "ACADEMIC_YEAR");
    const structureName = getCol(row, "structure_name", "STRUCTURE_NAME");
    if (!schoolCode || !className || !yearName || !structureName) continue;

    const schoolId = await getSchoolIdByCode(client, schoolCode);
    const classId = await getClassId(client, schoolId, className);
    const yearId = await getYearId(client, schoolId, yearName);

    const totalFee = parseNumber(getCol(row, "total_annual_fee", "TOTAL_ANNUAL_FEE"));
    const effectiveFrom = parseDate(getCol(row, "effective_from")) || new Date();
    const effectiveTo = parseDate(getCol(row, "effective_to"));
    // fee_components/installment_plan could be JSON text; here we just default to {} / []
    await client.query(
      `
      INSERT INTO public.fee_structures
        (school_id, class_id, year_id, structure_name,
         total_annual_fee, effective_from, effective_to)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (school_id, class_id, year_id, structure_name)
      DO UPDATE SET
        total_annual_fee = EXCLUDED.total_annual_fee,
        effective_from   = EXCLUDED.effective_from,
        effective_to     = EXCLUDED.effective_to;
      `,
      [schoolId, classId, yearId, structureName, totalFee, effectiveFrom, effectiveTo]
    );
    count++;
  }
  return count;
}

// STUDENT FEE ASSIGNMENTS
async function importStudentFeeAssignments(rows, client) {
  let count = 0;
  for (const row of rows) {
    const schoolCode = getCol(row, "school_code", "SCHOOL_CODE");
    const admissionNo = getCol(row, "admission_number", "ADMISSION_NO");
    const yearName = getCol(row, "year_name", "ACADEMIC_YEAR");
    const structureName = getCol(row, "structure_name", "STRUCTURE_NAME");
    if (!schoolCode || !admissionNo || !yearName || !structureName) continue;

    const schoolId = await getSchoolIdByCode(client, schoolCode);
    const studentId = await getStudentIdByAdmission(client, schoolId, admissionNo);
    const yearId = await getYearId(client, schoolId, yearName);

    const fsRes = await client.query(
      `SELECT structure_id FROM public.fee_structures
       WHERE school_id=$1 AND year_id=$2 AND structure_name=$3`,
      [schoolId, yearId, structureName]
    );
    if (!fsRes.rowCount) continue;
    const feeStructureId = fsRes.rows[0].structure_id;

    const totalFee = parseNumber(getCol(row, "total_fee_amount", "TOTAL_FEE"));
    const concession = parseNumber(getCol(row, "concession_amount", "CONCESSION"));
    const reason = getCol(row, "concession_reason", "CONCESSION_REASON");

    await client.query(
      `
      INSERT INTO public.student_fee_assignments
        (student_id, fee_structure_id, year_id,
         total_fee_amount, concession_amount, concession_reason)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (student_id, year_id)
      DO UPDATE SET
        fee_structure_id  = EXCLUDED.fee_structure_id,
        total_fee_amount  = EXCLUDED.total_fee_amount,
        concession_amount = EXCLUDED.concession_amount,
        concession_reason = EXCLUDED.concession_reason;
      `,
      [studentId, feeStructureId, yearId, totalFee, concession, reason]
    );
    count++;
  }
  return count;
}

// FEE PAYMENTS (basic)
async function importFeePayments(rows, client) {
  let count = 0;
  for (const row of rows) {
    const schoolCode = getCol(row, "school_code", "SCHOOL_CODE");
    const admissionNo = getCol(row, "admission_number", "ADMISSION_NO");
    const yearName = getCol(row, "year_name", "ACADEMIC_YEAR");
    if (!schoolCode || !admissionNo || !yearName) continue;

    const schoolId = await getSchoolIdByCode(client, schoolCode);
    const studentId = await getStudentIdByAdmission(client, schoolId, admissionNo);
    const yearId = await getYearId(client, schoolId, yearName);

    // Get assignment
    const aRes = await client.query(
      `SELECT assignment_id FROM public.student_fee_assignments
       WHERE student_id=$1 AND year_id=$2`,
      [studentId, yearId]
    );
    if (!aRes.rowCount) continue;
    const assignmentId = aRes.rows[0].assignment_id;

    const installment = parseInt(getCol(row, "installment_number", "INSTALLMENT_NO") || "1", 10);
    const amountDue = parseNumber(getCol(row, "amount_due"));
    const amountPaid = parseNumber(getCol(row, "amount_paid"));
    const balance = parseNumber(getCol(row, "balance_amount"));
    const dueDate = parseDate(getCol(row, "due_date"));
    const payDate = parseDate(getCol(row, "payment_date"));
    const mode = getCol(row, "payment_mode");
    const ref = getCol(row, "transaction_reference");
    const status = getCol(row, "status") || "PENDING";

    await client.query(
      `
      INSERT INTO public.fee_payments
        (student_id, fee_assignment_id, installment_number,
         amount_due, amount_paid, balance_amount,
         due_date, payment_date, payment_mode,
         transaction_reference, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT DO NOTHING;
      `,
      [studentId, assignmentId, installment, amountDue, amountPaid, balance, dueDate, payDate, mode, ref, status]
    );
    count++;
  }
  return count;
}

// USERS (for staff / parents / admins)
async function importUsers(rows, client) {
  let count = 0;
  for (const row of rows) {
    const schoolCode = getCol(row, "school_code", "SCHOOL_CODE");
    const username = getCol(row, "username", "USERNAME");
    const email = getCol(row, "email", "EMAIL");
    const phone = getCol(row, "phone", "PHONE");
    const fullName = getCol(row, "full_name", "FULL_NAME", "Name");
    const role = getCol(row, "role", "ROLE");
    if (!schoolCode || !username || !email || !phone || !fullName || !role) continue;

    const schoolId = await getSchoolIdByCode(client, schoolCode);
    const branchCode = getCol(row, "branch_code", "BRANCH_CODE");
    let branchId = null;
    if (branchCode) {
      const b = await client.query(
        `SELECT branch_id FROM public.branches WHERE school_id=$1 AND branch_code=$2`,
        [schoolId, branchCode]
      );
      if (b.rowCount) branchId = b.rows[0].branch_id;
    }

    // For migration we can set a default temp password_hash like 'MIGRATED'
    const passwordHash = getCol(row, "password_hash") || "MIGRATED";

    await client.query(
      `
      INSERT INTO public.users
        (school_id, branch_id, username, email, phone,
         password_hash, full_name, role)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (username)
      DO UPDATE SET
        email        = EXCLUDED.email,
        phone        = EXCLUDED.phone,
        full_name    = EXCLUDED.full_name,
        role         = EXCLUDED.role,
        branch_id    = EXCLUDED.branch_id;
      `,
      [schoolId, branchId, username, email, phone, passwordHash, fullName, role]
    );
    count++;
  }
  return count;
}

// TEACHER ASSIGNMENTS (simple)
async function importTeacherAssignments(rows, client) {
  let count = 0;
  for (const row of rows) {
    const schoolCode = getCol(row, "school_code", "SCHOOL_CODE");
    const username = getCol(row, "teacher_username", "TEACHER_USERNAME");
    const className = getCol(row, "class_name", "CLASS_NAME");
    const sectionName = getCol(row, "section_name", "SECTION_NAME");
    const yearName = getCol(row, "year_name", "ACADEMIC_YEAR");
    if (!schoolCode || !username || !className || !sectionName || !yearName) continue;

    const schoolId = await getSchoolIdByCode(client, schoolCode);

    const userRes = await client.query(
      `SELECT user_id FROM public.users WHERE school_id=$1 AND username=$2`,
      [schoolId, username]
    );
    if (!userRes.rowCount) continue;
    const teacherId = userRes.rows[0].user_id;

    const classId = await getClassId(client, schoolId, className);
    const yearId = await getYearId(client, schoolId, yearName);
    const sectionId = await getSectionId(client, schoolId, classId, yearId, sectionName);

    await client.query(
      `
      INSERT INTO public.teacher_assignments
        (teacher_id, section_id, year_id, is_class_teacher)
      VALUES ($1,$2,$3,true)
      ON CONFLICT DO NOTHING;
      `,
      [teacherId, sectionId, yearId]
    );
    count++;
  }
  return count;
}

// ---------- driver functions ----------

async function migrateFromWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath);
  const client = await pool.connect();
  const summary = {};

  try {
    await client.query("BEGIN");

    for (const sheetName of workbook.SheetNames) {
      const norm = normalizeName(sheetName);
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
      if (!rows.length) continue;

      console.log(`Processing sheet: ${sheetName} (${norm})`);

      switch (norm) {
        case "schools":
          summary.schools = await importSchools(rows, client);
          break;
        case "branches":
          summary.branches = await importBranches(rows, client);
          break;
        case "academic_years":
          summary.academic_years = await importAcademicYears(rows, client);
          break;
        case "classes":
          summary.classes = await importClasses(rows, client);
          break;
        case "sections":
          summary.sections = await importSections(rows, client);
          break;
        case "parents":
          summary.parents = await importParents(rows, client);
          break;
        case "students":
          summary.students = await importStudents(rows, client);
          break;
        case "parent_student_relationships":
          summary.parent_student_relationships = await importParentStudentRelations(rows, client);
          break;
        case "student_enrollments":
          summary.student_enrollments = await importStudentEnrollments(rows, client);
          break;
        case "fee_structures":
          summary.fee_structures = await importFeeStructures(rows, client);
          break;
        case "student_fee_assignments":
          summary.student_fee_assignments = await importStudentFeeAssignments(rows, client);
          break;
        case "fee_payments":
          summary.fee_payments = await importFeePayments(rows, client);
          break;
        case "users":
          summary.users = await importUsers(rows, client);
          break;
        case "teacher_assignments":
          summary.teacher_assignments = await importTeacherAssignments(rows, client);
          break;
        default:
          console.log(`Skipping unknown sheet: ${sheetName}`);
      }
    }

    await client.query("COMMIT");
    return summary;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function migrateFromCsv(filePath, tableName) {
  const rows = await loadCsv(filePath);
  const client = await pool.connect();
  const norm = normalizeName(tableName);
  const summary = {};

  try {
    await client.query("BEGIN");

    switch (norm) {
      case "schools":
        summary.schools = await importSchools(rows, client);
        break;
      case "branches":
        summary.branches = await importBranches(rows, client);
        break;
      case "academic_years":
        summary.academic_years = await importAcademicYears(rows, client);
        break;
      case "classes":
        summary.classes = await importClasses(rows, client);
        break;
      case "sections":
        summary.sections = await importSections(rows, client);
        break;
      case "parents":
        summary.parents = await importParents(rows, client);
        break;
      case "students":
        summary.students = await importStudents(rows, client);
        break;
      case "parent_student_relationships":
        summary.parent_student_relationships = await importParentStudentRelations(rows, client);
        break;
      case "student_enrollments":
        summary.student_enrollments = await importStudentEnrollments(rows, client);
        break;
      case "fee_structures":
        summary.fee_structures = await importFeeStructures(rows, client);
        break;
      case "student_fee_assignments":
        summary.student_fee_assignments = await importStudentFeeAssignments(rows, client);
        break;
      case "fee_payments":
        summary.fee_payments = await importFeePayments(rows, client);
        break;
      case "users":
        summary.users = await importUsers(rows, client);
        break;
      case "teacher_assignments":
        summary.teacher_assignments = await importTeacherAssignments(rows, client);
        break;
      default:
        throw new Error(`Unsupported table for CSV: ${tableName}`);
    }

    await client.query("COMMIT");
    return summary;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// exported function used by controller
export const migrateSchoolData = async (filePath, tableName = null, originalName = "") => {
    // Prefer original filename extension; fallback to saved path
    let ext = "";
    if (originalName) {
      ext = path.extname(originalName).toLowerCase();
    }
    if (!ext) {
      ext = path.extname(filePath).toLowerCase();
    }
  
    if (ext === ".xlsx" || ext === ".xls") {
      return migrateFromWorkbook(filePath);
    }
    if (ext === ".csv") {
      if (!tableName) {
        throw new Error("For CSV uploads, pass ?table=students (or schools, parents, etc)");
      }
      return migrateFromCsv(filePath, tableName);
    }
    throw new Error("Only .xlsx, .xls or .csv files are supported");
  };