import { pool } from '../config/db.js';
import csv from 'csv-parser';
import fs from 'fs';

class AttendanceUploadService {
  /**
   * Process attendance CSV upload
   */
  async processAttendanceCSV(filePath) {
    const records = [];
    const errors = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv({ mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/\s+/g, '_') }))
        .on('data', (row) => {
          records.push(row);
        })
        .on('end', async () => {
          if (records.length === 0) {
            return reject(new Error('No records found in CSV'));
          }

          try {
            const result = await this.insertAttendanceRecords(records);
            resolve(result);
          } catch (dbError) {
            reject(dbError);
          }
        })
        .on('error', (error) => reject(error));
    });
  }

  /**
   * Insert attendance records
   */
  async insertAttendanceRecords(records) {
    const client = await pool.connect();
    
    const stats = {
      totalRecords: records.length,
      insertedRecords: 0,
      updatedRecords: 0,
      errors: [],
    };

    try {
      await client.query('BEGIN');

      for (const record of records) {
        try {
          // Validate required fields
          const validation = this.validateAttendanceRecord(record);
          if (!validation.valid) {
            stats.errors.push({
              row: record.student_id || 'unknown',
              errors: validation.errors,
            });
            continue;
          }

          // Get student's school_id and section_id
          const studentQuery = `
            SELECT 
              s.school_id,
              se.section_id
            FROM students s
            JOIN student_enrollments se ON s.student_id = se.student_id
            WHERE s.student_id = $1 AND se.is_active = true
            LIMIT 1
          `;
          
          const studentResult = await client.query(studentQuery, [parseInt(record.student_id)]);
          
          if (studentResult.rows.length === 0) {
            stats.errors.push({
              row: record.student_id,
              error: 'Student not found or no active enrollment',
            });
            continue;
          }

          const { school_id, section_id } = studentResult.rows[0];

          // Insert attendance record with all required columns
          const insertQuery = `
            INSERT INTO attendance (
              school_id, student_id, section_id, attendance_date,
              status, remarks, marked_by, check_in_time, check_out_time
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (student_id, attendance_date)
            DO UPDATE SET
              status = EXCLUDED.status,
              remarks = EXCLUDED.remarks,
              check_in_time = EXCLUDED.check_in_time,
              check_out_time = EXCLUDED.check_out_time,
              marked_by = EXCLUDED.marked_by,
              marked_at = CURRENT_TIMESTAMP
            RETURNING attendance_id, (xmax = 0) AS inserted
          `;

          const values = [
            school_id,
            parseInt(record.student_id),
            section_id,
            record.date || record.attendance_date,
            record.status.toUpperCase(),
            record.remarks || null,
            record.marked_by ? parseInt(record.marked_by) : null,
            record.check_in_time || null,
            record.check_out_time || null,
          ];

          const result = await client.query(insertQuery, values);
          
          if (result.rows[0].inserted) {
            stats.insertedRecords++;
          } else {
            stats.updatedRecords++;
          }

          console.log(`  ✓ Attendance for student ${record.student_id} on ${record.date || record.attendance_date}: ${record.status}`);

        } catch (error) {
          console.error(`  ✗ Failed to process attendance for student ${record.student_id}:`, error.message);
          stats.errors.push({
            row: record.student_id,
            error: error.message,
          });
        }
      }

      // Update attendance summaries
      await this.updateAttendanceSummaries(client);

      await client.query('COMMIT');
      console.log('\n✅ Attendance upload completed');

      return {
        success: true,
        ...stats,
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Attendance upload failed: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Validate attendance record
   */
  validateAttendanceRecord(record) {
    const errors = [];

    if (!record.student_id || isNaN(record.student_id)) {
      errors.push('Invalid or missing student_id');
    }

    const dateValue = record.date || record.attendance_date;
    if (!dateValue) {
      errors.push('Missing date');
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateValue)) {
        errors.push('Invalid date format. Use YYYY-MM-DD');
      }
    }

    if (!record.status) {
      errors.push('Missing status');
    } else {
      const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'SICK_LEAVE', 'EXCUSED'];
      if (!validStatuses.includes(record.status.toUpperCase())) {
        errors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

/**
 * Update attendance summaries - FIXED
 */
async updateAttendanceSummaries(client) {
  console.log('\n  Updating attendance summaries...');

  // Check if attendance_percentage is a generated column
  const checkColumnQuery = `
    SELECT is_generated 
    FROM information_schema.columns 
    WHERE table_name = 'attendance_summary' 
      AND column_name = 'attendance_percentage'
  `;
  
  const columnCheck = await client.query(checkColumnQuery);
  const isGenerated = columnCheck.rows[0]?.is_generated === 'ALWAYS';

  let summaryQuery;

  if (isGenerated) {
    // If attendance_percentage is generated, don't insert it
    summaryQuery = `
      INSERT INTO attendance_summary (
        student_id, year_id, month, total_school_days, 
        present_days, absent_days, late_days, half_days
      )
      SELECT 
        a.student_id,
        se.year_id,
        EXTRACT(MONTH FROM a.attendance_date)::INTEGER as month,
        COUNT(*) as total_school_days,
        COUNT(*) FILTER (WHERE a.status = 'PRESENT') as present_days,
        COUNT(*) FILTER (WHERE a.status = 'ABSENT') as absent_days,
        COUNT(*) FILTER (WHERE a.status = 'LATE') as late_days,
        COUNT(*) FILTER (WHERE a.status = 'HALF_DAY') as half_days
      FROM attendance a
      JOIN students s ON a.student_id = s.student_id
      JOIN student_enrollments se ON s.student_id = se.student_id AND se.is_active = true
      GROUP BY a.student_id, se.year_id, EXTRACT(MONTH FROM a.attendance_date)
      ON CONFLICT (student_id, year_id, month)
      DO UPDATE SET
        total_school_days = EXCLUDED.total_school_days,
        present_days = EXCLUDED.present_days,
        absent_days = EXCLUDED.absent_days,
        late_days = EXCLUDED.late_days,
        half_days = EXCLUDED.half_days,
        updated_at = CURRENT_TIMESTAMP
    `;
  } else {
    // If attendance_percentage is not generated, calculate it
    summaryQuery = `
      INSERT INTO attendance_summary (
        student_id, year_id, month, total_school_days, 
        present_days, absent_days, late_days, half_days, attendance_percentage
      )
      SELECT 
        a.student_id,
        se.year_id,
        EXTRACT(MONTH FROM a.attendance_date)::INTEGER as month,
        COUNT(*) as total_school_days,
        COUNT(*) FILTER (WHERE a.status = 'PRESENT') as present_days,
        COUNT(*) FILTER (WHERE a.status = 'ABSENT') as absent_days,
        COUNT(*) FILTER (WHERE a.status = 'LATE') as late_days,
        COUNT(*) FILTER (WHERE a.status = 'HALF_DAY') as half_days,
        ROUND(
          (COUNT(*) FILTER (WHERE a.status IN ('PRESENT', 'LATE'))::DECIMAL / COUNT(*)) * 100,
          2
        ) as attendance_percentage
      FROM attendance a
      JOIN students s ON a.student_id = s.student_id
      JOIN student_enrollments se ON s.student_id = se.student_id AND se.is_active = true
      GROUP BY a.student_id, se.year_id, EXTRACT(MONTH FROM a.attendance_date)
      ON CONFLICT (student_id, year_id, month)
      DO UPDATE SET
        total_school_days = EXCLUDED.total_school_days,
        present_days = EXCLUDED.present_days,
        absent_days = EXCLUDED.absent_days,
        late_days = EXCLUDED.late_days,
        half_days = EXCLUDED.half_days,
        attendance_percentage = EXCLUDED.attendance_percentage,
        updated_at = CURRENT_TIMESTAMP
    `;
  }

  try {
    await client.query(summaryQuery);
    console.log('  ✓ Attendance summaries updated');
  } catch (error) {
    console.error('  ⚠ Failed to update summaries:', error.message);
    // Don't throw - summaries are optional
  }
}

/**
 * Get attendance summary for a student
 */
async getStudentAttendanceSummary(studentId, yearId, month) {
  const query = `
    SELECT 
      ats.summary_id,
      ats.student_id,
      ats.year_id,
      ay.year_name,
      ats.month,
      ats.total_school_days,
      ats.present_days,
      ats.absent_days,
      ats.late_days,
      ats.half_days,
      ats.attendance_percentage,
      ats.updated_at
    FROM attendance_summary ats
    JOIN academic_years ay ON ats.year_id = ay.year_id
    WHERE ats.student_id = $1
      AND ($2::BIGINT IS NULL OR ats.year_id = $2)
      AND ($3::INTEGER IS NULL OR ats.month = $3)
    ORDER BY ay.start_date DESC, ats.month DESC
  `;

  const result = await pool.query(query, [studentId, yearId || null, month || null]);
  return result.rows;
}


  /**
   * Get attendance records for a student
   */
  async getStudentAttendance(studentId, startDate, endDate) {
    const query = `
      SELECT 
        attendance_id,
        student_id,
        attendance_date,
        status,
        remarks,
        check_in_time,
        check_out_time,
        marked_at
      FROM attendance
      WHERE student_id = $1
        AND attendance_date >= $2
        AND attendance_date <= $3
      ORDER BY attendance_date DESC
    `;

    const result = await pool.query(query, [studentId, startDate, endDate]);
    return result.rows;
  }

  /**
   * Get class attendance for a specific date
   */
  async getClassAttendance(schoolId, classId, sectionId, date) {
    const query = `
      SELECT 
        s.student_id,
        s.full_name,
        s.admission_number,
        a.status,
        a.remarks,
        a.check_in_time,
        a.check_out_time
      FROM students s
      JOIN student_enrollments se ON s.student_id = se.student_id
      LEFT JOIN attendance a ON s.student_id = a.student_id AND a.attendance_date = $4
      WHERE s.school_id = $1
        AND se.class_id = $2
        AND se.section_id = $3
        AND se.is_active = true
      ORDER BY s.full_name
    `;

    const result = await pool.query(query, [schoolId, classId, sectionId, date]);
    return result.rows;
  }
}

export default new AttendanceUploadService();
