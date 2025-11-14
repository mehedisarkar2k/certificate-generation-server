// State management
let state = {
  templateFile: null,
  templateId: null,
  csvFile: null,
  csvData: null,
  templates: [],
};

// DOM Elements
const templateRadios = document.querySelectorAll(
  'input[name="templateOption"]'
);
const existingTemplateSection = document.getElementById(
  'existingTemplateSection'
);
const newTemplateSection = document.getElementById('newTemplateSection');
const templateSelect = document.getElementById('templateSelect');
const refreshTemplatesBtn = document.getElementById('refreshTemplates');
const templateDropZone = document.getElementById('templateDropZone');
const templateFileInput = document.getElementById('templateFile');
const saveTemplateBtn = document.getElementById('saveTemplateBtn');
const templatePreview = document.getElementById('templatePreview');
const previewImage = document.getElementById('previewImage');

const csvDropZone = document.getElementById('csvDropZone');
const csvFileInput = document.getElementById('csvFile');
const csvPreview = document.getElementById('csvPreview');
const csvTable = document.getElementById('csvTable');
const recordCount = document.getElementById('recordCount');

const generateBtn = document.getElementById('generateBtn');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const resultSection = document.getElementById('resultSection');
const certificateCount = document.getElementById('certificateCount');
const downloadLink = document.getElementById('downloadLink');
const mapFieldsBtn = document.getElementById('mapFieldsBtn');

const notification = document.getElementById('notification');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadTemplates();
  setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
  // Template option radio buttons
  templateRadios.forEach((radio) => {
    radio.addEventListener('change', handleTemplateOptionChange);
  });

  // Refresh templates
  refreshTemplatesBtn.addEventListener('click', loadTemplates);

  // Template selection
  templateSelect.addEventListener('change', handleTemplateSelection);

  // Template file upload
  templateDropZone.addEventListener('click', () => templateFileInput.click());
  templateFileInput.addEventListener('change', handleTemplateFileSelect);
  setupDragAndDrop(
    templateDropZone,
    templateFileInput,
    handleTemplateFileSelect
  );

  // Save template button (if exists)
  if (saveTemplateBtn) {
    saveTemplateBtn.addEventListener('click', handleSaveTemplate);
  }

  // Clear template button
  const clearTemplateBtn = document.getElementById('clearTemplateBtn');
  if (clearTemplateBtn) {
    clearTemplateBtn.addEventListener('click', handleClearTemplate);
  }

  // Map fields for new template (with auto-save)
  const mapFieldsNewBtn = document.getElementById('mapFieldsNewBtn');
  if (mapFieldsNewBtn) {
    mapFieldsNewBtn.addEventListener('click', handleMapFieldsNew);
  }

  // CSV file upload
  if (csvDropZone && csvFileInput) {
    csvDropZone.addEventListener('click', () => {
      console.log('CSV drop zone clicked, triggering file input');
      csvFileInput.click();
    });
    csvFileInput.addEventListener('change', handleCSVFileSelect);
    setupDragAndDrop(csvDropZone, csvFileInput, handleCSVFileSelect);
  } else {
    console.error('CSV elements not found:', { csvDropZone, csvFileInput });
  }

  // Generate button
  if (generateBtn) {
    generateBtn.addEventListener('click', handleGenerate);
    console.log('Generate button listener attached');
  } else {
    console.error('Generate button not found!');
  }

  // Map fields button
  if (mapFieldsBtn) {
    mapFieldsBtn.addEventListener('click', handleMapFields);
  }
}

// Template option change
function handleTemplateOptionChange(e) {
  const value = e.target.value;

  if (value === 'existing') {
    existingTemplateSection.style.display = 'block';
    newTemplateSection.style.display = 'none';
    state.templateFile = null;
    if (templateSelect.value) {
      state.templateId = templateSelect.value;
    }
  } else {
    existingTemplateSection.style.display = 'none';
    newTemplateSection.style.display = 'block';
    state.templateId = null;
  }

  updateGenerateButton();
}

// Load templates
async function loadTemplates() {
  try {
    showNotification('Loading templates...', 'info');
    const response = await fetch('/api/templates');
    const data = await response.json();

    state.templates = data.templates || [];

    if (state.templates.length > 0) {
      templateSelect.innerHTML =
        '<option value="">-- Select a template --</option>' +
        state.templates
          .map((t) => `<option value="${t.id}">${t.name}</option>`)
          .join('');

      // Also create a template gallery view
      const gallery = document.getElementById('templateGallery');
      if (gallery) {
        gallery.innerHTML = state.templates
          .map(
            (t) => `
            <div class="template-card" data-template-id="${t.id}">
              <img src="${t.path}" alt="${t.name}" />
              <div class="template-card-info">
                <h4>${t.name}</h4>
                <div class="template-card-actions">
                  <button onclick="selectTemplate('${t.id}')" class="btn btn-sm">Select</button>
                  <button onclick="deleteTemplate('${t.id}', '${t.name}')" class="btn btn-sm btn-danger">🗑️</button>
                </div>
              </div>
            </div>
          `
          )
          .join('');
      }
    } else {
      templateSelect.innerHTML =
        '<option value="">No templates saved yet</option>';
      const gallery = document.getElementById('templateGallery');
      if (gallery) {
        gallery.innerHTML =
          '<p style="text-align: center; color: #888; padding: 20px;">No templates yet. Upload one below!</p>';
      }
    }

    showNotification(`Loaded ${state.templates.length} template(s)`, 'success');
  } catch (error) {
    console.error('Error loading templates:', error);
    showNotification('Failed to load templates', 'error');
    templateSelect.innerHTML =
      '<option value="">Error loading templates</option>';
  }
}

// Handle template selection
function handleTemplateSelection(e) {
  const templateId = e.target.value;

  if (templateId) {
    state.templateId = templateId;
    const template = state.templates.find((t) => t.id === templateId);

    if (template) {
      previewImage.src = template.path;
      templatePreview.style.display = 'block';
      mapFieldsBtn.style.display = 'inline-block';
      mapFieldsBtn.dataset.templateId = templateId;
      mapFieldsBtn.dataset.templateSrc = template.path;
    }
  } else {
    state.templateId = null;
    templatePreview.style.display = 'none';
    mapFieldsBtn.style.display = 'none';
  }

  updateGenerateButton();
}

// Handle template file selection
function handleTemplateFileSelect(e) {
  const file = e.target.files[0];

  if (file) {
    if (!file.type.match('image/(png|jpeg|jpg)')) {
      showNotification(
        'Please select a valid image file (PNG, JPG, JPEG)',
        'error'
      );
      return;
    }

    state.templateFile = file;

    // Show preview inline
    const reader = new FileReader();
    reader.onload = (e) => {
      const newPreviewImage = document.getElementById('newPreviewImage');
      const newTemplatePreview = document.getElementById('newTemplatePreview');
      const templateDropZone = document.getElementById('templateDropZone');
      const mapFieldsNewBtn = document.getElementById('mapFieldsNewBtn');

      newPreviewImage.src = e.target.result;
      newTemplatePreview.style.display = 'block';
      templateDropZone.style.display = 'none';

      mapFieldsNewBtn.dataset.templateSrc = e.target.result;

      // Also update main preview for backward compatibility
      previewImage.src = e.target.result;
      templatePreview.style.display = 'block';
      mapFieldsBtn.dataset.templateSrc = e.target.result;
    };
    reader.readAsDataURL(file);

    showNotification(
      'Template loaded successfully. Click "Save & Map Fields" to continue.',
      'success'
    );
  }

  updateGenerateButton();
}

// Handle save template
async function handleSaveTemplate() {
  if (!state.templateFile) {
    showNotification('No template file selected', 'error');
    return;
  }

  try {
    const formData = new FormData();
    formData.append('template', state.templateFile);

    showNotification('Saving template...', 'info');

    const response = await fetch('/api/templates', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (response.ok) {
      showNotification('Template saved! Now you can map fields.', 'success');
      await loadTemplates();

      // Update state with new template ID
      state.templateId = data.template.id;
      mapFieldsBtn.dataset.templateId = data.template.id;
      mapFieldsBtn.dataset.templateSrc = data.template.path;
    } else {
      throw new Error(data.error || 'Failed to save template');
    }
  } catch (error) {
    console.error('Error saving template:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

// Handle CSV file selection
function handleCSVFileSelect(e) {
  console.log('handleCSVFileSelect called', e);
  const file = e.target.files[0];
  console.log('Selected file:', file);

  if (file) {
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const fileExt = file.name
      .substring(file.name.lastIndexOf('.'))
      .toLowerCase();

    if (!validExtensions.includes(fileExt)) {
      showNotification('Please select a CSV or Excel file', 'error');
      return;
    }

    state.csvFile = file;
    console.log('CSV file set in state:', state.csvFile);

    // Parse and preview CSV/Excel
    if (fileExt === '.csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvText = e.target.result;
        parseAndPreviewCSV(csvText);
      };
      reader.readAsText(file);
    } else {
      // For Excel files, just show file info
      state.csvData = {
        headers: ['Excel file loaded'],
        totalRows: 'Will be counted during generation',
      };
      csvTable.innerHTML = `<p style="padding: 15px; text-align: center; color: #666;">
        <strong>${file.name}</strong><br/>
        Excel file ready. Click generate to process.
      </p>`;
      recordCount.textContent = '?';
      csvPreview.style.display = 'block';
    }

    showNotification(
      `${fileExt.toUpperCase()} file loaded successfully`,
      'success'
    );
  }

  updateGenerateButton();
  console.log('Generate button disabled state:', generateBtn.disabled);
}

// Parse and preview CSV
function parseAndPreviewCSV(csvText) {
  const lines = csvText.trim().split('\n');

  if (lines.length === 0) {
    showNotification('CSV file is empty', 'error');
    return;
  }

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines
    .slice(1, Math.min(6, lines.length))
    .map((line) => line.split(',').map((cell) => cell.trim()));

  state.csvData = {
    headers,
    totalRows: lines.length - 1,
  };

  // Build table
  let tableHTML = '<table><thead><tr>';
  headers.forEach((header) => {
    tableHTML += `<th>${header}</th>`;
  });
  tableHTML += '</tr></thead><tbody>';

  rows.forEach((row) => {
    tableHTML += '<tr>';
    row.forEach((cell) => {
      tableHTML += `<td>${cell}</td>`;
    });
    tableHTML += '</tr>';
  });

  if (state.csvData.totalRows > 5) {
    tableHTML +=
      '<tr><td colspan="' +
      headers.length +
      '" style="text-align: center; font-style: italic; color: #888;">... and ' +
      (state.csvData.totalRows - 5) +
      ' more rows</td></tr>';
  }

  tableHTML += '</tbody></table>';

  csvTable.innerHTML = tableHTML;
  recordCount.textContent = state.csvData.totalRows;
  csvPreview.style.display = 'block';
}

// Handle generate
async function handleGenerate() {
  console.log('Generate button clicked!', {
    csvFile: state.csvFile,
    templateFile: state.templateFile,
    templateId: state.templateId,
  });

  if (!state.csvFile) {
    showNotification('Please upload a CSV file', 'error');
    return;
  }

  if (!state.templateFile && !state.templateId) {
    showNotification('Please select or upload a template', 'error');
    return;
  }

  try {
    generateBtn.disabled = true;
    progressSection.style.display = 'block';
    resultSection.style.display = 'none';

    updateProgress(30, 'Uploading files...');

    const formData = new FormData();
    formData.append('csvFile', state.csvFile);

    if (state.templateFile) {
      formData.append('template', state.templateFile);
    } else if (state.templateId) {
      formData.append('templateId', state.templateId);
    }

    updateProgress(50, 'Generating certificates...');

    const response = await fetch('/api/generate', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate certificates');
    }

    updateProgress(100, 'Complete!');

    setTimeout(() => {
      progressSection.style.display = 'none';
      resultSection.style.display = 'block';
      certificateCount.textContent = data.count;
      downloadLink.href = data.downloadUrl;
      showNotification(
        `Successfully generated ${data.count} certificates!`,
        'success'
      );
    }, 500);
  } catch (error) {
    console.error('Error generating certificates:', error);
    showNotification(`Error: ${error.message}`, 'error');
    progressSection.style.display = 'none';
  } finally {
    generateBtn.disabled = false;
  }
}

// Update progress
function updateProgress(percent, text) {
  progressFill.style.width = percent + '%';
  progressText.textContent = text;
}

// Update generate button state
function updateGenerateButton() {
  const hasTemplate = state.templateFile || state.templateId;
  const hasCSV = state.csvFile;

  generateBtn.disabled = !(hasTemplate && hasCSV);
}

// Setup drag and drop
function setupDragAndDrop(dropZone, fileInput, handler) {
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove('drag-over');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;

    fileInput.files = files;
    handler({ target: fileInput });
  });
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// Handle map fields
function handleMapFields() {
  const templateId = mapFieldsBtn.dataset.templateId;
  const templateSrc = mapFieldsBtn.dataset.templateSrc;

  if (!templateId) {
    showNotification(
      'Please save the template first before mapping fields',
      'error'
    );
    return;
  }

  // Open field mapper in new window/tab with just the template ID
  const mapperUrl = `/field-mapper.html?templateId=${templateId}`;
  window.open(mapperUrl, '_blank');
}

// Handle clear template (reset selection)
function handleClearTemplate() {
  state.templateFile = null;
  const templateDropZone = document.getElementById('templateDropZone');
  const newTemplatePreview = document.getElementById('newTemplatePreview');
  const templateFileInput = document.getElementById('templateFile');

  templateFileInput.value = '';
  templateDropZone.style.display = 'block';
  newTemplatePreview.style.display = 'none';

  showNotification('Template cleared. Select a new file.', 'info');
  updateGenerateButton();
}

// Handle map fields for new template (auto-save first)
async function handleMapFieldsNew() {
  console.log('handleMapFieldsNew called', state.templateFile);

  if (!state.templateFile) {
    showNotification('No template file selected', 'error');
    return;
  }

  try {
    const formData = new FormData();
    formData.append('template', state.templateFile);

    showNotification('Saving template...', 'info');

    const response = await fetch('/api/templates', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Template saved:', data);

    showNotification('Template saved! Opening field mapper...', 'success');
    await loadTemplates();

    // Update state with new template ID
    state.templateId = data.template.id;

    // Open field mapper
    const mapperUrl = `/field-mapper.html?templateId=${data.template.id}`;
    console.log('Opening mapper:', mapperUrl);
    window.open(mapperUrl, '_blank');
  } catch (error) {
    console.error('Error saving template:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

// Show notification
function showNotification(message, type = 'info') {
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.style.display = 'block';

  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}

// Make handleMapFieldsNew globally accessible
window.handleMapFieldsNew = handleMapFieldsNew;

// Make handleCSVFileSelect globally accessible
window.handleCSVFileSelect = handleCSVFileSelect;

// Make handleGenerate globally accessible
window.handleGenerate = handleGenerate;

// Delete template
async function deleteTemplate(templateId, templateName) {
  if (!confirm(`Are you sure you want to delete "${templateName}"?`)) {
    return;
  }

  try {
    showNotification('Deleting template...', 'info');
    const response = await fetch(`/api/templates/${templateId}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (response.ok) {
      showNotification('Template deleted successfully', 'success');
      await loadTemplates();

      // Clear selection if deleted template was selected
      if (state.templateId === templateId) {
        state.templateId = null;
        templatePreview.style.display = 'none';
        mapFieldsBtn.style.display = 'none';
        updateGenerateButton();
      }
    } else {
      throw new Error(data.error || 'Failed to delete template');
    }
  } catch (error) {
    console.error('Error deleting template:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

// Select template from gallery
function selectTemplate(templateId) {
  const radio = document.querySelector(
    'input[name="templateOption"][value="existing"]'
  );
  if (radio) {
    radio.checked = true;
    handleTemplateOptionChange({ target: radio });
  }

  templateSelect.value = templateId;
  handleTemplateSelection({ target: templateSelect });
}

// Make functions globally available
window.deleteTemplate = deleteTemplate;
window.selectTemplate = selectTemplate;
