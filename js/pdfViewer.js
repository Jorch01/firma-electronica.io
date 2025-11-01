/**
 * Visor de PDF con selección de área para firma
 * Usa PDF.js para renderizar
 */

class PDFViewer {
    constructor() {
        this.pdfDoc = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.scale = 1.0;
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.signatureBox = null;
        this.startX = 0;
        this.startY = 0;
    }

    /**
     * Inicializa el visor
     */
    async init(pdfFile) {
        try {
            // Configurar PDF.js
            pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

            // Leer archivo
            const arrayBuffer = await this.readFileAsArrayBuffer(pdfFile);

            // Cargar PDF
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            this.pdfDoc = await loadingTask.promise;
            this.totalPages = this.pdfDoc.numPages;
            this.currentPage = 1;

            // Configurar canvas
            this.canvas = document.getElementById('pdfCanvas');
            this.ctx = this.canvas.getContext('2d');
            this.signatureBox = document.getElementById('signatureBox');

            // Configurar eventos de selección de área
            this.setupAreaSelection();

            // Renderizar primera página
            await this.renderPage(this.currentPage);

            // Actualizar selector de páginas
            this.updatePageSelector();

            return {
                success: true,
                totalPages: this.totalPages
            };
        } catch (error) {
            throw new Error(`Error inicializando visor: ${error.message}`);
        }
    }

    /**
     * Renderiza una página
     */
    async renderPage(pageNum) {
        if (!this.pdfDoc) return;

        try {
            const page = await this.pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: this.scale });

            // Configurar canvas
            this.canvas.width = viewport.width;
            this.canvas.height = viewport.height;

            // Renderizar
            const renderContext = {
                canvasContext: this.ctx,
                viewport: viewport
            };

            await page.render(renderContext).promise;

            // Actualizar información
            document.getElementById('pageInfo').textContent =
                `Página ${this.currentPage} de ${this.totalPages}`;
            document.getElementById('zoomLevel').textContent =
                `${Math.round(this.scale * 100)}%`;

        } catch (error) {
            console.error('Error renderizando página:', error);
        }
    }

    /**
     * Configura la selección de área para firma
     */
    setupAreaSelection() {
        const container = this.canvas.parentElement;

        this.canvas.addEventListener('mousedown', (e) => {
            if (!document.getElementById('visibleSignature').checked) return;

            this.isDrawing = true;
            const rect = this.canvas.getBoundingClientRect();
            this.startX = e.clientX - rect.left;
            this.startY = e.clientY - rect.top;

            this.signatureBox.style.left = this.startX + 'px';
            this.signatureBox.style.top = this.startY + 'px';
            this.signatureBox.style.width = '0px';
            this.signatureBox.style.height = '0px';
            this.signatureBox.style.display = 'block';
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isDrawing) return;

            const rect = this.canvas.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;

            const width = currentX - this.startX;
            const height = currentY - this.startY;

            if (width > 0 && height > 0) {
                this.signatureBox.style.width = width + 'px';
                this.signatureBox.style.height = height + 'px';
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (!this.isDrawing) return;
            this.isDrawing = false;

            const rect = this.canvas.getBoundingClientRect();
            const endX = e.clientX - rect.left;
            const endY = e.clientY - rect.top;

            // Convertir coordenadas de canvas a coordenadas PDF
            const pdfX = Math.round((this.startX / this.scale));
            const pdfY = Math.round((this.canvas.height - endY) / this.scale);

            // Actualizar campos
            document.getElementById('signatureX').value = pdfX;
            document.getElementById('signatureY').value = pdfY;
            document.getElementById('signaturePage').value = this.currentPage;
        });
    }

    /**
     * Navega a la página anterior
     */
    async prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            await this.renderPage(this.currentPage);
        }
    }

    /**
     * Navega a la página siguiente
     */
    async nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            await this.renderPage(this.currentPage);
        }
    }

    /**
     * Aumenta el zoom
     */
    async zoomIn() {
        this.scale = Math.min(this.scale + 0.25, 3.0);
        await this.renderPage(this.currentPage);
    }

    /**
     * Reduce el zoom
     */
    async zoomOut() {
        this.scale = Math.max(this.scale - 0.25, 0.5);
        await this.renderPage(this.currentPage);
    }

    /**
     * Actualiza el selector de páginas
     */
    updatePageSelector() {
        const select = document.getElementById('signaturePage');
        select.innerHTML = '';
        for (let i = 1; i <= this.totalPages; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `Página ${i}`;
            select.appendChild(option);
        }
    }

    /**
     * Muestra el visor
     */
    show() {
        document.getElementById('pdfViewer').style.display = 'block';
    }

    /**
     * Oculta el visor
     */
    hide() {
        document.getElementById('pdfViewer').style.display = 'none';
    }

    /**
     * Utilidad: Lee archivo como ArrayBuffer
     */
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Error leyendo archivo'));
            reader.readAsArrayBuffer(file);
        });
    }
}

// Instancia global
window.pdfViewer = new PDFViewer();
