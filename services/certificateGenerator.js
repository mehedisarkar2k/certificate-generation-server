const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');
const Jimp = require('jimp');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate certificates in bulk from template and data
 * @param {string} templatePath - Path to the template image
 * @param {Array} records - Array of data records from CSV
 * @param {Object} fieldMappings - Optional mappings for text placement
 * @returns {Object} - Result with generated certificate paths and zip file
 */
async function generateCertificates(
  templatePath,
  records,
  fieldMappings = null
) {
  try {
    // Load template image
    const templateImage = await Jimp.read(templatePath);
    const templateWidth = templateImage.bitmap.width;
    const templateHeight = templateImage.bitmap.height;

    const outputDir = path.join('output', `batch-${Date.now()}`);
    await fs.mkdir(outputDir, { recursive: true });

    const certificates = [];

    // Generate certificate for each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const certificateName = `certificate-${i + 1}-${
        record.name || record.Name || uuidv4()
      }.pdf`;
      const outputPath = path.join(outputDir, certificateName);

      await generateSingleCertificate(
        templatePath,
        templateWidth,
        templateHeight,
        record,
        outputPath,
        fieldMappings
      );

      certificates.push({
        name: certificateName,
        path: outputPath,
        data: record,
      });
    }

    // Create ZIP file with all certificates
    const zipPath = path.join('output', `certificates-${Date.now()}.zip`);
    await createZipArchive(outputDir, zipPath);

    return {
      certificates,
      zipPath,
      batchDir: outputDir,
    };
  } catch (error) {
    console.error('Error in generateCertificates:', error);
    throw error;
  }
}

/**
 * Generate a single certificate PDF
 */
async function generateSingleCertificate(
  templatePath,
  templateWidth,
  templateHeight,
  data,
  outputPath,
  fieldMappings
) {
  return new Promise(async (resolve, reject) => {
    try {
      // Create PDF document with template dimensions
      const doc = new PDFDocument({
        size: [templateWidth, templateHeight],
        margin: 0,
      });

      const writeStream = require('fs').createWriteStream(outputPath);
      doc.pipe(writeStream);

      // Add template image as background
      doc.image(templatePath, 0, 0, {
        width: templateWidth,
        height: templateHeight,
      });

      // Add dynamic text based on CSV data
      if (fieldMappings && fieldMappings.length > 0) {
        // Use custom field mappings
        for (const mapping of fieldMappings) {
          const value = data[mapping.csvColumn] || '';

          // Set font
          const fontName = mapping.font || 'Helvetica-Bold';
          const fontSize = mapping.fontSize || 36;
          doc.font(fontName).fontSize(fontSize);

          // Set color
          const color = mapping.color || '#000000';
          doc.fillColor(color);

          // Position - use exact click coordinates
          const textX = mapping.x;
          const textY = mapping.y;
          const maxWidth = mapping.width || templateWidth - mapping.x - 50;
          const align = mapping.align || 'left'; // Default to left

          // Render text at exact clicked position
          doc.text(value, textX, textY, {
            width: maxWidth,
            align: align,
          });
        }
      } else {
        // Default: try to place common fields intelligently
        addDefaultTextFields(doc, data, templateWidth, templateHeight);
      }

      doc.end();

      writeStream.on('finish', () => resolve(outputPath));
      writeStream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Add default text fields to certificate
 */
function addDefaultTextFields(doc, data, templateWidth, templateHeight) {
  // Try to find name field (common variations)
  const nameField =
    data.name ||
    data.Name ||
    data.NAME ||
    data.fullname ||
    data.FullName ||
    data['Full Name'] ||
    '';

  if (nameField) {
    // Place name in upper-middle area
    doc
      .font('Helvetica-Bold')
      .fontSize(48)
      .fillColor('#1a1a1a')
      .text(nameField, 100, templateHeight * 0.4, {
        width: templateWidth - 200,
        align: 'center',
      });
  }

  // Try to find course/program/achievement field
  const courseField =
    data.course ||
    data.Course ||
    data.program ||
    data.Program ||
    data.achievement ||
    data.Achievement ||
    '';

  if (courseField) {
    doc
      .font('Helvetica')
      .fontSize(24)
      .fillColor('#333333')
      .text(courseField, 100, templateHeight * 0.55, {
        width: templateWidth - 200,
        align: 'center',
      });
  }

  // Try to find date field
  const dateField =
    data.date ||
    data.Date ||
    data.DATE ||
    data.completionDate ||
    data['Completion Date'] ||
    '';

  if (dateField) {
    doc
      .font('Helvetica')
      .fontSize(18)
      .fillColor('#666666')
      .text(dateField, 100, templateHeight * 0.75, {
        width: templateWidth - 200,
        align: 'center',
      });
  }

  // Add any other fields as smaller text
  const processedFields = [
    'name',
    'Name',
    'NAME',
    'fullname',
    'FullName',
    'Full Name',
    'course',
    'Course',
    'program',
    'Program',
    'achievement',
    'Achievement',
    'date',
    'Date',
    'DATE',
    'completionDate',
    'Completion Date',
  ];

  let yOffset = templateHeight * 0.85;
  for (const [key, value] of Object.entries(data)) {
    if (
      !processedFields.includes(key) &&
      value &&
      yOffset < templateHeight - 50
    ) {
      doc
        .font('Helvetica')
        .fontSize(14)
        .fillColor('#888888')
        .text(`${key}: ${value}`, 100, yOffset, {
          width: templateWidth - 200,
          align: 'center',
        });
      yOffset += 20;
    }
  }
}

/**
 * Create a ZIP archive of all certificates
 */
async function createZipArchive(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = require('fs').createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(outputPath));
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

module.exports = {
  generateCertificates,
  generateSingleCertificate,
};
