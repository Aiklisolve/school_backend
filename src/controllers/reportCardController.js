import reportCardService from '../services/reportCardService.js';
import pool from '../config/db.js';
import fs from 'fs';

class ReportCardController {
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
          rc.reportid,
          rc.studentid,
          s.fullname as student_name,
          s.admissionnumber,
          c.classname,
          sec.sectionname,
          rc.overallpercentage,
          rc.status,
          rc.publishedat,
          rc.createdat,
          rc.updatedat
        FROM report_cards rc
        JOIN students s ON rc.studentid = s.studentid
        JOIN classes c ON rc.classid = c.classid
        JOIN sections sec ON rc.sectionid = sec.sectionid
        WHERE s.schoolid = $1 AND rc.yearid = $2 AND rc.term = $3
      `;

      const params = [parseInt(schoolId), parseInt(yearId), term.toUpperCase()];

      if (classId) {
        params.push(parseInt(classId));
        query += ` AND rc.classid = $${params.length}`;
      }

      if (sectionId) {
        params.push(parseInt(sectionId));
        query += ` AND rc.sectionid = $${params.length}`;
      }

      query += ` ORDER BY c.classorder, sec.sectionname, s.fullname`;

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

  async deleteReportCard(req, res) {
    try {
      const { reportId } = req.params;

      if (!reportId || isNaN(reportId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reportId parameter',
        });
      }

      const checkQuery = 'SELECT status FROM report_cards WHERE reportid = $1';
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

      await pool.query('DELETE FROM report_card_subjects WHERE reportid = $1', [parseInt(reportId)]);
      await pool.query('DELETE FROM report_cards WHERE reportid = $1', [parseInt(reportId)]);

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
}

export default new ReportCardController();
