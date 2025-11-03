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

            // Configurar evento del checkbox de firma visible
            const visibleCheckbox = document.getElementById('visibleSignature');
            visibleCheckbox.addEventListener('change', () => {
                this.updateCanvasMode();
            });

            // Inicializar modo del canvas
            this.updateCanvasMode();

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

        // Función para obtener coordenadas correctas del canvas
        const getCanvasCoords = (clientX, clientY) => {
            const canvasRect = this.canvas.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // Coordenadas relativas al canvas
            const canvasX = clientX - canvasRect.left;
            const canvasY = clientY - canvasRect.top;

            // Coordenadas relativas al contenedor (para posicionar el signatureBox)
            const containerX = clientX - containerRect.left + container.scrollLeft;
            const containerY = clientY - containerRect.top + container.scrollTop;

            // Offset del canvas dentro del contenedor
            const canvasOffsetX = canvasRect.left - containerRect.left + container.scrollLeft;
            const canvasOffsetY = canvasRect.top - containerRect.top + container.scrollTop;

            return {
                canvasX,
                canvasY,
                containerX,
                containerY,
                canvasOffsetX,
                canvasOffsetY,
                // Coordenadas absolutas para signatureBox (canvas offset + coordenada en canvas)
                boxX: canvasOffsetX + canvasX,
                boxY: canvasOffsetY + canvasY
            };
        };

        // Función para iniciar selección
        const startSelection = (clientX, clientY) => {
            if (!document.getElementById('visibleSignature').checked) return false;

            this.isDrawing = true;
            const coords = getCanvasCoords(clientX, clientY);

            this.startX = coords.canvasX;
            this.startY = coords.canvasY;
            this.boxStartX = coords.boxX;
            this.boxStartY = coords.boxY;

            this.signatureBox.style.left = coords.boxX + 'px';
            this.signatureBox.style.top = coords.boxY + 'px';
            this.signatureBox.style.width = '0px';
            this.signatureBox.style.height = '0px';
            this.signatureBox.style.display = 'block';

            console.log('🖱️ Inicio:', { canvasX: coords.canvasX, canvasY: coords.canvasY, boxX: coords.boxX, boxY: coords.boxY });
            return true;
        };

        // Función para mover selección
        const moveSelection = (clientX, clientY) => {
            if (!this.isDrawing) return;

            const coords = getCanvasCoords(clientX, clientY);

            const width = coords.boxX - this.boxStartX;
            const height = coords.boxY - this.boxStartY;

            if (width > 0 && height > 0) {
                this.signatureBox.style.width = width + 'px';
                this.signatureBox.style.height = height + 'px';
            }
        };

        // Función para finalizar selección
        const endSelection = (clientX, clientY) => {
            if (!this.isDrawing) return;
            this.isDrawing = false;

            const coords = getCanvasCoords(clientX, clientY);

            // Convertir coordenadas de canvas a coordenadas PDF
            // pdf-lib usa origen bottom-left, canvas usa origin top-left
            const pdfX = Math.round(this.startX / this.scale);
            const pdfY = Math.round((this.canvas.height - coords.canvasY) / this.scale);
            const width = Math.round((coords.canvasX - this.startX) / this.scale);
            const height = Math.round((coords.canvasY - this.startY) / this.scale);

            console.log('✅ Final:', {
                canvasStart: { x: this.startX, y: this.startY },
                canvasEnd: { x: coords.canvasX, y: coords.canvasY },
                pdfCoords: { x: pdfX, y: pdfY, width, height }
            });

            // Actualizar campos
            document.getElementById('signatureX').value = pdfX;
            document.getElementById('signatureY').value = pdfY;
            document.getElementById('signaturePage').value = this.currentPage;
        };

        // Eventos de mouse
        this.canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startSelection(e.clientX, e.clientY);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            e.preventDefault();
            moveSelection(e.clientX, e.clientY);
        });

        this.canvas.addEventListener('mouseup', (e) => {
            e.preventDefault();
            endSelection(e.clientX, e.clientY);
        });

        // Eventos táctiles (touch)
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            if (startSelection(touch.clientX, touch.clientY)) {
                // Mostrar mensaje de ayuda
                console.log('📱 Arrastra para seleccionar el área de la firma');
            }
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                moveSelection(touch.clientX, touch.clientY);
            }
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (e.changedTouches.length > 0) {
                const touch = e.changedTouches[0];
                endSelection(touch.clientX, touch.clientY);
            }
        });

        // Prevenir scroll mientras se dibuja en dispositivos móviles
        this.canvas.addEventListener('touchmove', (e) => {
            if (this.isDrawing) {
                e.preventDefault();
            }
        }, { passive: false });
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
     * Actualiza el modo visual del canvas según si se puede dibujar o no
     */
    updateCanvasMode() {
        if (!this.canvas) return;

        const visibleCheckbox = document.getElementById('visibleSignature');
        if (visibleCheckbox && visibleCheckbox.checked) {
            this.canvas.classList.add('can-draw');
            // Mostrar tooltip si existe el signature box
            if (this.signatureBox) {
                console.log('💡 Haz clic y arrastra sobre el PDF para seleccionar dónde colocar la firma');
            }
        } else {
            this.canvas.classList.remove('can-draw');
            // Ocultar signature box si existe
            if (this.signatureBox) {
                this.signatureBox.style.display = 'none';
            }
        }
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
