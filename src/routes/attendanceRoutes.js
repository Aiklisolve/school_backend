import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import attendanceController from '../controllers/attendanceController.js';

const router = express.Router();

// Get __dirname in ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// DIRECTORY SETUP
// ============================================

const uploadDir = path.join(__dirname, '../../uploads/attendance');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`✓ Created directory: ${uploadDir}`);
}

// ============================================
// MULTER CONFIGURATION
// ============================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = 'attendance-' + uniqueSuffix + path.extname(file.originalname);
    // console.log(`Saving file as: ${filename}`);
    cb(null, filename);
  },
});

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv') {
      console.error(`Rejected file: ${file.originalname}`);
      return cb(new Error('Only CSV files are allowed'));
    }
    // console.log(`Accepted file: ${file.originalname}`);
    cb(null, true);
  },
});

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.',
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};

// ============================================
// UPLOAD ROUTES
// ============================================

/**
 * @route   POST /api/attendance/upload
 * @desc    Upload attendance CSV
 * @access  Teacher/Admin
 */
router.post(
  '/upload',
  upload.single('csvFile'),
  handleMulterError,
  attendanceController.uploadAttendanceCSV
);

// ============================================
// GET ROUTES
// ============================================

/**
 * @route   GET /api/attendance/student/:studentId/summary
 * @desc    Get attendance summary for a student
 * @access  Teacher/Admin/Parent
 * @query   year (optional), month (optional)
 */
router.get(
  '/student/:studentId/summary',
  attendanceController.getStudentSummary
);

/**
 * @route   GET /api/attendance/student/:studentId
 * @desc    Get attendance records for a student
 * @access  Teacher/Admin/Parent
 * @query   startDate (required), endDate (required)
 */
router.get(
  '/student/:studentId',
  attendanceController.getStudentAttendance
);

/**
 * @route   GET /api/attendance/class
 * @desc    Get class attendance for a specific date
 * @access  Teacher/Admin
 * @query   schoolId, classId, sectionId, date (all required)
 */
router.get(
  '/class',
  attendanceController.getClassAttendance
);

/**
 * @route   GET /api/attendance/health
 * @desc    Health check
 * @access  Public
 */
router.get(
  '/health',
  attendanceController.healthCheck
);

// ============================================
// INFO ENDPOINT
// ============================================

/**
 * @route   GET /api/attendance/info
 * @desc    Get information about the attendance service
 * @access  Public
 */
router.get('/info', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'Attendance Management',
    version: '1.0.0',
    description: 'Upload and manage student attendance records',
    endpoints: {
      upload: {
        method: 'POST',
        path: '/api/attendance/upload',
        description: 'Upload attendance CSV',
        parameters: {
          csvFile: 'CSV file (multipart/form-data)',
        },
      },
      studentSummary: {
        method: 'GET',
        path: '/api/attendance/student/:studentId/summary',
        description: 'Get attendance summary for a student',
        query: {
          year: 'Year (optional)',
          month: 'Month 1-12 (optional)',
        },
      },
      studentAttendance: {
        method: 'GET',
        path: '/api/attendance/student/:studentId',
        description: 'Get attendance records for a student',
        query: {
          startDate: 'Start date YYYY-MM-DD (required)',
          endDate: 'End date YYYY-MM-DD (required)',
        },
      },
      classAttendance: {
        method: 'GET',
        path: '/api/attendance/class',
        description: 'Get class attendance for a specific date',
        query: {
          schoolId: 'School ID (required)',
          classId: 'Class ID (required)',
          sectionId: 'Section ID (required)',
          date: 'Date YYYY-MM-DD (required)',
        },
      },
      health: {
        method: 'GET',
        path: '/api/attendance/health',
        description: 'Service health check',
      },
    },
    csvFormat: {
      requiredColumns: [
        'student_id',
        'date',
        'status',
      ],
      optionalColumns: [
        'remarks',
        'marked_by',
        'check_in_time',
        'check_out_time',
      ],
      validStatuses: [
        'PRESENT',
        'ABSENT',
        'LATE',
        'HALF_DAY',
        'SICK_LEAVE',
        'EXCUSED',
      ],
      dateFormat: 'YYYY-MM-DD',
      timeFormat: 'HH:MM:SS',
    },
  });
});

// console.log('✅ Attendance routes loaded');

export default router;