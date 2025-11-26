import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PDFGeneratorService {
  /**
   * Generate report card PDF
   */
  async generateReportCardPDF(reportData, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        // Create document
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
        });

        // Pipe to file
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // Header with school info
        this.addHeader(doc, reportData.school);

        // Student info section
        this.addStudentInfo(doc, reportData.student);

        // Academic performance section
        this.addAcademicPerformance(doc, reportData.subjects, reportData.overall);

        // Summary section
        this.addSummary(doc, reportData.overall, reportData.term);

        // Footer
        this.addFooter(doc);

        // Finalize PDF
        doc.end();

        // Handle stream completion
        stream.on('finish', () => {
          console.log(`✅ PDF generated: ${outputPath}`);
          resolve(outputPath);
        });

        stream.on('error', (err) => {
          reject(new Error(`Stream error: ${err.message}`));
        });

      } catch (error) {
        reject(new Error(`PDF generation error: ${error.message}`));
      }
    });
  }

  /**
   * Add header to PDF
   */
  addHeader(doc, school) {
    // School name
    doc.fontSize(20)
      .font('Helvetica-Bold')
      .text(school?.name || 'School Name', { align: 'center' });

    // Subheader
    doc.fontSize(12)
      .font('Helvetica')
      .text('STUDENT REPORT CARD', { align: 'center' });

    doc.moveTo(50, doc.y + 5)
      .lineTo(doc.page.width - 50, doc.y + 5)
      .stroke();

    doc.moveDown(0.5);
  }

  /**
   * Add student info section
   */
  addStudentInfo(doc, student) {
    doc.fontSize(11)
      .font('Helvetica-Bold')
      .text('Student Information', { underline: true });

    doc.fontSize(10)
      .font('Helvetica');

    const infoData = [
      ['Name:', student.full_name],
      ['Admission No.:', student.admission_number],
      ['Class:', `${student.class_name} - ${student.section_name}`],
      ['Date of Birth:', this.formatDate(student.date_of_birth)],
      ['Academic Year:', `${student.year_id}`],
      ['Term:', student.term],
    ];

    let y = doc.y;
    infoData.forEach(([label, value]) => {
      doc.text(label, 60, y, { width: 100 });
      doc.font('Helvetica').text(value, 180, y);
      y += 20;
    });

    doc.moveDown(0.5);
  }

  /**
   * Add academic performance table
   */
  addAcademicPerformance(doc, subjects, overall) {
    doc.fontSize(11)
      .font('Helvetica-Bold')
      .text('Academic Performance', { underline: true });

    doc.moveDown(0.3);

    // Table headers
    const tableTop = doc.y;
    const col1X = 60;
    const col2X = 200;
    const col3X = 280;
    const col4X = 360;
    const col5X = 440;

    const headerHeight = 25;
    const rowHeight = 20;

    // Header background
    doc.rect(50, tableTop, doc.page.width - 100, headerHeight)
      .fill('#e0e0e0');

    // Header text
    doc.fillColor('#000000')
      .fontSize(9)
      .font('Helvetica-Bold');

    doc.text('Subject', col1X, tableTop + 7);
    doc.text('Internal', col2X, tableTop + 7);
    doc.text('External', col3X, tableTop + 7);
    doc.text('Total', col4X, tableTop + 7);
    doc.text('Grade', col5X, tableTop + 7);

    // Table rows
    doc.fontSize(9)
      .font('Helvetica')
      .fillColor('#000000');

    let currentY = tableTop + headerHeight;

    subjects.forEach((subject, index) => {
      // Alternating row colors
      if (index % 2 === 0) {
        doc.rect(50, currentY, doc.page.width - 100, rowHeight)
          .fill('#f9f9f9');
        doc.fillColor('#000000');
      }

      doc.text(subject.subject_name, col1X, currentY + 5);
      doc.text(subject.internal_marks.toString(), col2X, currentY + 5);
      doc.text(subject.external_marks.toString(), col3X, currentY + 5);
      doc.text(subject.total_marks.toString(), col4X, currentY + 5);

      // Grade with color
      const gradeColor = this.getGradeColor(subject.grade);
      doc.fillColor(gradeColor)
        .font('Helvetica-Bold')
        .text(subject.grade, col5X, currentY + 5);

      doc.fillColor('#000000')
        .font('Helvetica');

      currentY += rowHeight;
    });

    // Overall section
    currentY += 10;
    doc.fontSize(11)
      .font('Helvetica-Bold');

    doc.text(`Overall Percentage: ${overall.overall_percentage}%`, 60, currentY);
    
    currentY += 20;
    const overallGrade = this.calculateGrade(overall.overall_percentage);
    doc.fontSize(12)
      .font('Helvetica-Bold')
      .text(`Overall Grade: ${overallGrade}`, 60, currentY);

    doc.moveDown(1);
  }

  /**
   * Add summary section
   */
  addSummary(doc, overall, term) {
    doc.fontSize(11)
      .font('Helvetica-Bold')
      .text('Performance Summary', { underline: true });

    doc.fontSize(10)
      .font('Helvetica');

    const summary = this.generateSummary(overall.overall_percentage);
    doc.text(summary, { align: 'left', width: doc.page.width - 100 });

    doc.moveDown(0.5);
  }

  /**
   * Add footer
   */
  addFooter(doc) {
    const footerY = doc.page.height - 50;

    doc.fontSize(9)
      .font('Helvetica')
      .text(
        '---',
        50,
        footerY,
        { align: 'center', width: doc.page.width - 100 }
      );

    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 50, footerY + 10, {
      align: 'center',
      width: doc.page.width - 100,
    });
  }

  /**
   * Calculate grade from percentage
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
   * Get color for grade
   */
  getGradeColor(grade) {
    const colors = {
      'A+': '#2ecc71',
      'A': '#27ae60',
      'B+': '#f39c12',
      'B': '#e67e22',
      'C': '#e74c3c',
      'D': '#c0392b',
      'F': '#95a5a6',
    };
    return colors[grade] || '#000000';
  }

  /**
   * Generate performance summary
   */
  generateSummary(percentage) {
    const pct = parseFloat(percentage);
    if (pct >= 90) return 'Excellent performance! The student has demonstrated outstanding academic achievement across all subjects.';
    if (pct >= 80) return 'Very good performance. The student shows strong understanding and consistent performance.';
    if (pct >= 70) return 'Good performance. The student is progressing well and meeting expectations.';
    if (pct >= 60) return 'Satisfactory performance. The student is meeting basic requirements but should focus on improvement.';
    if (pct >= 50) return 'Adequate performance. The student needs to put in more effort to improve grades.';
    return 'Performance needs significant improvement. Additional support and effort are required.';
  }

  /**
   * Format date
   */
  formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

export default new PDFGeneratorService();
