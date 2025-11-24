import { pool } from '../config/db.js';
import csv from 'csv-parser';
import fs from 'fs';

class UnifiedSchoolSetupService {
  /**
   * Process complete school setup from single CSV
   */
  async processUnifiedSchoolCSV(filePath) {
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
            const result = await this.processHierarchicalData(records);
            resolve(result);
          } catch (dbError) {
            reject(dbError);
          }
        })
        .on('error', (error) => reject(error));
    });
  }

  /**
   * Process data in hierarchical order - ENHANCED ERROR HANDLING
   */
  async processHierarchicalData(records) {
    const client = await pool.connect();
    
    const stats = {
      schools: 0,
      branches: 0,
      classes: 0,
      sections: 0,
      academicYears: 0,
      feeStructures: 0,
      errors: [],
    };

    try {
      const schoolGroups = this.groupBySchool(records);

      for (const [schoolCode, schoolRecords] of Object.entries(schoolGroups)) {
        console.log(`\n========================================`);
        console.log(`Processing School: ${schoolCode}`);
        console.log(`========================================`);

        try {
          await client.query('BEGIN');

          // 1. Insert/Update School
          let schoolId; // ✅ Fixed: Declare outside try block
          try {
            schoolId = await this.upsertSchool(client, schoolRecords[0]);
            stats.schools++;
            console.log(`  ✓ School ID: ${schoolId}`);
          } catch (schoolError) {
            await client.query('ROLLBACK');
            throw new Error(`School insert failed: ${schoolError.message}`);
          }

          // 2. Process Branches
          let branchMap = {}; // ✅ Fixed: Removed duplicate 'const'
          try {
            branchMap = await this.processBranches(client, schoolId, schoolRecords);
            stats.branches += Object.keys(branchMap).length;
            console.log(`  ✓ Branches: ${Object.keys(branchMap).length}`);
          } catch (branchError) {
            await client.query('ROLLBACK');
            throw new Error(`Branch processing failed: ${branchError.message}`);
          }

          // 3. Process Classes
          let classMap = {};
          try {
            classMap = await this.processClasses(client, schoolId, schoolRecords);
            stats.classes += Object.keys(classMap).length;
            console.log(`  ✓ Classes: ${Object.keys(classMap).length}`);
          } catch (classError) {
            await client.query('ROLLBACK');
            throw new Error(`Class processing failed: ${classError.message}`);
          }

          // 4. Process Academic Years
          let yearMap = {};
          try {
            yearMap = await this.processAcademicYears(client, schoolId, schoolRecords);
            stats.academicYears += Object.keys(yearMap).length;
            console.log(`  ✓ Academic Years: ${Object.keys(yearMap).length}`);
          } catch (yearError) {
            await client.query('ROLLBACK');
            console.error(`  ✗ Year processing error:`, yearError.message);
            throw new Error(`Academic year processing failed: ${yearError.message}`);
          }

          // 5. Process Sections
          try {
            const sectionCount = await this.processSections(client, schoolId, classMap, yearMap, schoolRecords);
            stats.sections += sectionCount;
            console.log(`  ✓ Sections: ${sectionCount}`);
          } catch (sectionError) {
            await client.query('ROLLBACK');
            throw new Error(`Section processing failed: ${sectionError.message}`);
          }

          // 6. Process Fee Structures
          try {
            const feeCount = await this.processFeeStructures(client, schoolId, classMap, yearMap, schoolRecords);
            stats.feeStructures += feeCount;
            console.log(`  ✓ Fee Structures: ${feeCount}`);
          } catch (feeError) {
            // Fee structures are optional, just log warning
            console.warn(`  ⚠ Fee structure processing failed: ${feeError.message}`);
          }

          await client.query('COMMIT');
          console.log(`  ✅ School ${schoolCode} processed successfully\n`);

        } catch (error) {
          await client.query('ROLLBACK');
          console.error(`  ✗ Error processing school ${schoolCode}:`, error.message);
          stats.errors.push({
            school: schoolCode,
            error: error.message,
          });
        }
      }

      console.log('\n✅ Unified school setup completed');

      return {
        success: true,
        totalRecords: records.length,
        ...stats,
      };

    } catch (error) {
      throw new Error(`Processing failed: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Group records by school code
   */
  groupBySchool(records) {
    return records.reduce((acc, record) => {
      const schoolCode = record.school_code;
      if (!acc[schoolCode]) {
        acc[schoolCode] = [];
      }
      acc[schoolCode].push(record);
      return acc;
    }, {});
  }

  /**
   * Insert/Update School
   */
  async upsertSchool(client, record) {
    const query = `
      INSERT INTO schools (
        school_code, school_name, address_line1, address_line2,
        city, state, pincode, phone, email, website,
        board_type, academic_session_start_month, grading_system,
        affiliation_number, recognition_status, rte_compliance, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (school_code) 
      DO UPDATE SET 
        school_name = EXCLUDED.school_name,
        updated_at = CURRENT_TIMESTAMP
      RETURNING school_id
    `;

    const values = [
      record.school_code,
      record.school_name,
      record.school_address_line1 || record.address_line1 || '',
      record.school_address_line2 || record.address_line2 || null,
      record.city,
      record.state,
      record.school_pincode || record.pincode || '',
      record.school_phone || record.phone || null,
      record.school_email || record.email || null,
      record.school_website || record.website || null,
      (record.board_type || 'CBSE').toUpperCase(),
      parseInt(record.academic_session_start_month) || 4,
      (record.grading_system || 'PERCENTAGE').toUpperCase(),
      record.affiliation_number || null,
      record.recognition_status || 'RECOGNIZED',
      record.rte_compliance !== 'false',
      record.school_is_active !== 'false',
    ];

    const result = await client.query(query, values);
    return result.rows[0].school_id;
  }

  /**
   * Process Branches
   */
  async processBranches(client, schoolId, records) {
    const branchMap = {};
    const processedBranches = new Set();

    for (const record of records) {
      const branchCode = record.branch_code;
      
      if (!branchCode || processedBranches.has(branchCode)) continue;

      const query = `
        INSERT INTO branches (
          school_id, branch_code, branch_name, address_line1,
          city, state, pincode, phone, is_main_branch,
          max_students, current_students, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (school_id, branch_code)
        DO UPDATE SET branch_name = EXCLUDED.branch_name
        RETURNING branch_id
      `;

      const values = [
        schoolId,
        branchCode,
        record.branch_name || `Branch ${branchCode}`,
        record.branch_address_line1 || '',
        record.branch_city || record.city,
        record.branch_state || record.state,
        record.branch_pincode || record.school_pincode || record.pincode || '',
        record.branch_phone || null,
        record.is_main_branch === 'true' || record.is_main_branch === '1',
        parseInt(record.branch_max_students) || 1000,
        parseInt(record.branch_current_students) || 0,
        record.branch_is_active !== 'false',
      ];

      const result = await client.query(query, values);
      branchMap[branchCode] = result.rows[0].branch_id;
      processedBranches.add(branchCode);
    }

    return branchMap;
  }

/**
 * Process Classes - MATCH DATABASE CONSTRAINT
 */
async processClasses(client, schoolId, records) {
  const classMap = {};
  const processedClasses = new Set();

  // Valid categories - MATCH YOUR DATABASE CONSTRAINT
  const validCategories = ['PRE_PRIMARY', 'PRIMARY', 'MIDDLE', 'SECONDARY', 'SENIOR_SECONDARY'];

  // Mapping from CSV format to database format
  const categoryMapping = {
    'PREPRIMARY': 'PRE_PRIMARY',
    'PRE_PRIMARY': 'PRE_PRIMARY',
    'PRE PRIMARY': 'PRE_PRIMARY',
    'SENIORSECONDARY': 'SENIOR_SECONDARY',
    'SENIOR_SECONDARY': 'SENIOR_SECONDARY',
    'SENIOR SECONDARY': 'SENIOR_SECONDARY',
    'PRIMARY': 'PRIMARY',
    'MIDDLE': 'MIDDLE',
    'SECONDARY': 'SECONDARY',
  };

  for (const record of records) {
    const className = record.class_name;
    
    if (!className || processedClasses.has(className)) continue;

    const query = `
      INSERT INTO classes (
        school_id, class_name, class_order, class_category,
        subjects, passing_percentage, max_students_per_section, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (school_id, class_name)
      DO UPDATE SET class_order = EXCLUDED.class_order
      RETURNING class_id
    `;

    // Parse subjects
    let subjects = [];
    if (record.subjects) {
      try {
        subjects = JSON.parse(record.subjects);
      } catch (e) {
        subjects = record.subjects.split(',').map(s => s.trim()).filter(s => s);
      }
    }

    // Convert category to database format
    let rawCategory = (record.class_category || 'PRIMARY').toUpperCase().trim();
    let classCategory = categoryMapping[rawCategory] || rawCategory;
    
    console.log(`    Processing ${className}:`);
    console.log(`      Raw category: "${rawCategory}"`);
    console.log(`      Mapped to: "${classCategory}"`);
    
    // If still not valid after mapping, default to PRIMARY
    if (!validCategories.includes(classCategory)) {
      console.warn(`    ⚠ Invalid class_category "${classCategory}" for ${className}, defaulting to PRIMARY`);
      classCategory = 'PRIMARY';
    }

    const values = [
      schoolId,
      className,
      parseInt(record.class_order) || 0,
      classCategory,
      JSON.stringify(subjects),
      parseFloat(record.passing_percentage) || 35.0,
      parseInt(record.max_students_per_section) || 40,
      record.class_is_active !== 'false',
    ];

    try {
      console.log(`      Inserting with category: "${classCategory}"`);
      const result = await client.query(query, values);
      classMap[className] = result.rows[0].class_id;
      processedClasses.add(className);
      console.log(`      ✓ Success - ID: ${result.rows[0].class_id}`);
    } catch (error) {
      console.error(`    ✗ Failed to insert class ${className}`);
      console.error(`      Error: ${error.message}`);
      throw error;
    }
  }

  return classMap;
}



  /**
   * Process Academic Years - FIXED (no updated_at)
   */
  async processAcademicYears(client, schoolId, records) {
    const yearMap = {};
    const processedYears = new Set();

    for (const record of records) {
      const yearName = record.year_name;
      
      if (!yearName || processedYears.has(yearName)) continue;

      try {
        const query = `
          INSERT INTO academic_years (
            school_id, year_name, start_date, end_date, is_current
          )
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (school_id, year_name)
          DO UPDATE SET 
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            is_current = EXCLUDED.is_current
          RETURNING year_id
        `;

        const values = [
          schoolId,
          yearName,
          record.year_start_date || record.start_date || '2024-04-01',
          record.year_end_date || record.end_date || '2025-03-31',
          record.is_current_year === 'true' || record.is_current_year === '1',
        ];

        const result = await client.query(query, values);
        yearMap[yearName] = result.rows[0].year_id;
        processedYears.add(yearName);
        
        console.log(`    ✓ Academic Year: ${yearName} (ID: ${result.rows[0].year_id})`);
        
      } catch (error) {
        console.error(`    ✗ Academic year error for ${yearName}:`, error.message);
        throw new Error(`Failed to process academic year ${yearName}: ${error.message}`);
      }
    }

    if (Object.keys(yearMap).length === 0) {
      throw new Error('No academic years were processed');
    }

    return yearMap;
  }

  /**
   * Process Sections
   */
  async processSections(client, schoolId, classMap, yearMap, records) {
    let sectionCount = 0;
    const processedSections = new Set();

    for (const record of records) {
      const className = record.class_name;
      const sectionName = record.section_name;
      const yearName = record.year_name;

      if (!className || !sectionName || !yearName) continue;

      const classId = classMap[className];
      const yearId = yearMap[yearName];

      if (!classId || !yearId) continue;

      const sectionKey = `${classId}-${yearId}-${sectionName}`;
      if (processedSections.has(sectionKey)) continue;

      const query = `
        INSERT INTO sections (
          school_id, class_id, year_id, section_name,
          max_students, current_students, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (school_id, class_id, year_id, section_name)
        DO UPDATE SET max_students = EXCLUDED.max_students
        RETURNING section_id
      `;

      const values = [
        schoolId,
        classId,
        yearId,
        sectionName,
        parseInt(record.section_max_students) || parseInt(record.max_students_per_section) || 40,
        parseInt(record.section_current_students) || 0,
        record.section_is_active !== 'false',
      ];

      try {
        await client.query(query, values);
        sectionCount++;
        processedSections.add(sectionKey);
      } catch (error) {
        console.error(`    ✗ Failed to insert section ${sectionName}:`, error.message);
      }
    }

    return sectionCount;
  }

  /**
   * Process Fee Structures - FIXED (no updated_at if column doesn't exist)
   */
  async processFeeStructures(client, schoolId, classMap, yearMap, records) {
    let feeCount = 0;
    const processedFees = new Set();

    for (const record of records) {
      const className = record.class_name;
      const yearName = record.year_name;
      const structureName = record.fee_structure_name || `${className}-${yearName}-Fee`;

      if (!className || !yearName) continue;

      const classId = classMap[className];
      const yearId = yearMap[yearName];
      const totalFee = parseFloat(record.total_annual_fee);

      if (!classId || !yearId || !totalFee || isNaN(totalFee)) continue;

      const feeKey = `${classId}-${yearId}-${structureName}`;
      if (processedFees.has(feeKey)) continue;

      const query = `
        INSERT INTO fee_structures (
          school_id, class_id, year_id, structure_name,
          fee_components, total_annual_fee, installment_plan,
          effective_from, effective_to, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (school_id, class_id, year_id, structure_name)
        DO UPDATE SET 
          total_annual_fee = EXCLUDED.total_annual_fee
        RETURNING structure_id
      `;

      // Build fee components
      const feeComponents = {
        tuition_fee: totalFee * 0.7,
        development_fee: totalFee * 0.2,
        other_fees: totalFee * 0.1
      };

      // Build installment plan
      const installmentAmount = totalFee / 4;
      const installmentPlan = [
        { installment: 1, amount: installmentAmount, due_date: record.year_start_date || '2024-05-15' },
        { installment: 2, amount: installmentAmount, due_date: '2024-08-15' },
        { installment: 3, amount: installmentAmount, due_date: '2024-11-15' },
        { installment: 4, amount: installmentAmount, due_date: '2025-02-15' }
      ];

      const effectiveFrom = record.fee_effective_from || record.year_start_date || new Date().toISOString().split('T')[0];
      const effectiveTo = record.fee_effective_to || record.year_end_date || null;

      const values = [
        schoolId,
        classId,
        yearId,
        structureName,
        JSON.stringify(feeComponents),
        totalFee,
        JSON.stringify(installmentPlan),
        effectiveFrom,
        effectiveTo,
        record.fee_is_active !== 'false',
      ];

      try {
        const result = await client.query(query, values);
        feeCount++;
        processedFees.add(feeKey);
      } catch (error) {
        console.error(`    ✗ Failed to insert fee structure ${structureName}:`, error.message);
      }
    }

    return feeCount;
  }
}

export default new UnifiedSchoolSetupService();
