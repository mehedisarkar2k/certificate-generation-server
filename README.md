# 📜 Certificate Generator

A powerful web application for generating professional certificates in bulk. Upload a template image, provide CSV data, and generate hundreds of personalized PDF certificates instantly.

## ✨ Features

- **Web-Based Interface**: User-friendly web application with drag-and-drop support
- **Visual Field Mapper**: Click-to-position interface for defining where text appears on certificates
- **Template Management**: Upload and save certificate templates for future use
- **Bulk Generation**: Process hundreds of certificates from CSV data
- **PDF Output**: High-quality PDF certificates ready for distribution
- **Custom Field Positioning**: Precisely control where each field appears with visual mapping
- **Field Customization**: Configure font, size, color, and alignment for each field
- **Template Reuse**: Save templates with field mappings for repeated use
- **CSV Support**: Easy data import with CSV format
- **ZIP Download**: All certificates packaged in a single ZIP file

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Start the server:**

   ```bash
   npm start
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000`

### Development Mode

For development with auto-reload:

```bash
npm run dev
```

## 📖 How to Use

### Step 1: Prepare Your Template

Create a certificate template as an image file (PNG, JPG, or JPEG). Leave space for dynamic text fields like names, dates, etc.

**Recommended template size**: 1920x1280 pixels (landscape) or 1280x1920 pixels (portrait)

### Step 2: Map Fields on Template (NEW!)

After uploading a template, click **"🎯 Map Fields on Template"** to:

1. Click on the template where you want text to appear
2. For each click, configure:
   - **CSV Column**: Which data field to use
   - **Font & Size**: Typography settings
   - **Color**: Text color
   - **Alignment**: Left, center, or right
   - **Position**: Fine-tune X/Y coordinates
3. Save the template with field mappings

**Pro Tip**: Upload your CSV first to see available columns, then map them visually!

### Step 2: Prepare Your CSV Data

Create a CSV file with your certificate data. The first row should contain column headers.

**Example CSV format:**

```csv
name,course,date
John Doe,Web Development,2024-01-15
Jane Smith,Data Science,2024-01-16
Mike Johnson,AI & Machine Learning,2024-01-17
```

**Common CSV columns:**

- `name` or `Name`: Recipient's full name
- `course` or `Course`: Course or program name
- `date` or `Date`: Completion or issue date
- Add any other fields your certificate needs

### Step 3: Generate Certificates

1. **Select or Upload Template:**

   - Choose an existing saved template, OR
   - Upload a new template image
   - Optional: Save the new template for future use

2. **Upload CSV Data:**

   - Drag and drop your CSV file, OR
   - Click to browse and select your CSV file
   - Preview shows first 5 rows

3. **Generate:**
   - Click "Generate Certificates"
   - Wait for processing (typically 1-2 seconds per certificate)
   - Download the ZIP file containing all certificates

## 📁 Project Structure

```
certificate-generation/
├── server.js                    # Express server and API routes
├── services/
│   └── certificateGenerator.js  # Core certificate generation logic
├── public/
│   ├── index.html              # Main web interface
│   ├── styles.css              # Styling
│   └── app.js                  # Frontend JavaScript
├── templates/                  # Saved certificate templates
├── uploads/                    # Temporary CSV uploads
├── output/                     # Generated certificates and ZIP files
├── package.json               # Dependencies and scripts
└── README.md                  # This file
```

## 🎨 Customization

### Default Text Placement

The system automatically detects common CSV columns and places them on the certificate:

- **Name field**: Large, bold text in upper-middle area (40% from top)
- **Course/Program**: Medium text below name (55% from top)
- **Date**: Smaller text near bottom (75% from top)
- **Other fields**: Additional small text at bottom

### Advanced: Custom Field Mapping

For precise control over text placement, you can extend the API with custom field mappings:

```javascript
const fieldMappings = [
  {
    csvColumn: 'name',
    x: 100,
    y: 500,
    fontSize: 48,
    font: 'Helvetica-Bold',
    color: '#000000',
    align: 'center',
    width: 800,
  },
];
```

## 🔧 API Endpoints

### GET `/api/templates`

Get all saved templates.

### POST `/api/templates`

Upload and save a new template.

**Body**: `multipart/form-data` with `template` file

### POST `/api/generate`

Generate certificates from template and CSV.

**Body**: `multipart/form-data` with:

- `csvFile`: CSV data file
- `template`: Template image (optional if using templateId)
- `templateId`: ID of saved template (optional if uploading new template)

### DELETE `/api/templates/:templateId`

Delete a saved template.

## 📦 Dependencies

- **express**: Web server framework
- **multer**: File upload handling
- **csv-parse**: CSV parsing
- **pdfkit**: PDF generation
- **jimp**: Image processing
- **archiver**: ZIP file creation
- **uuid**: Unique ID generation

## 🛠️ Troubleshooting

### Issue: "No template provided"

**Solution**: Make sure you either select an existing template or upload a new one.

### Issue: "CSV file is empty or invalid"

**Solution**: Check that your CSV:

- Has a header row with column names
- Contains at least one data row
- Is properly formatted with commas

### Issue: Text doesn't appear on certificate

**Solution**:

- Check that your CSV columns match expected names (name, course, date)
- Ensure your template has enough space for text
- Try lighter template backgrounds for better text visibility

### Issue: Generated PDFs are too large

**Solution**: Use compressed images for templates (PNG with optimization or JPEG with 80-90% quality)

## 🎯 Best Practices

1. **Template Images**: Use high-resolution images (1920x1280 or higher) for best quality
2. **CSV Headers**: Use lowercase column names (name, date, course) for automatic detection
3. **File Sizes**: Keep template images under 5MB for faster processing
4. **Batch Size**: Process up to 500 certificates at once for optimal performance
5. **Template Design**: Leave clear, light-colored areas for text overlay

## 🔐 Security Notes

- File uploads are validated by type and size
- Temporary files are cleaned up after processing
- All uploads are stored locally (not shared publicly)

## 📝 License

ISC

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📞 Support

For issues or questions, please create an issue in the repository.

---

**Built with ❤️ for bulk certificate generation**
