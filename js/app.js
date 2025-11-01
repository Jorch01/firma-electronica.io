/**
 * Aplicación Principal - Firma Electrónica México
 * Gestiona la UI y coordina los módulos
 */

// Estado de la aplicación
const appState = {
    currentTab: 'sign',
    certificateLoaded: false,
    pdfLoaded: false,
    batchFiles: []
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    initializeCertificateSection();
    initializePDFSection();
    initializeSigningSection();
    initializeValidationSection();
    initializeBatchSection();
    setupEventListeners();
});

// ============= TABS =============
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Actualizar botones
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Actualizar contenido
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    appState.currentTab = tabName;
}

// ============= CERTIFICADO =============
function initializeCertificateSection() {
    // Cambio de tipo de certificado
    const certTypeRadios = document.querySelectorAll('input[name="certType"]');
    certTypeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const efirmaFiles = document.getElementById('efirma-files');
            const pfxFiles = document.getElementById('pfx-files');

            if (e.target.value === 'PFX') {
                efirmaFiles.style.display = 'none';
                pfxFiles.style.display = 'block';
            } else {
                efirmaFiles.style.display = 'block';
                pfxFiles.style.display = 'none';
            }
        });
    });

    // Carga de archivos
    setupFileInput('cerFile', 'cerInfo');
    setupFileInput('keyFile', 'keyInfo');
    setupFileInput('pfxFile', 'pfxInfo');

    // Botón de carga
    document.getElementById('loadCertButton').addEventListener('click', handleLoadCertificate);
}

function setupFileInput(inputId, infoId) {
    const input = document.getElementById(inputId);
    const info = document.getElementById(infoId);

    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            info.innerHTML = `<span class="file-loaded">✓ ${file.name}</span>`;
        } else {
            info.innerHTML = '';
        }
    });
}

async function handleLoadCertificate() {
    const certType = document.querySelector('input[name="certType"]:checked').value;
    const password = document.getElementById('certPassword').value;
    const resultDiv = document.getElementById('certResult');

    if (!password) {
        showMessage(resultDiv, 'Por favor ingrese la contraseña del certificado', 'error');
        return;
    }

    showLoading('Cargando certificado...');

    try {
        let result;

        if (certType === 'PFX') {
            const pfxFile = document.getElementById('pfxFile').files[0];
            if (!pfxFile) {
                throw new Error('Por favor seleccione el archivo PFX');
            }
            result = await window.certHandler.loadPFX(pfxFile, password);
        } else {
            const cerFile = document.getElementById('cerFile').files[0];
            const keyFile = document.getElementById('keyFile').files[0];
            if (!cerFile || !keyFile) {
                throw new Error('Por favor seleccione ambos archivos (.cer y .key)');
            }
            result = await window.certHandler.loadEfirmaSAT(cerFile, keyFile, password);
        }

        appState.certificateLoaded = true;

        // Mostrar información del certificado
        const summary = window.certHandler.getSummary();
        const certInfo = window.certHandler.certificateInfo;

        const message = `
            <div class="cert-success">
                <h4>✓ Certificado cargado exitosamente</h4>
                <div class="cert-details">
                    <p><strong>Titular:</strong> ${summary.name}</p>
                    <p><strong>Organización:</strong> ${summary.organization}</p>
                    <p><strong>Tipo:</strong> ${summary.type}</p>
                    <p><strong>Válido desde:</strong> ${summary.validFrom}</p>
                    <p><strong>Válido hasta:</strong> ${summary.validTo}</p>
                    <p><strong>Estado:</strong> <span class="badge ${summary.isValid ? 'success' : 'error'}">
                        ${summary.isValid ? 'Válido' : 'Expirado'}
                    </span></p>
                    ${summary.isValid ? `<p><strong>Días restantes:</strong> ${summary.daysRemaining}</p>` : ''}
                </div>
            </div>
        `;

        showMessage(resultDiv, message, 'success');
    } catch (error) {
        appState.certificateLoaded = false;
        showMessage(resultDiv, `Error: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// ============= PDF =============
function initializePDFSection() {
    const dropZone = document.getElementById('pdfDropZone');
    const fileInput = document.getElementById('pdfFile');

    // Click en drop zone
    dropZone.addEventListener('click', () => fileInput.click());

    // Drag & drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'));
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'));
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'application/pdf') {
            fileInput.files = files;
            handlePDFLoad(files[0]);
        }
    });

    // Cambio de archivo
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handlePDFLoad(e.target.files[0]);
        }
    });
}

async function handlePDFLoad(file) {
    const infoDiv = document.getElementById('pdfInfo');

    showLoading('Cargando PDF...');

    try {
        // Cargar en pdfSigner
        const result = await window.pdfSigner.loadPDF(file);

        // Inicializar visor
        await window.pdfViewer.init(file);
        window.pdfViewer.show();

        appState.pdfLoaded = true;

        // Mostrar información
        infoDiv.innerHTML = `
            <div class="pdf-loaded">
                <h4>✓ PDF cargado: ${file.name}</h4>
                <p>Páginas: ${result.pageCount} | Tamaño: ${formatFileSize(file.size)}</p>
            </div>
        `;
    } catch (error) {
        appState.pdfLoaded = false;
        showMessage(infoDiv, `Error: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// ============= FIRMA =============
function initializeSigningSection() {
    // Toggle firma visible
    const visibleCheckbox = document.getElementById('visibleSignature');
    const configSection = document.getElementById('signatureConfig');

    visibleCheckbox.addEventListener('change', (e) => {
        configSection.style.display = e.target.checked ? 'block' : 'none';
        document.getElementById('signatureBox').style.display =
            e.target.checked ? 'block' : 'none';
    });

    // Botón de firma
    document.getElementById('signPdfButton').addEventListener('click', handleSignPDF);

    // Controles del visor
    document.getElementById('prevPage').addEventListener('click', () => window.pdfViewer.prevPage());
    document.getElementById('nextPage').addEventListener('click', () => window.pdfViewer.nextPage());
    document.getElementById('zoomIn').addEventListener('click', () => window.pdfViewer.zoomIn());
    document.getElementById('zoomOut').addEventListener('click', () => window.pdfViewer.zoomOut());
}

async function handleSignPDF() {
    if (!appState.certificateLoaded) {
        alert('Por favor carga primero tu certificado digital');
        return;
    }

    if (!appState.pdfLoaded) {
        alert('Por favor carga primero el documento PDF');
        return;
    }

    const resultDiv = document.getElementById('signResult');
    const progressDiv = document.getElementById('signProgress');

    // Obtener configuración
    const options = {
        visible: document.getElementById('visibleSignature').checked,
        page: parseInt(document.getElementById('signaturePage').value) || 1,
        x: parseInt(document.getElementById('signatureX').value) || 50,
        y: parseInt(document.getElementById('signatureY').value) || 700,
        reason: document.getElementById('signReason').value || 'Firma Electrónica',
        location: document.getElementById('signLocation').value || 'México',
        contactInfo: document.getElementById('signContact').value || '',
        certificationLevel: parseInt(document.getElementById('certLevel').value) || 0,
        includeTimestamp: document.getElementById('includeTimestamp').checked
    };

    progressDiv.style.display = 'block';
    showLoading('Firmando documento...');

    try {
        const result = await window.pdfSigner.signPDF(options);

        // Descargar automáticamente
        const originalFileName = document.getElementById('pdfFile').files[0].name;
        const signedFileName = originalFileName.replace('.pdf', '_firmado.pdf');
        window.pdfSigner.downloadSignedPDF(result.pdfBytes, signedFileName);

        // Mostrar resultado
        const message = `
            <div class="sign-success">
                <h3>✓ Documento firmado exitosamente</h3>
                <div class="sign-details">
                    <p><strong>Archivo:</strong> ${signedFileName}</p>
                    <p><strong>Firmante:</strong> ${result.metadata.signer}</p>
                    <p><strong>Fecha:</strong> ${new Date(result.metadata.signDate).toLocaleString('es-MX')}</p>
                    <p><strong>Razón:</strong> ${result.metadata.reason}</p>
                    <p><strong>Ubicación:</strong> ${result.metadata.location}</p>
                    <p><strong>Certificación:</strong> ${result.metadata.certificationLevel}</p>
                    <p><strong>Hash SHA-256:</strong><br><code>${result.signature.hash}</code></p>
                </div>
                <p class="download-note">✓ El archivo se ha descargado automáticamente</p>
            </div>
        `;

        showMessage(resultDiv, message, 'success');
        resultDiv.classList.add('show');
    } catch (error) {
        showMessage(resultDiv, `Error: ${error.message}`, 'error');
        resultDiv.classList.add('show');
    } finally {
        progressDiv.style.display = 'none';
        hideLoading();
    }
}

// ============= VALIDACIÓN =============
function initializeValidationSection() {
    const dropZone = document.getElementById('validateDropZone');
    const fileInput = document.getElementById('validatePdfFile');

    dropZone.addEventListener('click', () => fileInput.click());

    // Drag & drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'));
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'));
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'application/pdf') {
            fileInput.files = files;
        }
    });

    document.getElementById('validateButton').addEventListener('click', handleValidatePDF);
}

async function handleValidatePDF() {
    const fileInput = document.getElementById('validatePdfFile');
    const resultDiv = document.getElementById('validateResult');

    if (!fileInput.files || fileInput.files.length === 0) {
        showMessage(resultDiv, 'Por favor selecciona un archivo PDF', 'error');
        return;
    }

    showLoading('Validando firmas...');

    try {
        const result = await window.pdfValidator.validatePDF(fileInput.files[0]);

        let signaturesHTML = '<div class="signatures-list">';
        result.signatures.forEach((sig, index) => {
            const validClass = sig.valid ? 'valid' : 'invalid';
            signaturesHTML += `
                <div class="signature-card ${validClass}">
                    <h4>${sig.valid ? '✓' : '✗'} Firma #${index + 1}</h4>
                    ${sig.signer ? `<p><strong>Firmante:</strong> ${sig.signer}</p>` : ''}
                    ${sig.signDate ? `<p><strong>Fecha:</strong> ${new Date(sig.signDate).toLocaleString('es-MX')}</p>` : ''}
                    ${sig.reason ? `<p><strong>Razón:</strong> ${sig.reason}</p>` : ''}
                    ${sig.location ? `<p><strong>Ubicación:</strong> ${sig.location}</p>` : ''}
                    ${sig.hash ? `<p><strong>Hash:</strong> <code>${sig.hash}</code></p>` : ''}
                    ${sig.message ? `<p>${sig.message}</p>` : ''}
                    ${sig.note ? `<p class="note">${sig.note}</p>` : ''}
                </div>
            `;
        });
        signaturesHTML += '</div>';

        // Información del documento
        const docInfo = `
            <div class="doc-info">
                <h4>Información del Documento</h4>
                <p><strong>Páginas:</strong> ${result.documentInfo.pageCount}</p>
                <p><strong>Título:</strong> ${result.documentInfo.title}</p>
                <p><strong>Autor:</strong> ${result.documentInfo.author}</p>
                <p><strong>Creador:</strong> ${result.documentInfo.creator}</p>
            </div>
        `;

        showMessage(resultDiv, signaturesHTML + docInfo, result.isValid ? 'success' : 'warning');
        resultDiv.classList.add('show');
    } catch (error) {
        showMessage(resultDiv, `Error: ${error.message}`, 'error');
        resultDiv.classList.add('show');
    } finally {
        hideLoading();
    }
}

// ============= FIRMA POR LOTES =============
function initializeBatchSection() {
    const dropZone = document.getElementById('batchDropZone');
    const fileInput = document.getElementById('batchPdfFiles');

    dropZone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'));
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'));
    });

    dropZone.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
        if (files.length > 0) {
            handleBatchFilesLoad(files);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleBatchFilesLoad(Array.from(e.target.files));
        }
    });

    document.getElementById('batchSignButton').addEventListener('click', handleBatchSign);
}

function handleBatchFilesLoad(files) {
    appState.batchFiles = files;
    const listDiv = document.getElementById('batchFilesList');
    const signButton = document.getElementById('batchSignButton');

    let html = '<div class="batch-files"><h4>Archivos seleccionados:</h4><ul>';
    files.forEach((file, index) => {
        html += `<li>${index + 1}. ${file.name} (${formatFileSize(file.size)})</li>`;
    });
    html += '</ul></div>';

    listDiv.innerHTML = html;
    signButton.style.display = 'block';
}

async function handleBatchSign() {
    if (!appState.certificateLoaded) {
        alert('Por favor carga primero tu certificado en la pestaña "Firmar Documento"');
        return;
    }

    if (appState.batchFiles.length === 0) {
        alert('No hay archivos seleccionados');
        return;
    }

    const progressDiv = document.getElementById('batchProgress');
    const resultDiv = document.getElementById('batchResult');

    progressDiv.style.display = 'block';
    progressDiv.innerHTML = '<h4>Progreso de firma:</h4>';

    const results = [];

    for (let i = 0; i < appState.batchFiles.length; i++) {
        const file = appState.batchFiles[i];
        progressDiv.innerHTML += `<p>Firmando ${i + 1}/${appState.batchFiles.length}: ${file.name}...</p>`;

        try {
            await window.pdfSigner.loadPDF(file);
            const result = await window.pdfSigner.signPDF({
                visible: true,
                page: 1,
                x: 50,
                y: 700,
                reason: 'Firma por lotes',
                location: 'México',
                certificationLevel: 0,
                includeTimestamp: true
            });

            const signedFileName = file.name.replace('.pdf', '_firmado.pdf');
            window.pdfSigner.downloadSignedPDF(result.pdfBytes, signedFileName);

            results.push({ file: file.name, success: true });
        } catch (error) {
            results.push({ file: file.name, success: false, error: error.message });
        }
    }

    // Mostrar resultados
    let html = '<div class="batch-results"><h3>Resultados:</h3><ul>';
    results.forEach(r => {
        const icon = r.success ? '✓' : '✗';
        const className = r.success ? 'success' : 'error';
        html += `<li class="${className}">${icon} ${r.file}${r.error ? `: ${r.error}` : ''}</li>`;
    });
    html += '</ul></div>';

    showMessage(resultDiv, html, 'info');
    resultDiv.classList.add('show');
}

// ============= UTILIDADES =============
function setupEventListeners() {
    // Aquí se pueden agregar más event listeners globales
}

function showLoading(message = 'Procesando...') {
    const overlay = document.getElementById('loadingOverlay');
    const messageEl = document.getElementById('loadingMessage');
    messageEl.textContent = message;
    overlay.classList.add('show');
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.remove('show');
}

function showMessage(element, message, type = 'info') {
    element.innerHTML = `<div class="message ${type}">${message}</div>`;
    element.className = `result-message ${type}`;
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// Estilos adicionales para mensajes
const style = document.createElement('style');
style.textContent = `
    .file-loaded { color: var(--secondary-color); font-weight: 600; }
    .cert-success, .sign-success { padding: 20px; }
    .cert-details, .sign-details { margin-top: 15px; }
    .cert-details p, .sign-details p { margin: 8px 0; }
    .sign-details code {
        display: block;
        background: #f5f5f5;
        padding: 10px;
        border-radius: 4px;
        font-size: 0.85rem;
        word-break: break-all;
        margin-top: 5px;
    }
    .download-note {
        margin-top: 20px;
        padding: 15px;
        background: rgba(16, 185, 129, 0.1);
        border-radius: 8px;
        font-weight: 600;
    }
    .message { padding: 15px; border-radius: 8px; }
    .message.success { background: rgba(16, 185, 129, 0.1); color: var(--secondary-color); }
    .message.error { background: rgba(239, 68, 68, 0.1); color: var(--danger-color); }
    .message.info { background: rgba(37, 99, 235, 0.1); color: var(--primary-color); }
    .message.warning { background: rgba(245, 158, 11, 0.1); color: var(--warning-color); }
    .pdf-loaded { padding: 15px; background: rgba(16, 185, 129, 0.1); border-radius: 8px; }
    .signatures-list { margin: 20px 0; }
    .signature-card {
        padding: 15px;
        margin: 10px 0;
        border-left: 4px solid var(--secondary-color);
        background: white;
        border-radius: 4px;
    }
    .signature-card.invalid { border-left-color: var(--danger-color); }
    .signature-card code {
        font-size: 0.85rem;
        background: #f5f5f5;
        padding: 2px 6px;
        border-radius: 3px;
        word-break: break-all;
    }
    .signature-card .note { font-style: italic; color: var(--text-secondary); }
    .doc-info { margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; }
    .batch-files ul { list-style-position: inside; }
    .batch-files li { padding: 5px 0; }
    .batch-results ul { list-style: none; padding: 0; }
    .batch-results li { padding: 10px; margin: 5px 0; border-radius: 4px; }
    .batch-results li.success { background: rgba(16, 185, 129, 0.1); color: var(--secondary-color); }
    .batch-results li.error { background: rgba(239, 68, 68, 0.1); color: var(--danger-color); }
`;
document.head.appendChild(style);
