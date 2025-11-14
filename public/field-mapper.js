// State
let state = {
  templateImage: null,
  templateId: null,
  fields: [],
  csvColumns: [],
  canvas: null,
  ctx: null,
  scale: 1,
  nextFieldId: 1,
};

// DOM Elements
const canvas = document.getElementById('templateCanvas');
const ctx = canvas.getContext('2d');
const canvasWrapper = document.getElementById('canvasWrapper');
const fieldList = document.getElementById('fieldList');
const addFieldBtn = document.getElementById('addFieldBtn');
const saveTemplateBtn = document.getElementById('saveTemplateWithFields');
const csvFileMapper = document.getElementById('csvFileMapper');
const csvColumnsDisplay = document.getElementById('csvColumnsDisplay');
const notification = document.getElementById('notification');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeMapper();
});

function initializeMapper() {
  // Get template ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const templateId = urlParams.get('templateId');

  if (!templateId) {
    showNotification('No template specified. Redirecting...', 'error');
    setTimeout(() => (window.location.href = '/'), 2000);
    return;
  }

  state.templateId = templateId;

  // Load template from server
  const templateSrc = `/templates/${templateId}`;
  loadTemplateImage(templateSrc);

  // Load existing field mappings if they exist
  loadExistingFieldMappings(templateId);

  // Event listeners
  canvas.addEventListener('click', handleCanvasClick);
  csvFileMapper.addEventListener('change', handleCSVUpload);
  saveTemplateBtn.addEventListener('click', handleSaveTemplate);
}

function loadTemplateImage(src) {
  const img = new Image();
  img.onload = () => {
    state.templateImage = img;

    // Set canvas size to image size
    canvas.width = img.width;
    canvas.height = img.height;

    // Draw image
    ctx.drawImage(img, 0, 0);

    showNotification('Template loaded! Click to add fields.', 'success');
  };
  img.onerror = () => {
    showNotification('Failed to load template image', 'error');
  };
  img.src = src;
}

function handleCanvasClick(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const x = Math.round((e.clientX - rect.left) * scaleX);
  const y = Math.round((e.clientY - rect.top) * scaleY);

  addField(x, y);
}

function addField(x, y, columnName = null) {
  const csvCol = columnName || state.csvColumns[0] || 'name';

  const field = {
    id: state.nextFieldId++,
    csvColumn: csvCol,
    x: x,
    y: y,
    fontSize: 36,
    font: 'Helvetica-Bold',
    color: '#000000',
    align: 'left', // Default to left so text starts at clicked point
    width: 500,
  };

  state.fields.push(field);
  redrawCanvas();
  renderFieldList();
  showNotification(`Field "${csvCol}" added at (${x}, ${y})`, 'success');
}

function redrawCanvas() {
  // Clear and redraw template
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state.templateImage) {
    ctx.drawImage(state.templateImage, 0, 0);
  }

  // Draw markers for each field
  state.fields.forEach((field) => {
    // Draw crosshair
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 2;

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(field.x, field.y - 15);
    ctx.lineTo(field.x, field.y + 15);
    ctx.stroke();

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(field.x - 15, field.y);
    ctx.lineTo(field.x + 15, field.y);
    ctx.stroke();

    // Draw circle
    ctx.beginPath();
    ctx.arc(field.x, field.y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#667eea';
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw label
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#667eea';
    ctx.textAlign = 'center';
    ctx.fillText(field.csvColumn, field.x, field.y - 25);
  });
}

function renderFieldList() {
  if (state.fields.length === 0) {
    fieldList.innerHTML =
      '<p style="text-align: center; color: #999;">No fields added yet. Click on the template to start.</p>';
    return;
  }

  fieldList.innerHTML = state.fields
    .map(
      (field) => `
        <div class="field-item" data-field-id="${field.id}">
            <div class="field-item-header">
                <strong>${field.csvColumn}</strong>
                <button class="btn-delete" onclick="deleteField(${
                  field.id
                })">🗑️ Delete</button>
            </div>
            <div class="field-controls">
                <div class="control-group">
                    <label>CSV Column:</label>
                    <select onchange="updateField(${
                      field.id
                    }, 'csvColumn', this.value)">
                        ${
                          state.csvColumns.length > 0
                            ? state.csvColumns
                                .map(
                                  (col) =>
                                    `<option value="${col}" ${
                                      field.csvColumn === col ? 'selected' : ''
                                    }>${col}</option>`
                                )
                                .join('')
                            : `<option value="name" ${
                                field.csvColumn === 'name' ? 'selected' : ''
                              }>name</option>
                               <option value="course" ${
                                 field.csvColumn === 'course' ? 'selected' : ''
                               }>course</option>
                               <option value="date" ${
                                 field.csvColumn === 'date' ? 'selected' : ''
                               }>date</option>`
                        }
                    </select>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div class="control-group">
                        <label>X Position:</label>
                        <input type="number" value="${field.x}" 
                               onchange="updateField(${
                                 field.id
                               }, 'x', parseInt(this.value))">
                    </div>
                    <div class="control-group">
                        <label>Y Position:</label>
                        <input type="number" value="${field.y}" 
                               onchange="updateField(${
                                 field.id
                               }, 'y', parseInt(this.value))">
                    </div>
                </div>
                
                <div class="control-group">
                    <label>Font Size:</label>
                    <input type="number" value="${
                      field.fontSize
                    }" min="12" max="120"
                           onchange="updateField(${
                             field.id
                           }, 'fontSize', parseInt(this.value))">
                </div>
                
                <div class="control-group">
                    <label>Font:</label>
                    <select onchange="updateField(${
                      field.id
                    }, 'font', this.value)">
                        <option value="Helvetica" ${
                          field.font === 'Helvetica' ? 'selected' : ''
                        }>Helvetica</option>
                        <option value="Helvetica-Bold" ${
                          field.font === 'Helvetica-Bold' ? 'selected' : ''
                        }>Helvetica Bold</option>
                        <option value="Times-Roman" ${
                          field.font === 'Times-Roman' ? 'selected' : ''
                        }>Times Roman</option>
                        <option value="Courier" ${
                          field.font === 'Courier' ? 'selected' : ''
                        }>Courier</option>
                    </select>
                </div>
                
                <div class="control-group">
                    <label>Color:</label>
                    <input type="color" value="${field.color}"
                           onchange="updateField(${
                             field.id
                           }, 'color', this.value)">
                </div>
                
                <div class="control-group">
                    <label>Alignment:</label>
                    <select onchange="updateField(${
                      field.id
                    }, 'align', this.value)">
                        <option value="left" ${
                          field.align === 'left' ? 'selected' : ''
                        }>Left</option>
                        <option value="center" ${
                          field.align === 'center' ? 'selected' : ''
                        }>Center</option>
                        <option value="right" ${
                          field.align === 'right' ? 'selected' : ''
                        }>Right</option>
                    </select>
                </div>
                
                <div class="control-group">
                    <label>Max Width:</label>
                    <input type="number" value="${
                      field.width
                    }" min="100" max="2000"
                           onchange="updateField(${
                             field.id
                           }, 'width', parseInt(this.value))">
                </div>
            </div>
        </div>
    `
    )
    .join('');
}

function updateField(fieldId, property, value) {
  const field = state.fields.find((f) => f.id === fieldId);
  if (field) {
    field[property] = value;
    redrawCanvas();
    showNotification(`Field ${fieldId} updated`, 'info');
  }
}

function deleteField(fieldId) {
  state.fields = state.fields.filter((f) => f.id !== fieldId);
  redrawCanvas();
  renderFieldList();
  showNotification(`Field ${fieldId} deleted`, 'info');
}

function handleCSVUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const csvText = e.target.result;
    const lines = csvText.trim().split('\n');

    if (lines.length === 0) {
      showNotification('CSV file is empty', 'error');
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim());
    state.csvColumns = headers;

    // Display columns
    csvColumnsDisplay.innerHTML = `
            <div class="csv-columns">
                ${headers
                  .map(
                    (col) =>
                      `<span class="csv-column-tag" onclick="quickAddField('${col}')">${col}</span>`
                  )
                  .join('')}
            </div>
            <p style="margin-top: 10px; font-size: 0.85rem; color: #666;">
                Click a column name, then click on template to position it. Click "Add All Fields" to add unmapped columns.
            </p>
            <button class="btn btn-secondary" onclick="addAllUnmappedFields()" style="margin-top: 10px; width: 100%;">
                ➕ Add All Unmapped Fields
            </button>
        `;

    // Update existing field dropdowns
    renderFieldList();

    showNotification(`Loaded ${headers.length} columns from CSV`, 'success');
  };
  reader.readAsText(file);
}

function quickAddField(columnName) {
  // Set a pending column and wait for canvas click
  showNotification(
    `Click on the template to place "${columnName}" field`,
    'info'
  );

  // Temporarily store the column selection
  const originalHandler = canvas.onclick;
  canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    const field = {
      id: state.nextFieldId++,
      csvColumn: columnName,
      x: x,
      y: y,
      fontSize: 36,
      font: 'Helvetica-Bold',
      color: '#000000',
      align: 'center',
      width: 500,
    };

    state.fields.push(field);
    redrawCanvas();
    renderFieldList();
    showNotification(`"${columnName}" field added at (${x}, ${y})`, 'success');

    // Restore original handler
    canvas.onclick = originalHandler;
  };
}

async function loadExistingFieldMappings(templateId) {
  try {
    const response = await fetch(`/api/templates/${templateId}/fields`);
    const data = await response.json();

    if (data.fields && data.fields.length > 0) {
      state.fields = data.fields;
      state.nextFieldId = Math.max(...data.fields.map((f) => f.id)) + 1;
      redrawCanvas();
      renderFieldList();
      showNotification(
        `Loaded ${data.fields.length} existing field mappings`,
        'info'
      );
    }
  } catch (error) {
    console.error('Error loading field mappings:', error);
  }
}

async function handleSaveTemplate() {
  if (state.fields.length === 0) {
    showNotification('Please add at least one field before saving', 'error');
    return;
  }

  const templateName = prompt('Enter a name for this template:');
  if (!templateName) return;

  try {
    const templateId = state.templateId;

    if (!templateId) {
      showNotification('Template ID not found', 'error');
      return;
    }

    // Save field mappings
    const response = await fetch(`/api/templates/${templateId}/fields`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: templateName,
        fields: state.fields,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      showNotification('Field mappings saved successfully!', 'success');
      setTimeout(() => {
        window.close();
      }, 1500);
    } else {
      throw new Error(data.error || 'Failed to save template');
    }
  } catch (error) {
    console.error('Error saving template:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

function showNotification(message, type = 'info') {
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.style.display = 'block';

  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}

function addAllUnmappedFields() {
  if (state.csvColumns.length === 0) {
    showNotification('Please upload a CSV file first', 'error');
    return;
  }

  // Get already mapped columns
  const mappedColumns = state.fields.map((f) => f.csvColumn);

  // Find unmapped columns
  const unmappedColumns = state.csvColumns.filter(
    (col) => !mappedColumns.includes(col)
  );

  if (unmappedColumns.length === 0) {
    showNotification('All CSV columns are already mapped!', 'info');
    return;
  }

  // Add fields for unmapped columns with automatic positioning
  const startY = 200;
  const spacing = 80;

  unmappedColumns.forEach((col, index) => {
    const field = {
      id: state.nextFieldId++,
      csvColumn: col,
      x: 100,
      y: startY + index * spacing,
      fontSize: 36,
      font: 'Helvetica-Bold',
      color: '#000000',
      align: 'left',
      width: 500,
    };

    state.fields.push(field);
  });

  redrawCanvas();
  renderFieldList();
  showNotification(
    `Added ${unmappedColumns.length} unmapped fields. Adjust positions as needed.`,
    'success'
  );
}

// Make functions globally available
window.updateField = updateField;
window.deleteField = deleteField;
window.quickAddField = quickAddField;
window.addAllUnmappedFields = addAllUnmappedFields;
