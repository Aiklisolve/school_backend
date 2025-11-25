// src/controllers/parentController.js
import validator from "validator";
import { query } from "../config/db.js";

export async function registerParent(req, res) {
  try {
    const {
      school_id,
      full_name,
      phone,
      whatsapp_number,
      email,
      occupation,
      annual_income_range,
      education_level,
      address_line1,
      address_line2,
      city,
      state,
      pincode,
      user_id
    } = req.body;

    // 1. Required validation
    if (!school_id || !full_name || !phone || !user_id) {
      return res.status(400).json({
        status: "error",
        message: "school_id, full_name and phone are required"
      });
    }

    // 2. Email validation (optional field)
    if (email && !validator.isEmail(email)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid email format"
      });
    }

    // 3. Phone validation (basic, optional)
    // if (!validator.isMobilePhone(phone, 'any')) {
    //   return res.status(400).json({
    //     status: "error",
    //     message: "Invalid phone number"
    //   });
    // }

    // Accepts: +91XXXXXXXXXX, +91 XXXXX XXXXX, 9876543210
    const phoneClean = phone.replace(/[\s-]/g, "");

    const phoneRegex = /^(\+?\d{1,3})?\d{10}$/;

    if (!phoneRegex.test(phoneClean)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid phone number"
      });
    }


    // 4. Insert into DB
    const insertSql = `
      INSERT INTO public.parents (
        school_id,
        full_name,
        phone,
        whatsapp_number,
        email,
        occupation,
        annual_income_range,
        education_level,
        address_line1,
        address_line2,
        city,
        state,
        pincode,
        is_active,
        user_id
      )
      VALUES (
        $1, $2, $3, $4, $5, 
        $6, $7, $8,
        $9, $10, $11,
        $12, $13, true, $14
      )
      RETURNING parent_id, school_id, full_name, phone, email, is_active, created_at, user_id;
    `;

    const params = [
      school_id,
      full_name,
      phone,
      whatsapp_number || null,
      email || null,
      occupation || null,
      annual_income_range || null,
      education_level || null,
      address_line1 || null,
      address_line2 || null,
      city || null,
      state || null,
      pincode || null,
      user_id
    ];

    const { rows } = await query(insertSql, params);
    const parent = rows[0];

    return res.status(201).json({
      status: "success",
      message: "Parent registered successfully",
      data: parent
    });

  } catch (err) {
    console.error("Parent registration error:", err);

    // UNIQUE VIOLATION (phone)
    if (err.code === "23505") {
      if (err.constraint === "parents_phone_key") {
        return res.status(409).json({
          status: "error",
          message: "Phone number already exists"
        });
      }
    }

    // FOREIGN KEY VIOLATION
    if (err.code === "23503") {
      return res.status(400).json({
        status: "error",
        message: "Invalid school_id (foreign key violation)"
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
}

// src/controllers/parentController.js

export async function getParentsBySchoolId(req, res) {
  try {
    const { school_id } = req.params;

    if (!school_id) {
      return res.status(400).json({
        status: "error",
        message: "school_id is required"
      });
    }

    const sql = `
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
        p.address_line1,
        p.address_line2,
        p.city,
        p.state,
        p.pincode,
        p.is_active,
        p.created_at,

        -- school details
        s.school_code,
        s.school_name,
        s.city  AS school_city,
        s.state AS school_state,
        s.pincode AS school_pincode

      FROM public.parents p
      JOIN public.schools s
        ON p.school_id = s.school_id
      WHERE p.school_id = $1
      ORDER BY p.parent_id DESC;
    `;

    const { rows } = await query(sql, [school_id]);

    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No parents found for this school"
      });
    }

    return res.status(200).json({
      status: "success",
      data: rows
    });

  } catch (err) {
    console.error("Get parents error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
}
