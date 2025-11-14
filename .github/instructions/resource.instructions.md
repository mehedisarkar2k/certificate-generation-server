How to Use This System
Upload a Template:
Go to the "Upload Template" page
Upload a certificate image (PNG recommended)
Click on the image to mark dynamic fields
Enter field names and font sizes
Save the template with a name
Generate Certificates:
Go to the "Generate Certificates" page
Select a saved template
Upload a CSV file with data
Click "Generate Certificates"
Download the ZIP file containing all generated PDF certificates
Manage Templates:
View all saved templates on the "Templates" page
Use any template to generate new certificates
Technical Details
The system uses Flask as the web framework
SQLite database to store template information
PIL (Pillow) for image processing
ReportLab for PDF generation
Pandas for CSV processing
Bootstrap for the UI

---

import os
import io
import json
import base64
import pandas as pd
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from flask import Flask, request, jsonify, render_template, redirect, url_for, send_file
import sqlite3
from werkzeug.utils import secure_filename

app = Flask(**name**)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['TEMPLATES_FOLDER'] = 'templates'
app.config['OUTPUT_FOLDER'] = 'output'
app.config['DATABASE'] = 'certificates.db'

# Ensure folders exist

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['TEMPLATES_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)

# Initialize database

def init_db():
conn = sqlite3.connect(app.config['DATABASE'])
cursor = conn.cursor()
cursor.execute('''
CREATE TABLE IF NOT EXISTS templates (
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT NOT NULL,
image_path TEXT NOT NULL,
fields TEXT NOT NULL
)
''')
conn.commit()
conn.close()

init_db()

@app.route('/')
def index():
return render_template('index.html')

@app.route('/upload_template', methods=['GET', 'POST'])
def upload_template():
if request.method == 'POST':
if 'template' not in request.files:
return redirect(request.url)

        file = request.files['template']
        if file.filename == '':
            return redirect(request.url)

        if file:
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['TEMPLATES_FOLDER'], filename)
            file.save(filepath)

            # Store template info in session for field marking
            return render_template('mark_fields.html', template_image=filename)

    return render_template('upload_template.html')

@app.route('/save_template', methods=['POST'])
def save_template():
template_name = request.form.get('template_name')
template_image = request.form.get('template_image')
fields_json = request.form.get('fields')

    conn = sqlite3.connect(app.config['DATABASE'])
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO templates (name, image_path, fields) VALUES (?, ?, ?)',
        (template_name, template_image, fields_json)
    )
    conn.commit()
    conn.close()

    return redirect(url_for('index'))

@app.route('/templates')
def list_templates():
conn = sqlite3.connect(app.config['DATABASE'])
cursor = conn.cursor()
cursor.execute('SELECT id, name FROM templates')
templates = cursor.fetchall()
conn.close()

    return render_template('templates.html', templates=templates)

@app.route('/generate_certificates', methods=['GET', 'POST'])
def generate_certificates():
if request.method == 'POST':
template_id = request.form.get('template_id')
csv_file = request.files.get('csv_file')

        if not template_id or not csv_file:
            return redirect(request.url)

        # Get template info
        conn = sqlite3.connect(app.config['DATABASE'])
        cursor = conn.cursor()
        cursor.execute('SELECT name, image_path, fields FROM templates WHERE id = ?', (template_id,))
        template = cursor.fetchone()
        conn.close()

        if not template:
            return "Template not found"

        template_name, template_image, fields_json = template
        fields = json.loads(fields_json)

        # Process CSV
        df = pd.read_csv(csv_file)

        # Create output directory
        output_dir = os.path.join(app.config['OUTPUT_FOLDER'], template_name)
        os.makedirs(output_dir, exist_ok=True)

        # Generate certificates
        for index, row in df.iterrows():
            output_path = os.path.join(output_dir, f"certificate_{index}.pdf")
            generate_certificate(
                os.path.join(app.config['TEMPLATES_FOLDER'], template_image),
                fields,
                row.to_dict(),
                output_path
            )

        # Create a zip file with all certificates
        import zipfile
        zip_path = os.path.join(app.config['OUTPUT_FOLDER'], f"{template_name}_certificates.zip")
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for root, _, files in os.walk(output_dir):
                for file in files:
                    zipf.write(os.path.join(root, file), file)

        return send_file(zip_path, as_attachment=True)

    # Get templates for dropdown
    conn = sqlite3.connect(app.config['DATABASE'])
    cursor = conn.cursor()
    cursor.execute('SELECT id, name FROM templates')
    templates = cursor.fetchall()
    conn.close()

    return render_template('generate_certificates.html', templates=templates)

def generate_certificate(template_path, fields, data, output_path): # Open the template image
img = Image.open(template_path)

    # Create a new image with the same size and white background
    width, height = img.size
    new_img = Image.new('RGB', (width, height), (255, 255, 255))

    # Paste the template image
    new_img.paste(img, (0, 0))

    # Create a drawing context
    draw = ImageDraw.Draw(new_img)

    # Add text fields
    for field in fields:
        field_name = field['name']
        x = int(field['x'])
        y = int(field['y'])
        font_size = int(field.get('fontSize', 24))

        if field_name in data:
            text = str(data[field_name])

            try:
                font = ImageFont.truetype("arial.ttf", font_size)
            except:
                font = ImageFont.load_default()

            draw.text((x, y), text, fill=(0, 0, 0), font=font)

    # Save the modified image
    temp_img_path = os.path.join(app.config['OUTPUT_FOLDER'], 'temp_img.png')
    new_img.save(temp_img_path)

    # Create PDF
    c = canvas.Canvas(output_path, pagesize=letter)

    # Calculate position to center the image
    img_width, img_height = new_img.size
    page_width, page_height = letter
    x = (page_width - img_width) / 2
    y = (page_height - img_height) / 2

    # Add image to PDF
    c.drawImage(ImageReader(temp_img_path), x, y)
    c.save()

    # Clean up temp image
    os.remove(temp_img_path)

if **name** == '**main**':
app.run(debug=True)
