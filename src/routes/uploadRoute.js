// src/routes/uploadRoute.js
import express from "express";
import multer from "multer";
import csv from "csv-parser";
import fs from "fs";
import { pool } from "../config/db.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // temp folder

// POST /api/upload/teacher_assignments
router.post("/upload/:tableName", upload.single("file"), async (req, res) => {
  try {
    const { tableName } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded. Field name must be 'file'." });
    }

    const filePath = req.file.path;
    const rows = [];

    // 1) Read CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (row) => rows.push(row))
        .on("end", resolve)
        .on("error", reject);
    });

    if (!rows.length) {
      return res.status(400).json({ message: "CSV is empty" });
    }

    // 2) Build INSERT
    const columns = Object.keys(rows[0]);
    const colList = columns.map((c) => `"${c}"`).join(", ");

    const values = [];
    const placeholders = [];

    rows.forEach((row) => {
      const ph = [];
      columns.forEach((c) => {
        values.push(row[c] === "" ? null : row[c]);
        ph.push(`$${values.length}`);
      });
      placeholders.push(`(${ph.join(", ")})`);
    });

    const sql = `
      INSERT INTO public.${tableName} (${colList})
      VALUES ${placeholders.join(", ")}
    `;

    const result = await pool.query(sql, values);

    res.json({
      message: "Upload successful",
      table: tableName,
      rowsInserted: result.rowCount,
    });

    fs.unlink(filePath, () => {});
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
