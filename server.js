const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { parse } = require('csv-parse/sync');
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
  const dirs = ['uploads', 'output', 'templates'];
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
    const uploadDir = file.fieldname === 'template' ? 'templates' : 'uploads';
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(
      file.originalname
    )}`;
    cb(null, uniqueName);
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
      const allowedTypes = /csv/;
      const extname = allowedTypes.test(
        path.extname(file.originalname).toLowerCase()
      );

      if (extname) {
        return cb(null, true);
      } else {
        cb(new Error('Only CSV files are allowed!'));
      }
    }
    cb(null, true);
  },
});

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

      const csvPath = req.files.csvFile[0].path;

      // Parse CSV file
      const csvContent = await fs.readFile(csvPath, 'utf-8');
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      if (records.length === 0) {
        return res.status(400).json({ error: 'CSV file is empty or invalid' });
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

      // Clean up uploaded CSV
      await fs
        .unlink(csvPath)
        .catch((err) => console.error('Error deleting CSV:', err));

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

// Serve static files from templates directory
app.use('/templates', express.static('templates'));

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
