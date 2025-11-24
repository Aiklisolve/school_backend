import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import unifiedSchoolSetupController from '../controllers/unifiedSchoolSetupController.js';

const router = express.Router();

// Get __dirname in ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// DIRECTORY SETUP
// ============================================

const uploadDir = path.join(__dirname, '../../uploads/unified_setup');

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
    const filename = 'unified-school-setup-' + uniqueSuffix + path.extname(file.originalname);
    console.log(`Saving file as: ${filename}`);
    cb(null, filename);
  },
});

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB for larger school setups
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
// ROUTES
// ============================================

/**
 * @route   POST /api/unified-setup/upload
 * @desc    Upload single CSV containing complete school setup
 *          (Schools, Branches, Classes, Sections, Academic Years, Fee Structures)
 * @access  Admin/Principal
 */
router.post(
  '/upload',
  upload.single('csvFile'),
  handleMulterError,
  unifiedSchoolSetupController.uploadUnifiedSchoolSetup
);

/**
 * @route   POST /api/unified-setup/validate
 * @desc    Validate CSV structure before upload
 * @access  Admin/Principal
 */
router.post(
  '/validate',
  upload.single('csvFile'),
  handleMulterError,
  unifiedSchoolSetupController.validateCSVStructure
);

/**
 * @route   GET /api/unified-setup/schools/:schoolId/hierarchy
 * @desc    Get complete hierarchy for a school
 *          Returns school → branches → classes → years → sections → fees
 * @access  Public
 */
router.get(
  '/schools/:schoolId/hierarchy',
  unifiedSchoolSetupController.getSchoolHierarchy
);

/**
 * @route   GET /api/unified-setup/summary
 * @desc    Get setup summary for all schools
 * @access  Public
 */
router.get(
  '/summary',
  unifiedSchoolSetupController.getSetupSummary
);

/**
 * @route   GET /api/unified-setup/health
 * @desc    Health check with database statistics
 * @access  Public
 */
router.get(
  '/health',
  unifiedSchoolSetupController.healthCheck
);

// ============================================
// INFO ENDPOINT
// ============================================

/**
 * @route   GET /api/unified-setup/info
 * @desc    Get information about the unified setup service
 * @access  Public
 */
router.get('/info', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'Unified School Setup',
    version: '1.0.0',
    description: 'Upload complete school setup from a single CSV file',
    endpoints: {
      upload: {
        method: 'POST',
        path: '/api/unified-setup/upload',
        description: 'Upload unified school setup CSV',
        parameters: {
          csvFile: 'CSV file (multipart/form-data)',
        },
      },
      validate: {
        method: 'POST',
        path: '/api/unified-setup/validate',
        description: 'Validate CSV structure before upload',
        parameters: {
          csvFile: 'CSV file (multipart/form-data)',
        },
      },
      hierarchy: {
        method: 'GET',
        path: '/api/unified-setup/schools/:schoolId/hierarchy',
        description: 'Get complete school hierarchy',
      },
      summary: {
        method: 'GET',
        path: '/api/unified-setup/summary',
        description: 'Get setup summary for all schools',
      },
      health: {
        method: 'GET',
        path: '/api/unified-setup/health',
        description: 'Service health check',
      },
    },
    csvRequirements: {
      requiredColumns: [
        'school_code',
        'school_name',
        'city',
        'state',
        'board_type',
        'class_name',
        'class_order',
        'year_name',
        'year_start_date',
        'year_end_date',
        'section_name',
      ],
      optionalColumns: [
        'branch_code',
        'branch_name',
        'subjects',
        'total_annual_fee',
        'passing_percentage',
        'max_students_per_section',
        'and more...',
      ],
      processingOrder: [
        '1. Schools',
        '2. Branches',
        '3. Classes',
        '4. Academic Years',
        '5. Sections',
        '6. Fee Structures',
      ],
    },
  });
});

console.log('✅ Unified School Setup routes loaded');

export default router;
