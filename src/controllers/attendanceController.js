import attendanceUploadService from '../services/attendanceUploadService.js';
import fs from 'fs';

class AttendanceController {
  /**
   * Upload attendance CSV
   */
  async uploadAttendanceCSV(req, res) {
    try {
      console.log('=== Attendance CSV Upload ===');

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No CSV file uploaded',
        });
      }

      console.log(`File: ${req.file.originalname} (${req.file.size} bytes)`);

      const result = await attendanceUploadService.processAttendanceCSV(req.file.path);

      // Clean up file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.log('=== Attendance CSV Upload Completed ===');

      if (result.errors && result.errors.length > 0) {
        return res.status(207).json({
          success: true,
          message: 'Attendance uploaded with some errors',
          data: result,
        });
      }

      return res.status(200).json({
        success: true,
        message: `Successfully uploaded attendance for ${result.insertedRecords} students`,
        data: result,
      });

    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.error('❌ Error in uploadAttendanceCSV:', error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

/**
 * Get student attendance summary
 */
async getStudentSummary(req, res) {
  try {
    const { studentId } = req.params;
    const { yearId, month } = req.query;

    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid studentId',
      });
    }

    const summary = await attendanceUploadService.getStudentAttendanceSummary(
      parseInt(studentId),
      yearId ? parseInt(yearId) : null,
      month ? parseInt(month) : null
    );

    return res.status(200).json({
      success: true,
      data: {
        studentId: parseInt(studentId),
        summary,
      },
    });

  } catch (error) {
    console.error('Error in getStudentSummary:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}


  /**
   * Get student attendance records
   */
  async getStudentAttendance(req, res) {
    try {
      const { studentId } = req.params;
      const { startDate, endDate } = req.query;

      if (!studentId || isNaN(studentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid studentId',
        });
      }

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'startDate and endDate are required',
        });
      }

      const attendance = await attendanceUploadService.getStudentAttendance(
        parseInt(studentId),
        startDate,
        endDate
      );

      return res.status(200).json({
        success: true,
        data: {
          studentId: parseInt(studentId),
          startDate,
          endDate,
          records: attendance,
        },
      });

    } catch (error) {
      console.error('Error in getStudentAttendance:', error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get class attendance for a specific date
   */
  async getClassAttendance(req, res) {
    try {
      const { schoolId, classId, sectionId, date } = req.query;

      if (!schoolId || !classId || !sectionId || !date) {
        return res.status(400).json({
          success: false,
          message: 'schoolId, classId, sectionId, and date are required',
        });
      }

      const attendance = await attendanceUploadService.getClassAttendance(
        parseInt(schoolId),
        parseInt(classId),
        parseInt(sectionId),
        date
      );

      return res.status(200).json({
        success: true,
        data: {
          schoolId: parseInt(schoolId),
          classId: parseInt(classId),
          sectionId: parseInt(sectionId),
          date,
          students: attendance,
          summary: {
            total: attendance.length,
            present: attendance.filter(s => s.status === 'PRESENT').length,
            absent: attendance.filter(s => s.status === 'ABSENT').length,
            late: attendance.filter(s => s.status === 'LATE').length,
            notMarked: attendance.filter(s => !s.status).length,
          },
        },
      });

    } catch (error) {
      console.error('Error in getClassAttendance:', error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Health check
   */
  async healthCheck(req, res) {
    try {
      const { pool: dbPool } = await import('../config/db.js');
      
      await dbPool.query('SELECT 1');

      const attendanceCount = await dbPool.query('SELECT COUNT(*) FROM attendance');
      const summaryCount = await dbPool.query('SELECT COUNT(*) FROM attendance_summary');

      return res.status(200).json({
        success: true,
        message: 'Attendance service is running',
        timestamp: new Date().toISOString(),
        database: {
          connected: true,
          attendanceRecords: parseInt(attendanceCount.rows[0].count),
          summaryRecords: parseInt(summaryCount.rows[0].count),
        },
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Service health check failed',
        error: error.message,
      });
    }
  }
}

export default new AttendanceController();
