// API Base URL
const API_URL = '/api';

// Estado de la aplicación
const appState = {
    currentTab: 'sign',
    files: {
        cerFile: null,
        keyFile: null,
        pfxFile: null,
        pdfFile: null,
        validatePdfFile: null,
        infoPdfFile: null
    }
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    initializeCertificateTypeSwitch();
    initializeFileInputs();
    initializeDropZones();
    initializeButtons();
    initializeVisibleSignatureToggle();
});

// Tabs
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');

            // Update buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Update content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabName}-tab`).classList.add('active');

            appState.currentTab = tabName;
        });
    });
}

// Certificate Type Switch
function initializeCertificateTypeSwitch() {
    const certTypeRadios = document.querySelectorAll('input[name="certType"]');
    const efirmaFiles = document.getElementById('efirma-files');
    const pfxFiles = document.getElementById('pfx-files');

    certTypeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'PFX') {
                efirmaFiles.style.display = 'none';
                pfxFiles.style.display = 'block';
                appState.files.cerFile = null;
                appState.files.keyFile = null;
                clearFileStatus('cerStatus');
                clearFileStatus('keyStatus');
            } else {
                efirmaFiles.style.display = 'block';
                pfxFiles.style.display = 'none';
                appState.files.pfxFile = null;
                clearFileStatus('pfxStatus');
            }
        });
    });
}

// File Inputs
function initializeFileInputs() {
    // Certificate files
    setupFileInput('cerFile', 'cerStatus', '.cer');
    setupFileInput('keyFile', 'keyStatus', '.key');
    setupFileInput('pfxFile', 'pfxStatus', '.pfx, .p12');

    // PDF files
    setupFileInput('pdfFile', 'pdfStatus', '.pdf');
    setupFileInput('validatePdfFile', 'validatePdfStatus', '.pdf');
    setupFileInput('infoPdfFile', 'infoPdfStatus', '.pdf');
}

function setupFileInput(inputId, statusId, acceptedExtensions) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const extension = '.' + file.name.split('.').pop().toLowerCase();
            const accepted = acceptedExtensions.split(',').map(ext => ext.trim());

            if (accepted.includes(extension)) {
                appState.files[inputId] = file;
                showFileStatus(statusId, `✓ ${file.name}`, 'success');
            } else {
                showFileStatus(statusId, `Error: Solo se aceptan archivos ${acceptedExtensions}`, 'error');
                e.target.value = '';
            }
        }
    });
}

// Drop Zones
function initializeDropZones() {
    setupDropZone('dropZone', 'pdfFile', 'pdfStatus', '.pdf');
    setupDropZone('validateDropZone', 'validatePdfFile', 'validatePdfStatus', '.pdf');
    setupDropZone('infoDropZone', 'infoPdfFile', 'infoPdfStatus', '.pdf');
}

function setupDropZone(dropZoneId, inputId, statusId, acceptedExtensions) {
    const dropZone = document.getElementById(dropZoneId);
    const fileInput = document.getElementById(inputId);

    if (!dropZone || !fileInput) return;

    // Click to select
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    // Drag events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('drag-over');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            const extension = '.' + file.name.split('.').pop().toLowerCase();
            const accepted = acceptedExtensions.split(',').map(ext => ext.trim());

            if (accepted.includes(extension)) {
                appState.files[inputId] = file;
                showFileStatus(statusId, `✓ ${file.name}`, 'success');
                // Update the file input
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;
            } else {
                showFileStatus(statusId, `Error: Solo se aceptan archivos ${acceptedExtensions}`, 'error');
            }
        }
    });
}

// Visible Signature Toggle
function initializeVisibleSignatureToggle() {
    const checkbox = document.getElementById('visibleSignature');
    const options = document.getElementById('signatureOptions');

    checkbox.addEventListener('change', (e) => {
        options.style.display = e.target.checked ? 'block' : 'none';
    });
}

// Buttons
function initializeButtons() {
    document.getElementById('signButton').addEventListener('click', handleSign);
    document.getElementById('validateButton').addEventListener('click', handleValidate);
    document.getElementById('infoButton').addEventListener('click', handleInfo);
}

// Sign Document
async function handleSign() {
    const certType = document.querySelector('input[name="certType"]:checked').value;
    const password = document.getElementById('certPassword').value;
    const pdfFile = appState.files.pdfFile;

    // Validations
    if (!password) {
        showResult('signResult', 'Error: Ingrese la contraseña del certificado', 'error');
        return;
    }

    if (!pdfFile) {
        showResult('signResult', 'Error: Seleccione el documento PDF a firmar', 'error');
        return;
    }

    if (certType === 'PFX') {
        if (!appState.files.pfxFile) {
            showResult('signResult', 'Error: Seleccione el archivo PFX', 'error');
            return;
        }
    } else {
        if (!appState.files.cerFile || !appState.files.keyFile) {
            showResult('signResult', 'Error: Seleccione ambos archivos .cer y .key', 'error');
            return;
        }
    }

    // Build form data
    const formData = new FormData();
    formData.append('password', password);
    formData.append('type', certType);
    formData.append('pdfFile', pdfFile);

    if (certType === 'PFX') {
        formData.append('pfxFile', appState.files.pfxFile);
    } else {
        formData.append('cerFile', appState.files.cerFile);
        formData.append('keyFile', appState.files.keyFile);
    }

    // Signature options
    const signatureOptions = {
        visible: document.getElementById('visibleSignature').checked,
        page: parseInt(document.getElementById('signaturePage').value) || 0,
        position: {
            x: parseInt(document.getElementById('signatureX').value) || 50,
            y: parseInt(document.getElementById('signatureY').value) || 50
        },
        reason: document.getElementById('signatureReason').value || 'Firma Electrónica',
        location: document.getElementById('signatureLocation').value || 'México',
        certificationLevel: parseInt(document.getElementById('certLevel').value) || 0,
        includeTimestamp: document.getElementById('includeTimestamp').checked
    };

    formData.append('signatureOptions', JSON.stringify(signatureOptions));

    // Show loading
    showLoading('Firmando documento...');

    try {
        const response = await fetch(`${API_URL}/sign`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al firmar el documento');
        }

        // Success
        const resultHTML = `
            <div class="result-title">
                ✓ Documento firmado exitosamente
            </div>
            <div class="result-content">
                <div class="result-item">
                    <span class="result-label">Firmante:</span>
                    <span class="result-value">${data.signatureInfo.signer}</span>
                </div>
                <div class="result-item">
                    <span class="result-label">Fecha:</span>
                    <span class="result-value">${new Date(data.signatureInfo.signDate).toLocaleString('es-MX')}</span>
                </div>
                <div class="result-item">
                    <span class="result-label">Motivo:</span>
                    <span class="result-value">${data.signatureInfo.reason}</span>
                </div>
                <div class="result-item">
                    <span class="result-label">Ubicación:</span>
                    <span class="result-value">${data.signatureInfo.location}</span>
                </div>
                <div class="result-item">
                    <span class="result-label">Tipo de certificado:</span>
                    <span class="result-value">${data.signatureInfo.certificateType}</span>
                </div>
                <div class="result-item">
                    <span class="result-label">Nivel de certificación:</span>
                    <span class="result-value">${data.signatureInfo.certificationLevel}</span>
                </div>
                <div class="result-item">
                    <span class="result-label">Hash SHA-256:</span>
                    <span class="result-value" style="word-break: break-all; font-family: monospace; font-size: 0.85rem;">${data.signatureInfo.hash}</span>
                </div>
                <a href="${data.downloadUrl}" class="download-button">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Descargar PDF Firmado
                </a>
            </div>
        `;

        showResult('signResult', resultHTML, 'success');

        // Clear form
        clearSignForm();
    } catch (error) {
        showResult('signResult', `Error: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// Validate Document
async function handleValidate() {
    const pdfFile = appState.files.validatePdfFile;

    if (!pdfFile) {
        showResult('validateResult', 'Error: Seleccione el documento PDF a validar', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('pdfFile', pdfFile);

    showLoading('Validando firmas...');

    try {
        const response = await fetch(`${API_URL}/validate`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al validar el documento');
        }

        // Build signatures HTML
        let signaturesHTML = '<div class="signature-list">';
        data.signatures.forEach((sig, index) => {
            const validClass = sig.valid ? '' : 'invalid';
            const validIcon = sig.valid ? '✓' : '✗';
            const validText = sig.valid ? 'Válida' : 'No válida';

            signaturesHTML += `
                <div class="signature-item ${validClass}">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong>Firma #${index + 1}</strong>
                        <span class="badge ${sig.valid ? 'success' : 'error'}">${validIcon} ${validText}</span>
                    </div>
                    ${sig.signer ? `<div><strong>Firmante:</strong> ${sig.signer}</div>` : ''}
                    ${sig.signDate ? `<div><strong>Fecha:</strong> ${new Date(sig.signDate).toLocaleString('es-MX')}</div>` : ''}
                    ${sig.message ? `<div><strong>Mensaje:</strong> ${sig.message}</div>` : ''}
                    ${sig.producer ? `<div><strong>Productor:</strong> ${sig.producer}</div>` : ''}
                    ${sig.integrity ? `<div><strong>Hash:</strong> <code style="font-size: 0.85rem;">${sig.integrity.hash}</code></div>` : ''}
                </div>
            `;
        });
        signaturesHTML += '</div>';

        // Document info
        const docInfoHTML = `
            <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 8px;">
                <h4 style="margin-bottom: 10px;">Información del Documento</h4>
                <div><strong>Páginas:</strong> ${data.documentInfo.pageCount}</div>
                <div><strong>Título:</strong> ${data.documentInfo.title}</div>
                <div><strong>Autor:</strong> ${data.documentInfo.author}</div>
                <div><strong>Creador:</strong> ${data.documentInfo.creator}</div>
                <div><strong>Fecha de creación:</strong> ${new Date(data.documentInfo.creationDate).toLocaleString('es-MX')}</div>
                <div><strong>Fecha de modificación:</strong> ${new Date(data.documentInfo.modificationDate).toLocaleString('es-MX')}</div>
            </div>
        `;

        const resultHTML = `
            <div class="result-title">
                ${data.isValid ? '✓' : '✗'} ${data.message}
            </div>
            <div class="result-content">
                ${signaturesHTML}
                ${docInfoHTML}
            </div>
        `;

        showResult('validateResult', resultHTML, data.isValid ? 'success' : 'error');
    } catch (error) {
        showResult('validateResult', `Error: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// Get PDF Info
async function handleInfo() {
    const pdfFile = appState.files.infoPdfFile;

    if (!pdfFile) {
        showResult('infoResult', 'Error: Seleccione un documento PDF', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('pdfFile', pdfFile);

    showLoading('Obteniendo información...');

    try {
        const response = await fetch(`${API_URL}/pdf-info`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al obtener información del PDF');
        }

        const info = data.info;

        const resultHTML = `
            <div class="result-title">
                ℹ️ Información del Documento
            </div>
            <div class="result-content">
                <table class="info-table">
                    <tr>
                        <td>Páginas</td>
                        <td>${info.pageCount}</td>
                    </tr>
                    <tr>
                        <td>Título</td>
                        <td>${info.title}</td>
                    </tr>
                    <tr>
                        <td>Autor</td>
                        <td>${info.author}</td>
                    </tr>
                    <tr>
                        <td>Asunto</td>
                        <td>${info.subject || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td>Palabras clave</td>
                        <td>${info.keywords || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td>Creador</td>
                        <td>${info.creator}</td>
                    </tr>
                    <tr>
                        <td>Productor</td>
                        <td>${info.producer}</td>
                    </tr>
                    <tr>
                        <td>Fecha de creación</td>
                        <td>${new Date(info.creationDate).toLocaleString('es-MX')}</td>
                    </tr>
                    <tr>
                        <td>Fecha de modificación</td>
                        <td>${new Date(info.modificationDate).toLocaleString('es-MX')}</td>
                    </tr>
                </table>
            </div>
        `;

        showResult('infoResult', resultHTML, 'info');
    } catch (error) {
        showResult('infoResult', `Error: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// Utility Functions
function showFileStatus(statusId, message, type) {
    const statusElement = document.getElementById(statusId);
    if (!statusElement) return;

    statusElement.textContent = message;
    statusElement.className = `file-status ${type}`;
}

function clearFileStatus(statusId) {
    const statusElement = document.getElementById(statusId);
    if (!statusElement) return;

    statusElement.textContent = '';
    statusElement.className = 'file-status';
}

function showResult(containerId, message, type) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = message;
    container.className = `result-container show ${type}`;
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showLoading(message = 'Procesando...') {
    const overlay = document.getElementById('loadingOverlay');
    const messageElement = document.getElementById('loadingMessage');

    if (overlay && messageElement) {
        messageElement.textContent = message;
        overlay.classList.add('show');
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('show');
    }
}

function clearSignForm() {
    // Clear password
    document.getElementById('certPassword').value = '';

    // Clear file inputs
    document.getElementById('cerFile').value = '';
    document.getElementById('keyFile').value = '';
    document.getElementById('pfxFile').value = '';
    document.getElementById('pdfFile').value = '';

    // Clear app state
    appState.files.cerFile = null;
    appState.files.keyFile = null;
    appState.files.pfxFile = null;
    appState.files.pdfFile = null;

    // Clear status messages
    clearFileStatus('cerStatus');
    clearFileStatus('keyStatus');
    clearFileStatus('pfxStatus');
    clearFileStatus('pdfStatus');
}
