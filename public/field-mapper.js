// State
let state = {
  templateImage: null,
  templateId: null,
  fields: [],
  csvColumns: [],
  csvData: null, // Store first row of CSV for preview
  canvas: null,
  ctx: null,
  scale: 1,
  nextFieldId: 1,
  customFonts: [], // List of uploaded custom fonts
  draggingField: null, // Field being dragged
  draggingHandle: null, // 'left', 'right', or null
  selectedFieldId: null, // Currently selected field
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
const fontFileInput = document.getElementById('fontFileInput');
const uploadFontBtn = document.getElementById('uploadFontBtn');
const fontListDisplay = document.getElementById('fontListDisplay');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeMapper();
});

async function initializeMapper() {
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

  // Load custom fonts first (await to ensure they're loaded before fields render)
  await loadCustomFonts();

  // Load existing field mappings if they exist (after fonts are loaded)
  await loadExistingFieldMappings(templateId);

  // Event listeners
  canvas.addEventListener('mousedown', handleCanvasMouseDown);
  canvas.addEventListener('mousemove', handleCanvasMouseMove);
  canvas.addEventListener('mouseup', handleCanvasMouseUp);
  canvas.addEventListener('click', handleCanvasClick);
  csvFileMapper.addEventListener('change', handleCSVUpload);
  fontFileInput.addEventListener('change', handleFontFileSelect);
  uploadFontBtn.addEventListener('click', handleFontUpload);
  saveTemplateBtn.addEventListener('click', handleSaveTemplate);

  // Preview button
  const generatePreviewBtn = document.getElementById('generatePreviewBtn');
  if (generatePreviewBtn) {
    generatePreviewBtn.addEventListener('click', handleGeneratePreview);
  }
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
  // Don't add field if we just finished dragging
  if (state.draggingField) {
    state.draggingField = null;
    state.draggingHandle = null;
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const x = Math.round((e.clientX - rect.left) * scaleX);
  const y = Math.round((e.clientY - rect.top) * scaleY);

  // Check if clicking on existing line to select it
  for (let field of state.fields) {
    const lineY = field.y;
    const lineStartX = field.x;
    const lineEndX = field.x + (field.width || 500);

    if (
      Math.abs(y - lineY) < 10 &&
      x >= lineStartX - 10 &&
      x <= lineEndX + 10
    ) {
      state.selectedFieldId = field.id;
      redrawCanvas();
      return;
    }
  }

  // Otherwise add new field
  addField(x, y);
}

function handleCanvasMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const x = Math.round((e.clientX - rect.left) * scaleX);
  const y = Math.round((e.clientY - rect.top) * scaleY);

  // Check if clicking on a handle
  for (let field of state.fields) {
    const lineY = field.y;
    const lineStartX = field.x;
    const lineEndX = field.x + (field.width || 500);
    const handleSize = 10;

    // Check left handle
    if (
      Math.abs(x - lineStartX) < handleSize &&
      Math.abs(y - lineY) < handleSize
    ) {
      state.draggingField = field;
      state.draggingHandle = 'left';
      canvas.style.cursor = 'ew-resize';
      e.preventDefault();
      return;
    }

    // Check right handle
    if (
      Math.abs(x - lineEndX) < handleSize &&
      Math.abs(y - lineY) < handleSize
    ) {
      state.draggingField = field;
      state.draggingHandle = 'right';
      canvas.style.cursor = 'ew-resize';
      e.preventDefault();
      return;
    }
  }
}

function handleCanvasMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const x = Math.round((e.clientX - rect.left) * scaleX);
  const y = Math.round((e.clientY - rect.top) * scaleY);

  // If dragging, update field position/width
  if (state.draggingField && state.draggingHandle) {
    if (state.draggingHandle === 'left') {
      const oldX = state.draggingField.x;
      const oldWidth = state.draggingField.width || 500;
      state.draggingField.x = x;
      state.draggingField.width = oldX + oldWidth - x;
    } else if (state.draggingHandle === 'right') {
      state.draggingField.width = x - state.draggingField.x;
    }
    redrawCanvas();
    renderFieldList();
    e.preventDefault();
    return;
  }

  // Change cursor when hovering over handles
  let overHandle = false;
  for (let field of state.fields) {
    const lineY = field.y;
    const lineStartX = field.x;
    const lineEndX = field.x + (field.width || 500);
    const handleSize = 10;

    if (
      (Math.abs(x - lineStartX) < handleSize &&
        Math.abs(y - lineY) < handleSize) ||
      (Math.abs(x - lineEndX) < handleSize && Math.abs(y - lineY) < handleSize)
    ) {
      overHandle = true;
      break;
    }
  }

  canvas.style.cursor = overHandle ? 'ew-resize' : 'crosshair';
}

function handleCanvasMouseUp(e) {
  if (state.draggingField) {
    state.draggingField = null;
    state.draggingHandle = null;
    canvas.style.cursor = 'crosshair';
  }
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
    fontWeight: 'normal',
    color: '#000000',
    align: 'left', // Default to left so text starts at clicked point
    width: 500,
    endX: x + 500, // Initialize end point
    endY: y + 50, // Initialize end Y
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

  // Draw fields with horizontal alignment lines
  state.fields.forEach((field) => {
    const isSelected = field.id === state.selectedFieldId;
    const lineY = field.y;
    const lineStartX = field.x;
    const lineEndX = field.x + (field.width || 500);

    // Draw horizontal alignment line
    ctx.strokeStyle = isSelected ? '#ff6b6b' : '#667eea';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lineStartX, lineY);
    ctx.lineTo(lineEndX, lineY);
    ctx.stroke();

    // Draw draggable handles at line ends
    const handleSize = 10;

    // Left handle
    ctx.fillStyle = isSelected ? '#ff6b6b' : '#667eea';
    ctx.fillRect(
      lineStartX - handleSize / 2,
      lineY - handleSize / 2,
      handleSize,
      handleSize
    );
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      lineStartX - handleSize / 2,
      lineY - handleSize / 2,
      handleSize,
      handleSize
    );

    // Right handle
    ctx.fillRect(
      lineEndX - handleSize / 2,
      lineY - handleSize / 2,
      handleSize,
      handleSize
    );
    ctx.strokeRect(
      lineEndX - handleSize / 2,
      lineY - handleSize / 2,
      handleSize,
      handleSize
    );

    // Draw preview text if CSV data is available
    if (state.csvData && state.csvData[field.csvColumn]) {
      const previewText = state.csvData[field.csvColumn];
      const fontSize = field.fontSize || 36;
      const fontWeight = field.fontWeight || 'normal';

      ctx.font = `${fontWeight} ${fontSize}px Arial`;
      ctx.fillStyle = field.color || '#000000';
      ctx.textBaseline = 'top';

      // Apply alignment
      const align = field.align || 'left';
      let textX = field.x;

      if (align === 'center') {
        textX = field.x + (field.width || 500) / 2;
        ctx.textAlign = 'center';
      } else if (align === 'right') {
        textX = field.x + (field.width || 500);
        ctx.textAlign = 'right';
      } else {
        ctx.textAlign = 'left';
      }

      // Draw text touching the line (slightly above for better visibility)
      ctx.fillText(
        previewText,
        textX,
        lineY - fontSize - 5,
        field.width || 500
      );
    }

    // Draw field label
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = isSelected ? '#ff6b6b' : '#667eea';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(field.csvColumn, (lineStartX + lineEndX) / 2, lineY - 5);
  });

  // Reset ctx properties
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
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
                        <optgroup label="Standard Fonts">
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
                        </optgroup>
                        ${
                          state.customFonts.length > 0
                            ? `<optgroup label="Custom Fonts">
                                ${state.customFonts
                                  .map(
                                    (font) =>
                                      `<option value="${font.id}" ${
                                        field.font === font.id ? 'selected' : ''
                                      }>${font.name}</option>`
                                  )
                                  .join('')}
                               </optgroup>`
                            : ''
                        }
                    </select>
                </div>
                
                <div class="control-group">
                    <label>Font Weight:</label>
                    <select onchange="updateField(${
                      field.id
                    }, 'fontWeight', this.value)">
                        <option value="normal" ${
                          field.fontWeight === 'normal' ? 'selected' : ''
                        }>Normal</option>
                        <option value="bold" ${
                          field.fontWeight === 'bold' ? 'selected' : ''
                        }>Bold</option>
                        <option value="100" ${
                          field.fontWeight === '100' ? 'selected' : ''
                        }>100 - Thin</option>
                        <option value="200" ${
                          field.fontWeight === '200' ? 'selected' : ''
                        }>200 - Extra Light</option>
                        <option value="300" ${
                          field.fontWeight === '300' ? 'selected' : ''
                        }>300 - Light</option>
                        <option value="400" ${
                          field.fontWeight === '400' ? 'selected' : ''
                        }>400 - Normal</option>
                        <option value="500" ${
                          field.fontWeight === '500' ? 'selected' : ''
                        }>500 - Medium</option>
                        <option value="600" ${
                          field.fontWeight === '600' ? 'selected' : ''
                        }>600 - Semi Bold</option>
                        <option value="700" ${
                          field.fontWeight === '700' ? 'selected' : ''
                        }>700 - Bold</option>
                        <option value="800" ${
                          field.fontWeight === '800' ? 'selected' : ''
                        }>800 - Extra Bold</option>
                        <option value="900" ${
                          field.fontWeight === '900' ? 'selected' : ''
                        }>900 - Black</option>
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
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div class="control-group">
                        <label>Start X:</label>
                        <input type="number" value="${field.x}" 
                               onchange="updateField(${
                                 field.id
                               }, 'x', parseInt(this.value))">
                    </div>
                    <div class="control-group">
                        <label>Start Y:</label>
                        <input type="number" value="${field.y}" 
                               onchange="updateField(${
                                 field.id
                               }, 'y', parseInt(this.value))">
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div class="control-group">
                        <label>End X:</label>
                        <input type="number" value="${
                          field.endX || field.x + (field.width || 500)
                        }" 
                               onchange="updateFieldEndPoint(${
                                 field.id
                               }, 'endX', parseInt(this.value))">
                    </div>
                    <div class="control-group">
                        <label>End Y:</label>
                        <input type="number" value="${
                          field.endY || field.y + 50
                        }" 
                               onchange="updateFieldEndPoint(${
                                 field.id
                               }, 'endY', parseInt(this.value))">
                    </div>
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

    // Parse first data row for preview
    if (lines.length > 1) {
      const firstRowValues = lines[1].split(',').map((v) => v.trim());
      state.csvData = {};
      headers.forEach((header, index) => {
        state.csvData[header] = firstRowValues[index] || '';
      });
    }

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

    // Redraw canvas to show preview values
    redrawCanvas();

    showNotification(
      `Loaded ${headers.length} columns from CSV with preview data`,
      'success'
    );
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

// Font Management Functions

// Handle font file selection
function handleFontFileSelect(e) {
  const files = e.target.files;
  const selectedFontName = document.getElementById('selectedFontName');

  if (files && files.length > 0) {
    const validExtensions = ['.ttf', '.otf'];
    const fileNames = [];
    let allValid = true;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name
        .substring(file.name.lastIndexOf('.'))
        .toLowerCase();

      if (validExtensions.includes(fileExt)) {
        fileNames.push(file.name);
      } else {
        allValid = false;
      }
    }

    if (allValid && fileNames.length > 0) {
      selectedFontName.innerHTML = `✅ Selected ${
        fileNames.length
      } font(s): <strong>${fileNames.join(
        ', '
      )}</strong> - Click "Upload Font" to save`;
      selectedFontName.style.color = '#2e7d32';
    } else if (fileNames.length > 0) {
      selectedFontName.innerHTML = `⚠️ ${fileNames.length} valid font(s) selected. Some files were invalid (only TTF/OTF allowed).`;
      selectedFontName.style.color = '#f57c00';
    } else {
      selectedFontName.innerHTML = `❌ Invalid file type(s). Please select TTF or OTF font files.`;
      selectedFontName.style.color = '#dc3545';
    }
  } else {
    selectedFontName.innerHTML = '';
  }
}

// Load custom fonts from server
async function loadCustomFonts() {
  try {
    const response = await fetch('/api/fonts');
    const data = await response.json();
    state.customFonts = data.fonts || [];
    updateFontListDisplay();

    // Re-render field list if fields exist (to show custom fonts in dropdowns)
    if (state.fields.length > 0) {
      renderFieldList();
    }
  } catch (error) {
    console.error('Error loading custom fonts:', error);
    showNotification('Failed to load custom fonts', 'error');
  }
}

// Update font list display
function updateFontListDisplay() {
  if (state.customFonts.length === 0) {
    fontListDisplay.innerHTML =
      '<em style="color: #999;">No custom fonts uploaded yet</em>';
  } else {
    fontListDisplay.innerHTML = `
      <strong>Available Custom Fonts (${
        state.customFonts.length
      }):</strong><br/>
      ${state.customFonts
        .map(
          (font) =>
            `<span style="display: inline-block; margin: 4px 6px; padding: 4px 8px; background: white; border-radius: 4px; font-size: 0.8rem; border: 1px solid #ddd;">
              📁 ${font.name}
              <button onclick="deleteFont('${font.id}')" style="margin-left: 5px; background: none; border: none; color: #dc3545; cursor: pointer; font-weight: bold;">×</button>
            </span>`
        )
        .join('')}
    `;
  }
}

// Handle font upload
async function handleFontUpload() {
  const files = fontFileInput.files;
  if (!files || files.length === 0) {
    showNotification('Please select font file(s)', 'error');
    return;
  }

  const validExtensions = ['.ttf', '.otf'];
  let successCount = 0;
  let errorCount = 0;

  showNotification(`Uploading ${files.length} font(s)...`, 'info');

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileExt = file.name
      .substring(file.name.lastIndexOf('.'))
      .toLowerCase();

    if (!validExtensions.includes(fileExt)) {
      errorCount++;
      continue;
    }

    try {
      const formData = new FormData();
      formData.append('font', file);

      const response = await fetch('/api/fonts', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        successCount++;
      } else {
        errorCount++;
        console.error(`Failed to upload ${file.name}:`, data.error);
      }
    } catch (error) {
      errorCount++;
      console.error(`Error uploading ${file.name}:`, error);
    }
  }

  if (successCount > 0) {
    showNotification(
      `${successCount} font(s) uploaded successfully!`,
      'success'
    );
    fontFileInput.value = '';
    document.getElementById('selectedFontName').innerHTML = '';
    await loadCustomFonts();
    renderFieldList(); // Re-render to show new fonts in dropdowns
  }

  if (errorCount > 0) {
    showNotification(`${errorCount} font(s) failed to upload`, 'error');
  }
}

// Delete custom font
async function deleteFont(fontId) {
  if (!confirm('Are you sure you want to delete this font?')) {
    return;
  }

  try {
    showNotification('Deleting font...', 'info');

    const response = await fetch(`/api/fonts/${fontId}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (response.ok) {
      showNotification('Font deleted successfully', 'success');
      await loadCustomFonts();
      renderFieldList(); // Re-render to update font dropdowns
    } else {
      throw new Error(data.error || 'Failed to delete font');
    }
  } catch (error) {
    console.error('Error deleting font:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

// Make font functions globally available
window.deleteFont = deleteFont;

// Preview Generation

function handleGeneratePreview() {
  if (!state.csvData) {
    showNotification('Please upload a CSV file first to preview', 'error');
    return;
  }

  if (state.fields.length === 0) {
    showNotification('Please add at least one field to preview', 'error');
    return;
  }

  generatePreview();
}

function generatePreview() {
  const modal = document.getElementById('previewModal');
  const previewCanvas = document.getElementById('previewCanvas');
  const previewCtx = previewCanvas.getContext('2d');

  // Set canvas size to template size
  previewCanvas.width = state.templateImage.width;
  previewCanvas.height = state.templateImage.height;

  // Draw template
  previewCtx.drawImage(state.templateImage, 0, 0);

  // Draw all fields with CSV data
  state.fields.forEach((field) => {
    if (state.csvData && state.csvData[field.csvColumn]) {
      const text = state.csvData[field.csvColumn];

      // Set font properties
      const fontSize = field.fontSize || 36;
      const fontWeight = field.fontWeight || 'normal';

      // Use the actual font from field settings
      let fontFamily = field.font || 'Arial';

      // Check if it's a custom font (has file extension)
      const isCustomFont = /\.(ttf|otf)$/i.test(fontFamily);
      if (isCustomFont) {
        // Extract font name without extension for canvas
        const fontName = fontFamily.replace(/\.(ttf|otf)$/i, '');
        fontFamily = `"${fontName}", Arial`;
      }

      previewCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      previewCtx.fillStyle = field.color || '#000000';

      // Set alignment
      const align = field.align || 'left';
      previewCtx.textAlign = align;
      previewCtx.textBaseline = 'top';

      // Draw text
      previewCtx.fillText(text, field.x, field.y);
    }
  });

  // Show modal
  modal.style.display = 'flex';

  // Reset text properties
  previewCtx.textAlign = 'left';
  previewCtx.textBaseline = 'alphabetic';
}

function closePreviewModal() {
  const modal = document.getElementById('previewModal');
  modal.style.display = 'none';
}

// Make preview functions globally available
window.closePreviewModal = closePreviewModal;
