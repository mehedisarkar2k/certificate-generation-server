const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { parse } = require('csv-parse/sync');
const xlsx = require('xlsx');
const { generateCertificates } = require('./services/certificateGenerator');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/output', express.static('output'));

// Create necessary directories
const initDirectories = async () => {
  const dirs = ['uploads', 'output', 'templates', 'fonts'];
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.error(`Error creating ${dir} directory:`, error);
    }
  }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    let uploadDir = 'uploads';
    if (file.fieldname === 'template') uploadDir = 'templates';
    else if (file.fieldname === 'font') uploadDir = 'fonts';
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // For fonts, use original filename. For others, use unique name
    if (file.fieldname === 'font') {
      cb(null, file.originalname);
    } else {
      const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(
        file.originalname
      )}`;
      cb(null, uniqueName);
    }
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'template') {
      const allowedTypes = /jpeg|jpg|png/;
      const extname = allowedTypes.test(
        path.extname(file.originalname).toLowerCase()
      );
      const mimetype = allowedTypes.test(file.mimetype);

      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(
          new Error(
            'Only image files (JPEG, JPG, PNG) are allowed for templates!'
          )
        );
      }
    } else if (file.fieldname === 'csvFile') {
      const allowedTypes = /csv|xlsx|xls/;
      const extname = allowedTypes.test(
        path.extname(file.originalname).toLowerCase()
      );

      if (extname) {
        return cb(null, true);
      } else {
        cb(new Error('Only CSV and Excel files are allowed!'));
      }
    } else if (file.fieldname === 'font') {
      const allowedTypes = /ttf|otf/;
      const extname = allowedTypes.test(
        path.extname(file.originalname).toLowerCase()
      );

      if (extname) {
        return cb(null, true);
      } else {
        cb(new Error('Only TTF and OTF font files are allowed!'));
      }
    }
    cb(null, true);
  },
});

// Helper function to parse CSV or Excel files
const parseDataFile = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.csv') {
    const csvContent = await fs.readFile(filePath, 'utf-8');
    return parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } else if (ext === '.xlsx' || ext === '.xls') {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json(worksheet);
  } else {
    throw new Error('Unsupported file format');
  }
};

// Routes

// Get all saved templates
app.get('/api/templates', async (req, res) => {
  try {
    const templatesDir = 'templates';
    const files = await fs.readdir(templatesDir);
    const templates = [];

    for (const file of files) {
      if (/\.(jpg|jpeg|png)$/i.test(file)) {
        const metadataPath = path.join(templatesDir, `${file}.meta.json`);
        let metadata = {
          id: file,
          name: file,
          path: `/templates/${file}`,
          fields: [],
        };

        try {
          const metaContent = await fs.readFile(metadataPath, 'utf-8');
          metadata = JSON.parse(metaContent);
        } catch (err) {
          // No metadata file, use defaults
        }

        templates.push(metadata);
      }
    }

    res.json({ templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Upload and save template
app.post('/api/templates', upload.single('template'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No template file uploaded' });
    }

    const templateInfo = {
      id: req.file.filename,
      name: req.file.originalname,
      path: `/templates/${req.file.filename}`,
      savedPath: req.file.path,
      fields: [], // Initialize with empty fields array
    };

    // Save template metadata
    const metadataPath = path.join(
      'templates',
      `${req.file.filename}.meta.json`
    );
    await fs.writeFile(metadataPath, JSON.stringify(templateInfo, null, 2));

    res.json({
      message: 'Template uploaded successfully',
      template: templateInfo,
    });
  } catch (error) {
    console.error('Error uploading template:', error);
    res
      .status(500)
      .json({ error: error.message || 'Failed to upload template' });
  }
});

// Generate certificates
app.post(
  '/api/generate',
  upload.fields([
    { name: 'template', maxCount: 1 },
    { name: 'csvFile', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { templateId } = req.body;
      let templatePath;
      let fieldMappings = null;

      // Determine template source
      if (req.files.template && req.files.template[0]) {
        templatePath = req.files.template[0].path;
      } else if (templateId) {
        templatePath = path.join('templates', templateId);

        // Load field mappings if they exist
        const metadataPath = path.join('templates', `${templateId}.meta.json`);
        try {
          const metaContent = await fs.readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(metaContent);
          fieldMappings =
            metadata.fields && metadata.fields.length > 0
              ? metadata.fields
              : null;
        } catch (err) {
          // No metadata, will use default field placement
        }
      } else {
        return res.status(400).json({ error: 'No template provided' });
      }

      // Check if CSV file is uploaded
      if (!req.files.csvFile || !req.files.csvFile[0]) {
        return res.status(400).json({ error: 'No CSV file uploaded' });
      }

      const dataFilePath = req.files.csvFile[0].path;

      // Parse CSV or Excel file
      const records = await parseDataFile(dataFilePath);

      if (records.length === 0) {
        return res.status(400).json({ error: 'Data file is empty or invalid' });
      }

      // Get field mappings from request body if provided (overrides template mappings)
      const requestFieldMappings = req.body.fieldMappings
        ? JSON.parse(req.body.fieldMappings)
        : null;
      if (requestFieldMappings) {
        fieldMappings = requestFieldMappings;
      }

      // Generate certificates
      const result = await generateCertificates(
        templatePath,
        records,
        fieldMappings
      );

      // Clean up uploaded data file
      await fs
        .unlink(dataFilePath)
        .catch((err) => console.error('Error deleting data file:', err));

      res.json({
        message: 'Certificates generated successfully',
        count: result.certificates.length,
        zipPath: result.zipPath,
        downloadUrl: `/output/${path.basename(result.zipPath)}`,
      });
    } catch (error) {
      console.error('Error generating certificates:', error);
      res
        .status(500)
        .json({ error: error.message || 'Failed to generate certificates' });
    }
  }
);

// Delete template
app.delete('/api/templates/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const templatePath = path.join('templates', templateId);
    const metadataPath = path.join('templates', `${templateId}.meta.json`);

    await fs.unlink(templatePath);

    // Also delete metadata if exists
    try {
      await fs.unlink(metadataPath);
    } catch (err) {
      // Metadata file might not exist
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Save field mappings for a template
app.post('/api/templates/:templateId/fields', async (req, res) => {
  try {
    const { templateId } = req.params;
    const { name, fields } = req.body;

    if (!fields || !Array.isArray(fields)) {
      return res.status(400).json({ error: 'Invalid fields data' });
    }

    const templatePath = path.join('templates', templateId);

    // Check if template exists
    try {
      await fs.access(templatePath);
    } catch {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Save metadata with field mappings
    const metadata = {
      id: templateId,
      name: name || templateId,
      path: `/templates/${templateId}`,
      savedPath: templatePath,
      fields: fields,
    };

    const metadataPath = path.join('templates', `${templateId}.meta.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    res.json({
      message: 'Field mappings saved successfully',
      template: metadata,
    });
  } catch (error) {
    console.error('Error saving field mappings:', error);
    res
      .status(500)
      .json({ error: error.message || 'Failed to save field mappings' });
  }
});

// Get field mappings for a template
app.get('/api/templates/:templateId/fields', async (req, res) => {
  try {
    const { templateId } = req.params;
    const metadataPath = path.join('templates', `${templateId}.meta.json`);

    try {
      const metaContent = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metaContent);
      res.json({ fields: metadata.fields || [] });
    } catch (err) {
      res.json({ fields: [] });
    }
  } catch (error) {
    console.error('Error fetching field mappings:', error);
    res.status(500).json({ error: 'Failed to fetch field mappings' });
  }
});

// Font management endpoints

// Get all uploaded fonts
app.get('/api/fonts', async (req, res) => {
  try {
    const fontsDir = 'fonts';
    const files = await fs.readdir(fontsDir);
    const fonts = files
      .filter((file) => /\.(ttf|otf)$/i.test(file))
      .map((file) => ({
        id: file,
        name: file, // Keep the full filename with extension
        path: `/fonts/${file}`,
      }));

    res.json({ fonts });
  } catch (error) {
    console.error('Error fetching fonts:', error);
    res.status(500).json({ error: 'Failed to fetch fonts' });
  }
});

// Upload custom font
app.post('/api/fonts', upload.single('font'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No font file uploaded' });
    }

    const fontInfo = {
      id: req.file.filename,
      name: req.file.originalname, // Keep the full filename with extension
      path: `/fonts/${req.file.filename}`,
      savedPath: req.file.path,
    };

    res.json({
      message: 'Font uploaded successfully',
      font: fontInfo,
    });
  } catch (error) {
    console.error('Error uploading font:', error);
    res.status(500).json({ error: error.message || 'Failed to upload font' });
  }
});

// Delete font
app.delete('/api/fonts/:fontId', async (req, res) => {
  try {
    const { fontId } = req.params;
    const fontPath = path.join('fonts', fontId);

    await fs.unlink(fontPath);

    res.json({ message: 'Font deleted successfully' });
  } catch (error) {
    console.error('Error deleting font:', error);
    res.status(500).json({ error: 'Failed to delete font' });
  }
});

// Serve static files from templates and fonts directories
app.use('/templates', express.static('templates'));
app.use('/fonts', express.static('fonts'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Certificate Generator API is running' });
});

// Start server
const startServer = async () => {
  await initDirectories();
  app.listen(PORT, () => {
    console.log(
      `Certificate Generator Server running on http://localhost:${PORT}`
    );
    console.log(`Open your browser and navigate to http://localhost:${PORT}`);
  });
};

startServer();
