import reportCardService from '../services/reportCardService.js';
import { pool } from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfGeneratorService from '../services/pdfGeneratorService.js';

// Get __dirname in ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ReportCardController {
  /**
   * Upload CSV
   */
  async uploadCSV(req, res) {
    try {
      console.log('=== CSV Upload Request Received ===');
      
      const { schoolId, yearId, term } = req.body;
      const uploadedBy = req.user?.userid || 1;

      console.log(`School: ${schoolId}, Year: ${yearId}, Term: ${term}`);

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No CSV file uploaded. Please attach a CSV file.',
        });
      }

      console.log(`File received: ${req.file.originalname} (${req.file.size} bytes)`);

      if (!schoolId || !yearId || !term) {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(400).json({
          success: false,
          message: 'Missing required parameters: schoolId, yearId, term',
        });
      }

      const validTerms = ['TERM1', 'TERM2', 'ANNUAL'];
      if (!validTerms.includes(term.toUpperCase())) {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(400).json({
          success: false,
          message: `Invalid term. Must be one of: ${validTerms.join(', ')}`,
        });
      }

      const uploadResult = await reportCardService.uploadAndProcessCSV(
        req.file.path,
        parseInt(schoolId),
        parseInt(yearId),
        term.toUpperCase(),
        uploadedBy
      );

      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.log('=== CSV Upload Completed ===');

      if (uploadResult.errorRecords > 0) {
        return res.status(207).json({
          success: true,
          message: 'CSV processed with some validation errors',
          data: uploadResult,
        });
      }

      return res.status(200).json({
        success: true,
        message: 'CSV uploaded successfully. All data inserted into database.',
        data: uploadResult,
      });

    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.error('❌ Error in uploadCSV:', error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get uploaded marks
   */
  async getUploadedMarks(req, res) {
    try {
      const { schoolId, yearId, term } = req.query;

      if (!schoolId || !yearId || !term) {
        return res.status(400).json({
          success: false,
          message: 'Missing required query parameters: schoolId, yearId, term',
        });
      }

      const students = await reportCardService.getStudentsWithMarks(
        parseInt(schoolId),
        parseInt(yearId),
        term.toUpperCase()
      );

      return res.status(200).json({
        success: true,
        message: `Found ${students.length} students with uploaded marks`,
        data: {
          total: students.length,
          students: students,
        },
      });

    } catch (error) {
      console.error('Error in getUploadedMarks:', error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get report card details
   */
  async getReportCardDetails(req, res) {
    try {
      const { reportId } = req.params;

      if (!reportId || isNaN(reportId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reportId parameter',
        });
      }

      const details = await reportCardService.getReportCardDetails(parseInt(reportId));

      return res.status(200).json({
        success: true,
        data: details,
      });

    } catch (error) {
      console.error('Error in getReportCardDetails:', error);
      
      if (error.message === 'Report card not found') {
        return res.status(404).json({
          success: false,
          message: 'Report card not found',
        });
      }

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * List report cards
   */
  async listReportCards(req, res) {
    try {
      const { schoolId, yearId, term, classId, sectionId } = req.query;

      if (!schoolId || !yearId || !term) {
        return res.status(400).json({
          success: false,
          message: 'Missing required query parameters: schoolId, yearId, term',
        });
      }

      let query = `
        SELECT 
          rc.report_id,
          rc.student_id,
          s.full_name as student_name,
          s.admission_number,
          c.class_name,
          sec.section_name,
          rc.overall_percentage,
          rc.status,
          rc.published_at,
          rc.created_at,
          rc.updated_at
        FROM report_cards rc
        JOIN students s ON rc.student_id = s.student_id
        JOIN classes c ON rc.class_id = c.class_id
        JOIN sections sec ON rc.section_id = sec.section_id
        WHERE s.school_id = $1 AND rc.year_id = $2 AND rc.term = $3
      `;

      const params = [parseInt(schoolId), parseInt(yearId), term.toUpperCase()];

      if (classId) {
        params.push(parseInt(classId));
        query += ` AND rc.class_id = $${params.length}`;
      }

      if (sectionId) {
        params.push(parseInt(sectionId));
        query += ` AND rc.section_id = $${params.length}`;
      }

      query += ` ORDER BY c.class_order, sec.section_name, s.full_name`;

      const result = await pool.query(query, params);

      return res.status(200).json({
        success: true,
        data: {
          total: result.rows.length,
          reportCards: result.rows,
        },
      });

    } catch (error) {
      console.error('Error in listReportCards:', error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Delete report card (DRAFT only)
   */
  async deleteReportCard(req, res) {
    try {
      const { reportId } = req.params;

      if (!reportId || isNaN(reportId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reportId parameter',
        });
      }

      const checkQuery = 'SELECT status FROM report_cards WHERE report_id = $1';
      const checkResult = await pool.query(checkQuery, [parseInt(reportId)]);

      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Report card not found',
        });
      }

      if (checkResult.rows[0].status !== 'DRAFT') {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete published report cards. Only DRAFT status can be deleted.',
        });
      }

      await pool.query('DELETE FROM report_card_subjects WHERE report_id = $1', [parseInt(reportId)]);
      await pool.query('DELETE FROM report_cards WHERE report_id = $1', [parseInt(reportId)]);

      return res.status(200).json({
        success: true,
        message: 'Report card deleted successfully',
      });

    } catch (error) {
      console.error('Error in deleteReportCard:', error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Download report card as PDF
   */
  async downloadReportCard(req, res) {
    try {
      const { reportId } = req.params;

      if (!reportId || isNaN(reportId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reportId',
        });
      }

      console.log(`Generating PDF for report ID: ${reportId}`);

      // Get report card data
      const reportQuery = `
        SELECT 
          rc.report_id,
          rc.student_id,
          s.full_name,
          s.admission_number,
          s.date_of_birth,
          c.class_name,
          sec.section_name,
          rc.overall_percentage,
          rc.status,
          rc.year_id,
          rc.term
        FROM report_cards rc
        JOIN students s ON rc.student_id = s.student_id
        JOIN classes c ON rc.class_id = c.class_id
        JOIN sections sec ON rc.section_id = sec.section_id
        WHERE rc.report_id = $1
      `;

      const reportResult = await pool.query(reportQuery, [parseInt(reportId)]);

      if (reportResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Report card not found',
        });
      }

      const report = reportResult.rows[0];

      // Get subjects
      const subjectsQuery = `
        SELECT 
          subject_name,
          internal_marks,
          external_marks,
          total_marks,
          max_marks,
          percentage,
          grade
        FROM report_card_subjects
        WHERE report_id = $1
        ORDER BY subject_name
      `;

      const subjectsResult = await pool.query(subjectsQuery, [parseInt(reportId)]);

      // Prepare data for PDF
      const pdfData = {
        school: {
          name: 'Your School Name', // TODO: Get from database
        },
        student: {
          full_name: report.full_name,
          admission_number: report.admission_number,
          class_name: report.class_name,
          section_name: report.section_name,
          date_of_birth: report.date_of_birth,
          year_id: report.year_id,
          term: report.term,
        },
        subjects: subjectsResult.rows,
        overall: {
          overall_percentage: report.overall_percentage,
        },
        term: report.term,
      };

      // Create PDF
      const pdfPath = path.join(
        __dirname,
        `../../uploads/report_cards/report-card-${report.student_id}-${report.year_id}-${report.term}.pdf`
      );

      await pdfGeneratorService.generateReportCardPDF(pdfData, pdfPath);

      console.log(`PDF generated successfully: ${pdfPath}`);

      // Send file
      res.download(pdfPath, `Report-Card-${report.full_name}-${report.term}.pdf`, (err) => {
        if (err) {
          console.error('Download error:', err);
        }
        // Optionally delete file after download
        // fs.unlinkSync(pdfPath);
      });

    } catch (error) {
      console.error('Error in downloadReportCard:', error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default new ReportCardController();
