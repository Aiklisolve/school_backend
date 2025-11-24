import unifiedSchoolSetupService from '../services/unifiedSchoolSetupService.js';
import fs from 'fs';

class UnifiedSchoolSetupController {
  /**
   * Upload single CSV containing all school data
   * Processes: Schools → Branches → Classes → Academic Years → Sections → Fee Structures
   */
  async uploadUnifiedSchoolSetup(req, res) {
    try {
      console.log('=== Unified School Setup CSV Upload ===');

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No CSV file uploaded. Please attach a CSV file.',
        });
      }

      console.log(`File: ${req.file.originalname} (${req.file.size} bytes)`);
      console.log(`Path: ${req.file.path}`);

      // Process the unified CSV
      const result = await unifiedSchoolSetupService.processUnifiedSchoolCSV(req.file.path);

      // Clean up file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('✓ Temporary file cleaned up');
      }

      console.log('=== Unified School Setup Completed ===');

      // Check for errors
      if (result.errors && result.errors.length > 0) {
        return res.status(207).json({
          success: true,
          message: 'School setup completed with some errors',
          data: result,
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Complete school setup uploaded successfully!',
        data: result,
      });

    } catch (error) {
      // Clean up file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.error('❌ Error in uploadUnifiedSchoolSetup:', error);
      return res.status(500).json({
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  /**
   * Get complete school hierarchy
   * Returns school → branches → classes → sections → academic years → fee structures
   */
  async getSchoolHierarchy(req, res) {
    try {
      const { schoolId } = req.params;

      if (!schoolId || isNaN(schoolId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid schoolId parameter',
        });
      }

      console.log(`Fetching complete hierarchy for school ID: ${schoolId}`);

      const { pool } = await import('../config/db.js');

      // Get school details
      const schoolQuery = 'SELECT * FROM schools WHERE school_id = $1';
      const schoolResult = await pool.query(schoolQuery, [parseInt(schoolId)]);

      if (schoolResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'School not found',
        });
      }

      const school = schoolResult.rows[0];

      // Get branches
      const branchesQuery = 'SELECT * FROM branches WHERE school_id = $1 ORDER BY is_main_branch DESC, branch_name';
      const branchesResult = await pool.query(branchesQuery, [parseInt(schoolId)]);

      // Get classes
      const classesQuery = 'SELECT * FROM classes WHERE school_id = $1 ORDER BY class_order';
      const classesResult = await pool.query(classesQuery, [parseInt(schoolId)]);

      // Get academic years
      const yearsQuery = 'SELECT * FROM academic_years WHERE school_id = $1 ORDER BY start_date DESC';
      const yearsResult = await pool.query(yearsQuery, [parseInt(schoolId)]);

      // Get sections with class and year names
      const sectionsQuery = `
        SELECT 
          s.*,
          c.class_name,
          ay.year_name
        FROM sections s
        JOIN classes c ON s.class_id = c.class_id
        JOIN academic_years ay ON s.year_id = ay.year_id
        WHERE s.school_id = $1
        ORDER BY c.class_order, s.section_name
      `;
      const sectionsResult = await pool.query(sectionsQuery, [parseInt(schoolId)]);

      // Get fee structures
      const feesQuery = `
        SELECT 
          fs.*,
          c.class_name,
          ay.year_name
        FROM fee_structures fs
        JOIN classes c ON fs.class_id = c.class_id
        JOIN academic_years ay ON fs.year_id = ay.year_id
        WHERE fs.school_id = $1
        ORDER BY c.class_order, ay.start_date DESC
      `;
      const feesResult = await pool.query(feesQuery, [parseInt(schoolId)]);

      return res.status(200).json({
        success: true,
        data: {
          school: school,
          branches: branchesResult.rows,
          classes: classesResult.rows,
          academicYears: yearsResult.rows,
          sections: sectionsResult.rows,
          feeStructures: feesResult.rows,
          summary: {
            totalBranches: branchesResult.rows.length,
            totalClasses: classesResult.rows.length,
            totalAcademicYears: yearsResult.rows.length,
            totalSections: sectionsResult.rows.length,
            totalFeeStructures: feesResult.rows.length,
          },
        },
      });

    } catch (error) {
      console.error('Error in getSchoolHierarchy:', error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get complete setup summary for all schools
   */
  async getSetupSummary(req, res) {
    try {
      console.log('Fetching complete setup summary');

      const { pool } = await import('../config/db.js');

      const query = `
        SELECT 
          s.school_id,
          s.school_code,
          s.school_name,
          s.city,
          s.state,
          s.board_type,
          s.is_active,
          COUNT(DISTINCT b.branch_id) as branches_count,
          COUNT(DISTINCT c.class_id) as classes_count,
          COUNT(DISTINCT ay.year_id) as academic_years_count,
          COUNT(DISTINCT sec.section_id) as sections_count,
          COUNT(DISTINCT fs.structure_id) as fee_structures_count
        FROM schools s
        LEFT JOIN branches b ON s.school_id = b.school_id
        LEFT JOIN classes c ON s.school_id = c.school_id
        LEFT JOIN academic_years ay ON s.school_id = ay.school_id
        LEFT JOIN sections sec ON s.school_id = sec.school_id
        LEFT JOIN fee_structures fs ON s.school_id = fs.school_id
        GROUP BY s.school_id, s.school_code, s.school_name, s.city, s.state, s.board_type, s.is_active
        ORDER BY s.school_name
      `;

      const result = await pool.query(query);

      return res.status(200).json({
        success: true,
        data: {
          total: result.rows.length,
          schools: result.rows,
        },
      });

    } catch (error) {
      console.error('Error in getSetupSummary:', error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Validate CSV structure before upload
   */
  async validateCSVStructure(req, res) {
    try {
      console.log('=== Validating CSV Structure ===');

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No CSV file uploaded',
        });
      }

      const csv = await import('csv-parser');
      const headers = [];
      let rowCount = 0;
      const sampleRows = [];

      fs.createReadStream(req.file.path)
        .pipe(csv.default())
        .on('headers', (headerList) => {
          headers.push(...headerList);
        })
        .on('data', (row) => {
          rowCount++;
          if (rowCount <= 3) {
            sampleRows.push(row);
          }
        })
        .on('end', () => {
          // Clean up file
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }

          // Required columns
          const requiredColumns = [
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
          ];

          const missingColumns = requiredColumns.filter(col => !headers.includes(col));
          const isValid = missingColumns.length === 0;

          return res.status(200).json({
            success: true,
            validation: {
              isValid: isValid,
              totalRows: rowCount,
              headers: headers,
              missingColumns: missingColumns,
              sampleRows: sampleRows,
              message: isValid 
                ? 'CSV structure is valid and ready for upload' 
                : `CSV is missing required columns: ${missingColumns.join(', ')}`,
            },
          });
        })
        .on('error', (error) => {
          // Clean up file
          if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }

          return res.status(400).json({
            success: false,
            message: `CSV parsing error: ${error.message}`,
          });
        });

    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.error('Error in validateCSVStructure:', error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Health check for unified setup service
   */
  async healthCheck(req, res) {
    try {
      const { pool } = await import('../config/db.js');

      // Check database connection
      await pool.query('SELECT 1');

      // Get counts
      const schoolsCount = await pool.query('SELECT COUNT(*) FROM schools');
      const branchesCount = await pool.query('SELECT COUNT(*) FROM branches');
      const classesCount = await pool.query('SELECT COUNT(*) FROM classes');
      const sectionsCount = await pool.query('SELECT COUNT(*) FROM sections');
      const yearsCount = await pool.query('SELECT COUNT(*) FROM academic_years');
      const feesCount = await pool.query('SELECT COUNT(*) FROM fee_structures');

      return res.status(200).json({
        success: true,
        message: 'Unified School Setup service is running',
        timestamp: new Date().toISOString(),
        database: {
          connected: true,
          schools: parseInt(schoolsCount.rows[0].count),
          branches: parseInt(branchesCount.rows[0].count),
          classes: parseInt(classesCount.rows[0].count),
          sections: parseInt(sectionsCount.rows[0].count),
          academicYears: parseInt(yearsCount.rows[0].count),
          feeStructures: parseInt(feesCount.rows[0].count),
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

export default new UnifiedSchoolSetupController();
