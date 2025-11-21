import { pool } from '../config/db.js';
import csv from 'csv-parser';
import fs from 'fs';

class ReportCardService {
  /**
   * Upload and process CSV file
   */
  async uploadAndProcessCSV(filePath, schoolId, yearId, term, uploadedBy = 1) {
    const startTime = Date.now();
    const validRecords = [];
    const errors = [];
    let recordCount = 0;

    console.log('=== Starting CSV Processing ===');
    console.log(`File: ${filePath}`);
    console.log(`School ID: ${schoolId}, Year ID: ${yearId}, Term: ${term}`);

    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath)
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/\s+/g, '_'),
        }))
        .on('data', (row) => {
          recordCount++;

          // Limit to 1000 records
          if (recordCount > 1000) {
            stream.destroy();
            reject(new Error('CSV exceeds maximum limit of 1000 student records'));
            return;
          }

          // Validate row
          const validationError = this.validateCSVRow(row, recordCount);
          if (validationError) {
            errors.push(validationError);
          } else {
            validRecords.push({
              student_id: parseInt(row.student_id),
              student_name: row.student_name.trim(),
              subject: row.subject.trim(),
              marks: parseFloat(row.marks),
              max_marks: parseFloat(row.max_marks),
              internal_marks: parseFloat(row.internal_marks) || 0,
              external_marks: parseFloat(row.external_marks) || 0,
              teacher_remarks: row.teacher_remarks ? row.teacher_remarks.trim() : '',
            });
          }
        })
        .on('end', async () => {
          const processingTime = (Date.now() - startTime) / 1000;

          console.log(`CSV parsing completed in ${processingTime.toFixed(2)}s`);
          console.log(`Total rows: ${recordCount}`);
          console.log(`Valid records: ${validRecords.length}`);
          console.log(`Error records: ${errors.length}`);

          if (processingTime > 30) {
            return reject(new Error(`Processing took ${processingTime.toFixed(2)}s, exceeds 30s limit`));
          }

          if (validRecords.length === 0) {
            return reject(new Error('No valid records found in CSV'));
          }

          try {
            const result = await this.insertReportCardData(
              validRecords,
              schoolId,
              yearId,
              term,
              uploadedBy
            );

            resolve({
              success: true,
              totalRecords: recordCount,
              validRecords: validRecords.length,
              errorRecords: errors.length,
              errors: errors,
              processingTime: parseFloat(processingTime.toFixed(2)),
              ...result,
            });
          } catch (dbError) {
            console.error('Database insertion error:', dbError);
            reject(dbError);
          }
        })
        .on('error', (error) => {
          console.error('CSV parsing error:', error);
          reject(new Error(`CSV parsing error: ${error.message}`));
        });
    });
  }

  /**
   * Validate CSV row
   */
  validateCSVRow(row, rowNumber) {
    const errors = [];

    if (!row.student_id || isNaN(row.student_id)) {
      errors.push('Invalid or missing student_id');
    }
    if (!row.student_name || row.student_name.trim() === '') {
      errors.push('Missing student_name');
    }
    if (!row.subject || row.subject.trim() === '') {
      errors.push('Missing subject');
    }
    if (row.marks === undefined || row.marks === '' || isNaN(row.marks)) {
      errors.push('Invalid or missing marks');
    }
    if (row.max_marks === undefined || row.max_marks === '' || isNaN(row.max_marks)) {
      errors.push('Invalid or missing max_marks');
    }
    if (row.marks && row.max_marks && parseFloat(row.marks) > parseFloat(row.max_marks)) {
      errors.push('Marks cannot exceed max_marks');
    }

    if (errors.length > 0) {
      return {
        row: rowNumber,
        student_id: row.student_id,
        student_name: row.student_name,
        subject: row.subject,
        errors: errors,
      };
    }

    return null;
  }

  /**
   * Insert data into database - ALL SNAKE_CASE
   */
  async insertReportCardData(records, schoolId, yearId, term, uploadedBy) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      console.log('=== Starting Database Insertion ===');

      const studentGroups = this.groupByStudent(records);
      let totalInserted = 0;
      const reportIds = [];
      const studentDetails = [];
      const skippedStudents = [];

      for (const [studentId, subjects] of Object.entries(studentGroups)) {
        console.log(`\nProcessing Student ID: ${studentId}`);

        // FIXED: All column names are snake_case
        const studentQuery = `
          SELECT 
            s.student_id, 
            s.full_name, 
            se.section_id, 
            sec.class_id,
            c.class_name,
            sec.section_name
          FROM students s
          JOIN student_enrollments se ON s.student_id = se.student_id
          JOIN sections sec ON se.section_id = sec.section_id
          JOIN classes c ON sec.class_id = c.class_id
          WHERE s.student_id = $1 
            AND s.school_id = $2 
            AND se.year_id = $3 
            AND se.is_active = true
          LIMIT 1
        `;

        const studentResult = await client.query(studentQuery, [studentId, schoolId, yearId]);

        if (studentResult.rows.length === 0) {
          console.warn(`⚠ Student ID ${studentId} not found or not enrolled`);
          skippedStudents.push({
            studentId: studentId,
            reason: 'Student not found or not enrolled',
          });
          continue;
        }

        const student = studentResult.rows[0];
        // FIXED: Use snake_case property names
        console.log(`  Found: ${student.full_name} (${student.class_name}-${student.section_name})`);

        // FIXED: Create report card with snake_case columns
        const reportCardQuery = `
          INSERT INTO report_cards (
            student_id, year_id, term, class_id, section_id, 
            status, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, 'DRAFT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (student_id, year_id, term) 
          DO UPDATE SET updated_at = CURRENT_TIMESTAMP, status = 'DRAFT'
          RETURNING report_id
        `;

        const reportCardResult = await client.query(reportCardQuery, [
          studentId, yearId, term, student.class_id, student.section_id,
        ]);

        // FIXED: report_id not reportid
        const reportId = reportCardResult.rows[0].report_id;
        reportIds.push(reportId);
        console.log(`  Report Card ID: ${reportId}`);

        // FIXED: Insert subjects with snake_case columns
        let subjectsInserted = 0;
        for (const subject of subjects) {
          const percentage = subject.max_marks > 0 
            ? ((subject.marks / subject.max_marks) * 100).toFixed(2) 
            : 0;

          const grade = this.calculateGrade(percentage);

          const subjectQuery = `
            INSERT INTO report_card_subjects (
              report_id, subject_name, internal_marks, external_marks, 
              total_marks, max_marks, percentage, grade, subject_teacher, teacher_remarks
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (report_id, subject_name) 
            DO UPDATE SET 
              internal_marks = EXCLUDED.internal_marks,
              external_marks = EXCLUDED.external_marks,
              total_marks = EXCLUDED.total_marks,
              max_marks = EXCLUDED.max_marks,
              percentage = EXCLUDED.percentage,
              grade = EXCLUDED.grade,
              subject_teacher = EXCLUDED.subject_teacher,
              teacher_remarks = EXCLUDED.teacher_remarks
              
          `;

          await client.query(subjectQuery, [
            reportId, subject.subject, subject.internal_marks,
            subject.external_marks, subject.marks, subject.max_marks,
            percentage, grade, subject.subject_teacher || null,
            subject.teacher_remarks || null,
          ]);

          subjectsInserted++;
          totalInserted++;
          console.log(`    ✓ ${subject.subject}: ${subject.marks}/${subject.max_marks} (${percentage}% - ${grade})`);
        }

        // Calculate overall percentage
        await this.updateOverallPercentage(client, reportId);

        // FIXED: overall_percentage not overallpercentage
        const overallQuery = 'SELECT overall_percentage FROM report_cards WHERE report_id = $1';
        const overallResult = await client.query(overallQuery, [reportId]);
        const overallPercentage = overallResult.rows[0].overall_percentage;

        console.log(`  Overall: ${parseFloat(overallPercentage).toFixed(2)}%`);

        studentDetails.push({
          studentId: studentId,
          studentName: student.full_name,
          class: `${student.class_name}-${student.section_name}`,
          reportId: reportId,
          subjectsCount: subjectsInserted,
          overallPercentage: parseFloat(overallPercentage).toFixed(2),
        });
      }

      await client.query('COMMIT');
      console.log('\n✅ Database transaction committed successfully');

      return {
        reportIds,
        insertedSubjects: totalInserted,
        reportCardsCreated: reportIds.length,
        studentDetails,
        skippedStudents,
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Database error:', error.message);
      throw new Error(`Database error: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Update overall percentage - FIXED snake_case
   */
  async updateOverallPercentage(client, reportId) {
    const query = `
      WITH totals AS (
        SELECT 
          SUM(total_marks) as total_obtained,
          SUM(max_marks) as total_max
        FROM report_card_subjects
        WHERE report_id = $1
      )
      UPDATE report_cards
      SET 
        overall_percentage = CASE 
          WHEN (SELECT total_max FROM totals) > 0 
          THEN ROUND(((SELECT total_obtained FROM totals)::DECIMAL / (SELECT total_max FROM totals) * 100), 2)
          ELSE 0 
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE report_id = $1
    `;

    await client.query(query, [reportId]);
  }

  /**
   * Calculate grade
   */
  calculateGrade(percentage) {
    const pct = parseFloat(percentage);
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 40) return 'D';
    return 'F';
  }

  /**
   * Group by student
   */
  groupByStudent(records) {
    return records.reduce((acc, record) => {
      if (!acc[record.student_id]) {
        acc[record.student_id] = [];
      }
      acc[record.student_id].push(record);
      return acc;
    }, {});
  }

  /**
   * Get students with uploaded marks - FIXED snake_case
   */
  async getStudentsWithMarks(schoolId, yearId, term) {
    const query = `
      SELECT 
        rc.report_id,
        rc.student_id,
        s.full_name as student_name,
        s.admission_number,
        c.class_name,
        sec.section_name,
        rc.overall_percentage,
        rc.status,
        COUNT(rcs.subject_id) as subjects_count,
        rc.created_at,
        rc.updated_at
      FROM report_cards rc
      JOIN students s ON rc.student_id = s.student_id
      JOIN classes c ON rc.class_id = c.class_id
      JOIN sections sec ON rc.section_id = sec.section_id
      LEFT JOIN report_card_subjects rcs ON rc.report_id = rcs.report_id
      WHERE s.school_id = $1 AND rc.year_id = $2 AND rc.term = $3
      GROUP BY 
        rc.report_id, 
        rc.student_id, 
        s.full_name, 
        s.admission_number,
        c.class_name, 
        sec.section_name, 
        rc.overall_percentage, 
        rc.status, 
        rc.created_at, 
        rc.updated_at,
        c.class_order
      ORDER BY c.class_order, sec.section_name, s.full_name
    `;

    const result = await pool.query(query, [schoolId, yearId, term]);
    return result.rows;
  }
}

export default new ReportCardService();
