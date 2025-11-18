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
      pincode
    } = req.body;

    // 1. Required validation
    if (!school_id || !full_name || !phone) {
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
    if (!validator.isMobilePhone(phone, 'any')) {
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
        is_active
      )
      VALUES (
        $1, $2, $3, $4, $5, 
        $6, $7, $8,
        $9, $10, $11,
        $12, $13, true
      )
      RETURNING parent_id, school_id, full_name, phone, email, is_active, created_at;
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
      pincode || null
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
