/**
 * Firma de documentos PDF en el navegador
 * Usa pdf-lib para manipular PDFs
 */

class PDFSigner {
    constructor() {
        this.pdfDoc = null;
        this.pdfBytes = null;
    }

    /**
     * Carga un PDF
     */
    async loadPDF(file) {
        try {
            this.pdfBytes = await this.readFileAsArrayBuffer(file);
            this.pdfDoc = await PDFLib.PDFDocument.load(this.pdfBytes);

            return {
                success: true,
                pageCount: this.pdfDoc.getPageCount(),
                info: this.getDocumentInfo()
            };
        } catch (error) {
            throw new Error(`Error cargando PDF: ${error.message}`);
        }
    }

    /**
     * Firma el PDF
     */
    async signPDF(options = {}) {
        if (!this.pdfDoc) {
            throw new Error('No hay PDF cargado');
        }

        if (!window.certHandler || !window.certHandler.certificate) {
            throw new Error('No hay certificado cargado');
        }

        const {
            visible = true,
            page = 1,
            x = 50,
            y = 700,
            reason = 'Firma Electrónica',
            location = 'México',
            contactInfo = '',
            certificationLevel = 0,
            includeTimestamp = true
        } = options;

        try {
            // Agregar firma visible si se requiere
            if (visible) {
                await this.addVisibleSignature({
                    page: page - 1, // pdf-lib usa índice base 0
                    x,
                    y,
                    reason,
                    location
                });
            }

            // Crear firma digital
            const signature = this.createDigitalSignature();

            // Agregar metadatos
            this.addMetadata({
                reason,
                location,
                contactInfo,
                certificationLevel,
                signature,
                includeTimestamp
            });

            // Serializar PDF
            const signedPdfBytes = await this.pdfDoc.save();

            return {
                success: true,
                pdfBytes: signedPdfBytes,
                signature: signature,
                metadata: {
                    signer: window.certHandler.certificateInfo.subjectString,
                    signDate: new Date().toISOString(),
                    reason,
                    location,
                    certificationLevel: this.getCertificationLevelName(certificationLevel)
                }
            };
        } catch (error) {
            throw new Error(`Error firmando PDF: ${error.message}`);
        }
    }

    /**
     * Agrega firma visible al PDF
     */
    async addVisibleSignature(options) {
        const { page: pageIndex, x, y, reason, location } = options;

        const pages = this.pdfDoc.getPages();
        if (pageIndex >= pages.length) {
            throw new Error(`Página ${pageIndex + 1} no existe`);
        }

        const page = pages[pageIndex];
        const { width, height } = page.getSize();

        // Obtener información del certificado
        const certInfo = window.certHandler.getSummary();

        // Incrustar fuente
        const font = await this.pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
        const fontSize = 10;

        // Configurar dimensiones del recuadro
        const boxWidth = 250;
        const lines = [
            'Firmado digitalmente por:',
            certInfo.name,
            `Fecha: ${new Date().toLocaleString('es-MX')}`,
            `Razón: ${reason}`,
            `Ubicación: ${location}`
        ];
        const lineHeight = fontSize * 1.5;
        const boxHeight = lines.length * lineHeight + 20;

        // Ajustar posición si excede los límites
        const adjustedX = Math.min(x, width - boxWidth - 10);
        const adjustedY = Math.min(y, height - 10);

        // Dibujar recuadro
        page.drawRectangle({
            x: adjustedX,
            y: adjustedY - boxHeight,
            width: boxWidth,
            height: boxHeight,
            borderColor: PDFLib.rgb(0, 0, 0),
            borderWidth: 1.5,
            color: PDFLib.rgb(0.95, 0.95, 0.95)
        });

        // Dibujar texto
        let textY = adjustedY - lineHeight;
        for (const line of lines) {
            page.drawText(line, {
                x: adjustedX + 10,
                y: textY,
                size: fontSize,
                font: font,
                color: PDFLib.rgb(0, 0, 0)
            });
            textY -= lineHeight;
        }
    }

    /**
     * Crea la firma digital
     */
    createDigitalSignature() {
        // Crear hash del PDF
        const hash = window.certHandler.createHash(this.pdfBytes);

        // Firmar el hash
        const signature = window.certHandler.signData(hash);

        return {
            hash,
            signature,
            algorithm: 'SHA256withRSA',
            certificate: window.certHandler.getCertificatePEM()
        };
    }

    /**
     * Agrega metadatos al PDF
     */
    addMetadata(options) {
        const {
            reason,
            location,
            contactInfo,
            certificationLevel,
            signature,
            includeTimestamp
        } = options;

        // Metadatos estándar
        this.pdfDoc.setProducer('Firma Electrónica México - Web App');
        this.pdfDoc.setCreator('Sistema de Firma Electrónica Online');
        this.pdfDoc.setModificationDate(new Date());

        // Metadatos personalizados (se guardan en el PDF)
        const certInfo = window.certHandler.certificateInfo;
        this.pdfDoc.setSubject(`Firmado por: ${certInfo.subjectString}`);
        this.pdfDoc.setKeywords([
            `Firma:${signature.hash}`,
            `Razón:${reason}`,
            `Ubicación:${location}`,
            `Certificación:${certificationLevel}`,
            `Tipo:${certInfo.type}`,
            includeTimestamp ? `Timestamp:${new Date().toISOString()}` : ''
        ].filter(k => k).join('; '));
    }

    /**
     * Obtiene información del documento
     */
    getDocumentInfo() {
        if (!this.pdfDoc) return null;

        return {
            pageCount: this.pdfDoc.getPageCount(),
            title: this.pdfDoc.getTitle() || 'Sin título',
            author: this.pdfDoc.getAuthor() || 'Desconocido',
            subject: this.pdfDoc.getSubject() || '',
            creator: this.pdfDoc.getCreator() || 'Desconocido',
            producer: this.pdfDoc.getProducer() || 'Desconocido',
            creationDate: this.pdfDoc.getCreationDate(),
            modificationDate: this.pdfDoc.getModificationDate()
        };
    }

    /**
     * Obtiene el nombre del nivel de certificación
     */
    getCertificationLevelName(level) {
        const levels = {
            0: 'No certificado (permite modificaciones y más firmas)',
            1: 'Certificado - No se permiten cambios',
            2: 'Certificado - Permitido llenar formularios',
            3: 'Certificado - Permitidas anotaciones y formularios'
        };
        return levels[level] || levels[0];
    }

    /**
     * Descarga el PDF firmado
     */
    downloadSignedPDF(pdfBytes, filename = 'documento_firmado.pdf') {
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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

    /**
     * Limpia el PDF de la memoria
     */
    clear() {
        this.pdfDoc = null;
        this.pdfBytes = null;
    }
}

// Instancia global
window.pdfSigner = new PDFSigner();
