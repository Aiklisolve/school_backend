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

      WHERE u.user_id = $1;
    `;

    const { rows } = await query(sql, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    return res.status(200).json({
      status: "success",
      user: rows[0],
    });
  } catch (err) {
    console.error("Error fetching user:", err);
    return res.status(500).json({ status: "error", message: "Internal server error" });
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
      WHERE u.school_id = $1;
    `;

    // ❌ was [id] – id is not defined
    const { rows } = await query(sql, [school_id]);

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
