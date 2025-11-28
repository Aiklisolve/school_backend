// src/controllers/userController.js
import bcrypt from 'bcrypt';           // or 'bcryptjs' if you used that
import validator from 'validator';
import { query } from '../config/db.js';
import crypto from 'crypto';
const BCRYPT_ROUNDS = 10;
const ALLOWED_ROLES = ['PRINCIPAL', 'TEACHER', 'PARENT', 'ADMIN', 'STUDENT'];
const ALLOWED_GENDER = ['M', 'F', 'O'];

export async function registerUser(req, res) {
  try {
    const {
      school_id,
      branch_id,
      username,
      email,
      phone,
      password,
      full_name,
      date_of_birth,
      gender,        // 'M' | 'F' | 'O'
      role,          // must be in ALLOWED_ROLES
      employee_id,
      designation,
      alternate_phone,
      emergency_contact,
      address_line1,
      city,
      state,
      pincode,
    } = req.body;

    const normalizedRole = role ? role.toString().trim().toUpperCase() : null;
    const normalizedGender = gender ? gender.toString().trim().toUpperCase() : null;


    // 1. Basic required-field validation
    // if (!school_id || !username || !email || !phone || !password || !full_name || !role) {
    //   return res.status(400).json({
    //     status: 'error',
    //     message: 'school_id, username, email, phone, password, full_name, and role are required',
    //   });
    // }
    if (!school_id || !username || !email || !phone || !password || !full_name || !normalizedRole) {
      return res.status(400).json({
        status: 'error',
        message: 'school_id, username, email, phone, password, full_name, and role are required',
      });
    }


    // 2. Email validation
    if (!validator.isEmail(email)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid email format',
      });
    }

    // 3. Role validation
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid role. Allowed values: ${ALLOWED_ROLES.join(', ')}`,
      });
    }

    // 4. Gender validation (optional)
    // if (gender && !ALLOWED_GENDER.includes(gender)) {
    //   return res.status(400).json({
    //     status: 'error',
    //     message: `Invalid gender. Allowed values: ${ALLOWED_GENDER.join(', ')}`,
    //   });
    // }
    if (normalizedGender && !ALLOWED_GENDER.includes(normalizedGender)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid gender. Allowed values: ${ALLOWED_GENDER.join(', ')}`,
      });
    }


    // 5. Hash password with bcrypt (10 rounds)
    // const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    function hashPassword(password) {
      return crypto.createHash('sha256').update(password).digest('hex'); // 64 chars
    }
    const password_hash = hashPassword(password);
    // console.log('hashed password:', password_hash); // will be 64-char hex


    // 6. Insert user into DB
    const insertSql = `
      INSERT INTO public.users (
        school_id,
        branch_id,
        username,
        email,
        phone,
        password_hash,
        full_name,
        date_of_birth,
        gender,
        role,
        employee_id,
        designation,
        alternate_phone,
        emergency_contact,
        address_line1,
        city,
        state,
        pincode,
        is_active,
        email_verified,
        phone_verified
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18,
        true, false, false
      )
      RETURNING
        user_id,
        school_id,
        branch_id,
        username,
        email,
        phone,
        full_name,
        role,
        gender,
        date_of_birth,
        is_active,
        email_verified,
        phone_verified,
        created_at,
        updated_at;
    `;

    // const params = [
    //   school_id,
    //   branch_id || null,
    //   username,
    //   email,
    //   phone,
    //   password_hash,
    //   full_name,
    //   date_of_birth || null,   // expected as 'YYYY-MM-DD' from frontend
    //   gender || null,
    //   role,
    //   employee_id || null,
    //   designation || null,
    //   alternate_phone || null,
    //   emergency_contact || null,
    //   address_line1 || null,
    //   city || null,
    //   state || null,
    //   pincode || null,
    // ];

    //changes for normalized role and gender
    const params = [
      school_id,
      branch_id || null,
      username,
      email,
      phone,
      password_hash,
      full_name,
      date_of_birth || null,   // still 'YYYY-MM-DD'
      normalizedGender || null,
      normalizedRole,
      employee_id || null,
      designation || null,
      alternate_phone || null,
      emergency_contact || null,
      address_line1 || null,
      city || null,
      state || null,
      pincode || null,
    ];


    // const { rows } = await query(insertSql, params);
    // const newUser = rows[0];

    const { rows } = await query(insertSql, params);
    const newUser = rows[0];

    // Make sure role/gender in response are consistent
    newUser.role = normalizedRole;
    if (normalizedGender) newUser.gender = normalizedGender;


    return res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: newUser,
    });

  } catch (err) {
    console.error('Register user error:', err);

    // Unique constraint violations
    if (err.code === '23505') {
      // Which unique?
      // users_email_key, users_phone_key, users_username_key
      if (err.constraint === 'users_email_key') {
        return res.status(409).json({ status: 'error', message: 'Email already in use' });
      }
      if (err.constraint === 'users_phone_key') {
        return res.status(409).json({ status: 'error', message: 'Phone already in use' });
      }
      if (err.constraint === 'users_username_key') {
        return res.status(409).json({ status: 'error', message: 'Username already in use' });
      }
      return res.status(409).json({ status: 'error', message: 'User already exists (unique constraint)' });
    }

    // Foreign key violation (invalid school / branch)
    if (err.code === '23503') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid school_id or branch_id (foreign key violation)',
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Internal server error during registration',
    });
  }
}

export async function getAllUsers(req, res) {
  try {
    const sql = `
      SELECT user_id, school_id, branch_id, username, email, phone,
             full_name, role, gender, is_active, created_at
      FROM public.users
      ORDER BY user_id DESC;
    `;

    const { rows } = await query(sql);

    return res.status(200).json({
      status: "success",
      users: rows,
    });
  } catch (err) {
    console.error("Fetch users error:", err);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
}

// export async function getUserById(req, res) {
//   try {
//     const { id } = req.params;

//     const sql = `
//       SELECT 
//         u.user_id,
//         u.school_id,
//         u.branch_id,
//         u.username,
//         u.email,
//         u.phone,
//         u.full_name,
//         u.role,
//         u.gender,
//         u.is_active,
//         u.created_at,

//         -- school related
//         s.school_code,
//         s.school_name,
//         s.city      AS school_city,
//         s.state     AS school_state,
//         s.pincode   AS school_pincode,
//         s.board_type,

//         -- branch related
//         b.branch_code,
//         b.branch_name,
//         b.city      AS branch_city,
//         b.state     AS branch_state,
//         b.pincode   AS branch_pincode,
//         b.is_main_branch

//       FROM public.users u
//       JOIN public.schools s
//         ON u.school_id = s.school_id
//       LEFT JOIN public.branches b
//         ON u.branch_id = b.branch_id
//        AND b.school_id = u.school_id
//       WHERE u.user_id = $1
//     `;

//     const { rows } = await query(sql, [id]);

//     if (rows.length === 0) {
//       return res.status(404).json({
//         status: "error",
//         message: "User not found",
//       });
//     }

//     const user = rows[0];

//     // -----------------------------------------------------
//     // 🟦 IF ROLE = STUDENT → Fetch student table details
//     // -----------------------------------------------------
//     let studentData = null;

//     if (user.role === "STUDENT") {
//       const studentSql = `
//         SELECT 
//           st.student_id,
//           st.admission_number,
//           st.roll_number,
//           st.full_name AS student_full_name,
//           st.date_of_birth,
//           st.gender,
//           st.admission_class,
//           st.current_status,
//           st.student_photo_url,
//           st.address_line1,
//           st.city,
//           st.state,
//           st.pincode,
//           st.medical_conditions,

//           -- parent details
//           psr.relationship_type,
//           psr.is_primary_contact,
//           p.parent_id,
//           p.full_name AS parent_name,
//           p.phone     AS parent_phone,
//           p.email     AS parent_email

//         FROM public.students st
//         LEFT JOIN public.parent_student_relationships psr
//           ON psr.student_id = st.student_id
//         LEFT JOIN public.parents p
//           ON p.parent_id = psr.parent_id
//         WHERE st.user_id = $1
//       `;

//       const studentResult = await query(studentSql, [id]);
//       studentData = studentResult.rows || [];
//     }

//     return res.status(200).json({
//       status: "success",
//       user,
//       student: studentData, // may be [] if no mapping
//     });

//   } catch (err) {
//     console.error("Error fetching user:", err);
//     return res.status(500).json({
//       status: "error",
//       message: "Internal server error",
//     });
//   }
// }

export async function getUserById(req, res) {
  try {
    const { id } = req.params;

    const sql = `
      SELECT 
        u.user_id,
        u.school_id,
        u.branch_id,
        u.username,
        u.email,
        u.phone,
        u.full_name,
        u.role,
        u.gender,
        u.is_active,
        u.created_at,

        -- school related
        s.school_code,
        s.school_name,
        s.city      AS school_city,
        s.state     AS school_state,
        s.pincode   AS school_pincode,
        s.board_type,

        -- branch related
        b.branch_code,
        b.branch_name,
        b.city      AS branch_city,
        b.state     AS branch_state,
        b.pincode   AS branch_pincode,
        b.is_main_branch

      FROM public.users u
      JOIN public.schools s
        ON u.school_id = s.school_id
      LEFT JOIN public.branches b
        ON u.branch_id = b.branch_id
       AND b.school_id = u.school_id
      WHERE u.user_id = $1
    `;

    const { rows } = await query(sql, [id]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });
    }

    const user = rows[0];

    let parentProfile = null;
    let parentStudents = [];
    let studentProfile = null;
    let studentParents = [];

    if (user.role === "PARENT" || user.role === "STUDENT") {
      const whereClause =
        user.role === "PARENT"
          ? "WHERE p.user_id = $1"
          : "WHERE st.user_id = $1";

      const parentSql = `
        SELECT
          p.parent_id,
          p.user_id           AS parent_user_id,
          p.school_id,
          p.full_name         AS parent_full_name,
          p.phone             AS parent_phone,
          p.email             AS parent_email,
          p.whatsapp_number,
          p.occupation,
          p.annual_income_range,
          p.education_level,
          p.address_line1,
          p.address_line2,
          p.city              AS parent_city,
          p.state             AS parent_state,
          p.pincode           AS parent_pincode,

          psr.relationship_type,
          psr.is_primary_contact,
          psr.is_fee_responsible,
          psr.is_emergency_contact,

          st.student_id,
          st.user_id          AS student_user_id,
          st.full_name        AS student_full_name,
          st.admission_number,
          st.roll_number,
          st.admission_class,
          st.current_status,
          st.student_photo_url,

          u.username,
          u.email             AS student_user_email,
          u.phone             AS student_user_phone,
          u.role              AS student_user_role,
          u.is_active         AS student_user_is_active
        FROM public.parents p
        LEFT JOIN public.parent_student_relationships psr
          ON psr.parent_id = p.parent_id
        LEFT JOIN public.students st
          ON st.student_id = psr.student_id
        LEFT JOIN public.users u
          ON u.user_id = st.user_id
        ${whereClause};
      `;

      const result = await query(parentSql, [id]);

      if (result.rows.length === 0) {
        parentProfile = null;
        parentStudents = [];
        studentProfile = null;
        studentParents = [];
      } else if (user.role === "PARENT") {
        const first = result.rows[0];

        // Main parent profile (logged-in user)
        parentProfile = {
          parent_id: first.parent_id,
          parent_user_id: first.parent_user_id,
          school_id: first.school_id,
          full_name: first.parent_full_name,
          phone: first.parent_phone,
          email: first.parent_email,
          whatsapp_number: first.whatsapp_number,
          occupation: first.occupation,
          annual_income_range: first.annual_income_range,
          education_level: first.education_level,
          address_line1: first.address_line1,
          address_line2: first.address_line2,
          city: first.parent_city,
          state: first.parent_state,
          pincode: first.parent_pincode, // ✅ fixed
        };

        // All linked students
        parentStudents = result.rows
          .filter((r) => r.student_id)
          .map((r) => ({
            student_id: r.student_id,
            student_user_id: r.student_user_id,
            full_name: r.student_full_name,
            admission_number: r.admission_number,
            roll_number: r.roll_number,
            admission_class: r.admission_class,
            current_status: r.current_status,
            student_photo_url: r.student_photo_url,
            relationship_type: r.relationship_type,
            is_primary_contact: r.is_primary_contact,
            is_fee_responsible: r.is_fee_responsible,
            is_emergency_contact: r.is_emergency_contact,
            // optional: login info of student user
            student_user_email: r.student_user_email,
            student_user_phone: r.student_user_phone,
            student_user_role: r.student_user_role,
            student_user_is_active: r.student_user_is_active,
          }));
      } else if (user.role === "STUDENT") {
        const first = result.rows[0];

        // Main student profile (logged-in user)
        studentProfile = {
          student_id: first.student_id,
          student_user_id: first.student_user_id,
          school_id: first.school_id,
          full_name: first.student_full_name,
          admission_number: first.admission_number,
          roll_number: first.roll_number,
          admission_class: first.admission_class,
          current_status: first.current_status,
          student_photo_url: first.student_photo_url,
          username: first.username,
          email: first.student_user_email,
          phone: first.student_user_phone,
          role: first.student_user_role,
          is_active: first.student_user_is_active,
        };

        // All linked parents for this student
        studentParents = result.rows.map((r) => ({
          parent_id: r.parent_id,
          parent_user_id: r.parent_user_id,
          full_name: r.parent_full_name,
          phone: r.parent_phone,
          email: r.parent_email,
          whatsapp_number: r.whatsapp_number,
          occupation: r.occupation,
          annual_income_range: r.annual_income_range,
          education_level: r.education_level,
          address_line1: r.address_line1,
          address_line2: r.address_line2,
          city: r.parent_city,
          state: r.parent_state,
          pincode: r.parent_pincode, // ✅ fixed
          relationship_type: r.relationship_type,
          is_primary_contact: r.is_primary_contact,
          is_fee_responsible: r.is_fee_responsible,
          is_emergency_contact: r.is_emergency_contact,
        }));
      }
    }

    return res.status(200).json({
      status: "success",
      user,
      // studentData was never defined; use studentProfile instead
      student: studentProfile,          // non-null when role = STUDENT and has at least one parent
      parent: parentProfile,            // non-null when role = PARENT
      parentStudents,                   // children list for parent user
      studentParents,                   // parents list for student user
      studentProfile,                   // kept separately if you want both keys
    });
  } catch (err) {
    console.error("Error fetching user:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
}




export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const {
      full_name,
      phone,
      role,
      designation,
      address_line1,
      city,
      state,
      pincode
    } = req.body;

    const sql = `
      UPDATE public.users
      SET full_name = $1,
          phone = $2,
          role = $3,
          designation = $4,
          address_line1 = $5,
          city = $6,
          state = $7,
          pincode = $8,
          updated_at = NOW()
      WHERE user_id = $9
      RETURNING *;
    `;

    const params = [
      full_name,
      phone,
      role,
      designation,
      address_line1,
      city,
      state,
      pincode,
      id,
    ];

    const { rows } = await query(sql, params);

    if (rows.length === 0) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    return res.status(200).json({
      status: "success",
      message: "User updated successfully",
      user: rows[0],
    });

  } catch (err) {
    console.error("User update error:", err);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
}


export async function deactivateUser(req, res) {
  try {
    const { id } = req.params;

    const sql = `
      UPDATE public.users
      SET is_active = false, updated_at = NOW()
      WHERE user_id = $1
      RETURNING *;
    `;

    const { rows } = await query(sql, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    return res.status(200).json({
      status: "success",
      message: "User deactivated successfully",
    });
  } catch (err) {
    console.error("Deactivate error:", err);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
}



export async function activateUser(req, res) {
  try {
    const { id } = req.params;

    const sql = `
      UPDATE public.users
      SET is_active = true, updated_at = NOW()
      WHERE user_id = $1
      RETURNING *;
    `;

    const { rows } = await query(sql, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    return res.status(200).json({
      status: "success",
      message: "User activated successfully",
    });
  } catch (err) {
    console.error("Activate error:", err);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
}


export async function verifyEmail(req, res) {
  try {
    const { id } = req.params;

    const sql = `
      UPDATE public.users
      SET email_verified = true
      WHERE user_id = $1
      RETURNING *;
    `;

    const { rows } = await query(sql, [id]);

    if (!rows.length) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    return res.json({ status: "success", message: "Email verified" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "error" });
  }
}



export async function verifyPhone(req, res) {
  try {
    const { id } = req.params;

    const sql = `
      UPDATE public.users
      SET phone_verified = true
      WHERE user_id = $1
      RETURNING *;
    `;

    const { rows } = await query(sql, [id]);

    if (!rows.length) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    return res.json({ status: "success", message: "Phone verified" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "error" });
  }
}


export async function changePassword(req, res) {
  try {
    const { id } = req.params;
    const { old_password, new_password } = req.body;

    const { rows } = await query("SELECT password_hash FROM public.users WHERE user_id = $1", [id]);
    if (!rows.length) return res.status(404).json({ message: "User not found" });

    const oldHash = crypto.createHash("sha256").update(old_password).digest("hex");

    if (oldHash !== rows[0].password_hash) {
      return res.status(401).json({ message: "Old password incorrect" });
    }

    const newHash = crypto.createHash("sha256").update(new_password).digest("hex");

    await query("UPDATE public.users SET password_hash = $1 WHERE user_id = $2", [newHash, id]);

    return res.json({ status: "success", message: "Password changed" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "error" });
  }
}


export async function getUserBySchoolId(req, res) {
  try {
    const { school_id } = req.params;          // from /school/:school_id
    const { role } = req.params;          // from /school/:school_id
    // const schoolId = Number(school_id);     // optional: if you want it as number

    const sql = `
      SELECT 
        u.user_id,
        u.school_id,
        u.branch_id,
        u.username,
        u.email,
        u.phone,
        u.full_name,
        u.role,
        u.gender,
        u.is_active,
        u.created_at,

        -- school related
        s.school_code,
        s.school_name,
        s.city      AS school_city,
        s.state     AS school_state,
        s.pincode   AS school_pincode,
        s.board_type,

        -- branch related
        b.branch_code,
        b.branch_name,
        b.city      AS branch_city,
        b.state     AS branch_state,
        b.pincode   AS branch_pincode,
        b.is_main_branch

      FROM public.users u
      JOIN public.schools s
        ON u.school_id = s.school_id
      LEFT JOIN public.branches b
        ON u.branch_id = b.branch_id
       AND b.school_id = u.school_id
      WHERE u.school_id = $1 and u.role = $2;
    `;

    // ❌ was [id] – id is not defined
    const { rows } = await query(sql, [school_id, role]);

    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No users found for this school",
      });
    }

    return res.status(200).json({
      status: "success",
      users: rows,          // ✅ return list, not only rows[0]
    });
  } catch (err) {
    console.error("Error fetching user:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
}


function generateOtp(len = 6) {
  return Math.floor(10 ** (len - 1) + Math.random() * 9 * 10 ** (len - 1)).toString();
}

const OTP_TTL_MINUTES = 10;
const OTP_TYPE_PASSWORD_RESET = "PASSWORD_RESET";

export async function sendPasswordResetOtp(req, res) {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ message: "phone is required" });
    }

    // 1) Find user by phone (phone is unique in users table)
    const userRes = await query(
      `SELECT user_id FROM public.users WHERE phone = $1`,
      [phone]
    );

    if (!userRes.rows.length) {
      return res.status(404).json({ message: "User with this phone not found" });
    }

    const userId = userRes.rows[0].user_id;
    const otp = generateOtp(6);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    // 2) Mark previous unused PASSWORD_RESET OTPs as used
    await query(
      `UPDATE public.users_otps
         SET is_used = true
       WHERE user_id = $1
         AND phone = $2
         AND otp_type = $3
         AND is_used = false`,
      [userId, phone, OTP_TYPE_PASSWORD_RESET]
    );

    // 3) Insert new OTP row
    await query(
      `INSERT INTO public.users_otps
         (user_id, phone, email, otp_code, otp_type, is_used,
          expires_at, attempts_count, max_attempts, ip_address)
       VALUES ($1,$2,NULL,$3,$4,false,$5,0,3,$6)`,
      [userId, phone, otp, OTP_TYPE_PASSWORD_RESET, expiresAt, req.ip || null]
    );

    // 4) Send SMS here (integrate your SMS provider)
    console.log(`Password reset OTP for ${phone}: ${otp}`);

    return res.json({
      status: "success",
      message: `OTP sent to registered mobile number : ${phone} is ${otp}`
    });
  } catch (err) {
    console.error("sendPasswordResetOtp error:", err);
    return res.status(500).json({ status: "error" });
  }
}

function hashPasswordSHA256(plain) {
  return crypto.createHash("sha256").update(plain).digest("hex");
}

export async function changePasswordWithOtp(req, res) {
  try {
    const { phone, otp, new_password } = req.body;

    if (!phone || !otp || !new_password) {
      return res
        .status(400)
        .json({ message: "phone, otp and new_password are required" });
    }

    // 1) Get latest valid OTP for this phone
    const otpRes = await query(
      `SELECT otp_id, user_id, attempts_count, max_attempts
         FROM public.users_otps
        WHERE phone = $1
          AND otp_code = $2
          AND otp_type = $3
          AND is_used = false
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1`,
      [phone, otp, OTP_TYPE_PASSWORD_RESET]
    );

    if (!otpRes.rows.length) {
      // optional: bump attempts on latest OTP for this phone/type
      await query(
        `UPDATE public.users_otps
            SET attempts_count = attempts_count + 1
          WHERE otp_id = (
            SELECT otp_id FROM public.users_otps
             WHERE phone = $1
               AND otp_type = $2
               AND is_used = false
             ORDER BY created_at DESC
             LIMIT 1
          )`,
        [phone, OTP_TYPE_PASSWORD_RESET]
      );

      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const { otp_id, user_id, attempts_count, max_attempts } = otpRes.rows[0];

    if (attempts_count >= max_attempts) {
      // mark used/blocked
      await query(
        `UPDATE public.users_otps
            SET is_used = true
          WHERE otp_id = $1`,
        [otp_id]
      );
      return res
        .status(400)
        .json({ message: "Maximum OTP attempts exceeded. Request a new OTP." });
    }

    const newHash = hashPasswordSHA256(new_password);

    // 2) Update password
    await query(
      `UPDATE public.users
          SET password_hash = $1
        WHERE user_id = $2`,
      [newHash, user_id]
    );

    // 3) Mark OTP used + increment attempts_count
    await query(
      `UPDATE public.users_otps
          SET is_used = true,
              attempts_count = attempts_count + 1
        WHERE otp_id = $1`,
      [otp_id]
    );

    return res.json({ status: "success", message: "Password changed" });
  } catch (err) {
    console.error("changePasswordWithOtp error:", err);
    return res.status(500).json({ status: "error" });
  }
}
