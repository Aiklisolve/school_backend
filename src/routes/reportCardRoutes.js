import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import reportCardService from '../services/reportCardService.js';
import reportCardController from '../controllers/reportCardController.js';

const router = express.Router();

// Get __dirname in ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// DIRECTORY SETUP
// ============================================

const csvUploadDir = path.join(__dirname, '../../uploads/csv');
const pdfOutputDir = path.join(__dirname, '../../uploads/report_cards');

[csvUploadDir, pdfOutputDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created directory: ${dir}`);
  }
});

// ============================================
// MULTER CONFIGURATION
// ============================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, csvUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = 'report-card-' + uniqueSuffix + path.extname(file.originalname);
    console.log(`Saving file as: ${filename}`);
    cb(null, filename);
  },
});

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv') {
      console.error(`Rejected file: ${file.originalname}`);
      return cb(new Error('Only CSV files are allowed'));
    }
    console.log(`Accepted file: ${file.originalname}`);
    cb(null, true);
  },
});

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.',
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  }
  next(err);
};

// ============================================
// ROUTES
// ============================================

/**
 * Health check
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Report Card service is running',
    timestamp: new Date().toISOString(),
    uploadDir: csvUploadDir,
    pdfDir: pdfOutputDir,
  });
});

/**
 * Upload CSV and process into database
 */
router.post(
  '/upload-csv',
  upload.single('csvFile'),
  handleMulterError,
  async (req, res) => {
    try {
      console.log('=== CSV Upload Request ===');

      const { schoolId, yearId, term } = req.body;

      // Validation
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No CSV file uploaded',
        });
      }

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

      // Process CSV with service
      const result = await reportCardService.uploadAndProcessCSV(
        req.file.path,
        parseInt(schoolId),
        parseInt(yearId),
        term.toUpperCase(),
        1 // uploadedBy
      );

      // Clean up file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.log('=== CSV Upload Completed ===');

      if (result.errorRecords > 0) {
        return res.status(207).json({
          success: true,
          message: 'CSV processed with some errors',
          data: result,
        });
      }

      return res.status(200).json({
        success: true,
        message: 'CSV uploaded and processed successfully!',
        data: result,
      });

    } catch (error) {
      console.error('Error:', error);
      
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

/**
 * Get uploaded marks
 */
router.get('/uploaded-marks', async (req, res) => {
  try {
    const { schoolId, yearId, term } = req.query;

    if (!schoolId || !yearId || !term) {
      return res.status(400).json({
        success: false,
        message: 'Missing parameters: schoolId, yearId, term',
      });
    }

    const students = await reportCardService.getStudentsWithMarks(
      parseInt(schoolId),
      parseInt(yearId),
      term.toUpperCase()
    );

    return res.status(200).json({
      success: true,
      message: `Found ${students.length} students`,
      data: {
        total: students.length,
        students,
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Test endpoint
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Report card routes working!',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/report-cards/:reportId/download
 * @desc    Download report card as PDF
 * @access  Public (for now)
 */
router.get(
  '/:reportId/download',
  async (req, res) => {
    await reportCardController.downloadReportCard(req, res);
  }
);
console.log('✅ Report card routes loaded');

export default router;
