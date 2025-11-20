// src/controllers/userController.js
import bcrypt from 'bcrypt';           // or 'bcryptjs' if you used that
import validator from 'validator';
import { query } from '../config/db.js';

const BCRYPT_ROUNDS = 10;
const ALLOWED_ROLES = ['PRINCIPAL', 'TEACHER', 'PARENT', 'ADMIN','STUDENT'];
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
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

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
