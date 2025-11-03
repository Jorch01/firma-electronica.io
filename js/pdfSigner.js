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
     * Firma el PDF con firma digital compatible con Adobe Acrobat
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
            includeTimestamp = true,
            password = '' // Contraseña del certificado (necesaria para P12)
        } = options;

        try {
            console.log('🔐 Iniciando firma electrónica con PKCS#7...');

            // Agregar firma visible si se requiere
            if (visible) {
                console.log('📝 Agregando firma visible...');
                await this.addVisibleSignature({
                    page: page - 1, // pdf-lib usa índice base 0
                    x,
                    y,
                    reason,
                    location
                });
            }

            // Crear firma digital (hash criptográfico)
            const digitalSignature = this.createDigitalSignature();

            // Agregar metadatos con información de la firma
            this.addMetadata({
                reason,
                location,
                contactInfo,
                certificationLevel,
                signature: digitalSignature,
                includeTimestamp
            });

            // Serializar PDF con firma visible y metadatos
            console.log('📄 Guardando PDF con firma visible...');
            const pdfWithVisibleSignature = await this.pdfDoc.save();

            // Agregar firma digital PKCS#7
            console.log('🔏 Agregando firma digital PKCS#7...');
            const signedPdfBytes = await window.pkcs7Signer.signPDF(
                pdfWithVisibleSignature,
                window.certHandler.certificate,
                window.certHandler.privateKey,
                {
                    reason,
                    location,
                    contactInfo,
                    name: window.certHandler.getSummary().name
                }
            );

            // Verificar PDF válido
            const header = String.fromCharCode(...signedPdfBytes.slice(0, 4));
            if (header !== '%PDF') {
                throw new Error(`PDF inválido. Header: ${header}`);
            }

            console.log(`✅ PDF firmado exitosamente: ${signedPdfBytes.length} bytes`);

            return {
                success: true,
                pdfBytes: signedPdfBytes,
                signature: digitalSignature,
                metadata: {
                    signer: window.certHandler.certificateInfo.subjectString,
                    signDate: new Date().toISOString(),
                    reason,
                    location,
                    certificationLevel: this.getCertificationLevelName(certificationLevel)
                }
            };
        } catch (error) {
            console.error('❌ Error en firma:', error);
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
        const certInfo = window.certHandler.certificateInfo;
        const summary = window.certHandler.getSummary();

        // Incrustar fuentes
        const fontBold = await this.pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
        const font = await this.pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
        const fontSmall = await this.pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

        const titleSize = 11;
        const fontSize = 9;
        const smallSize = 7;

        // Configurar dimensiones del recuadro
        const boxWidth = 280;
        const padding = 12;
        const lineHeight = fontSize * 1.6;

        // Calcular contenido
        const dateStr = new Date().toLocaleString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });

        const lines = [
            { text: 'FIRMADO DIGITALMENTE', font: fontBold, size: titleSize, color: [0.1, 0.3, 0.6] },
            { text: '', size: 4 }, // Espaciado
            { text: `Firmante: ${summary.name}`, font: font, size: fontSize },
            { text: `Fecha: ${dateStr}`, font: font, size: fontSize },
            { text: `Razon: ${reason}`, font: font, size: fontSize },
            { text: `Ubicacion: ${location}`, font: font, size: fontSize },
            { text: '', size: 4 }, // Espaciado
            { text: `Certificado: ${certInfo.type} - ${summary.type}`, font: fontSmall, size: smallSize, color: [0.3, 0.3, 0.3] },
            { text: `Valido hasta: ${summary.validTo}`, font: fontSmall, size: smallSize, color: [0.3, 0.3, 0.3] },
            { text: `Firma digital: PKCS#7/SHA-256`, font: fontSmall, size: smallSize, color: [0.3, 0.3, 0.3] }
        ];

        // Calcular altura total
        const boxHeight = lines.reduce((sum, line) => sum + (line.size || lineHeight), 0) + padding * 2;

        // Ajustar posición si excede los límites
        const adjustedX = Math.max(10, Math.min(x, width - boxWidth - 10));
        const adjustedY = Math.max(boxHeight + 10, Math.min(y, height - 10));

        // Dibujar sombra
        page.drawRectangle({
            x: adjustedX + 2,
            y: adjustedY - boxHeight + 2,
            width: boxWidth,
            height: boxHeight,
            color: PDFLib.rgb(0.7, 0.7, 0.7),
            opacity: 0.3
        });

        // Dibujar recuadro principal
        page.drawRectangle({
            x: adjustedX,
            y: adjustedY - boxHeight,
            width: boxWidth,
            height: boxHeight,
            borderColor: PDFLib.rgb(0.1, 0.3, 0.6),
            borderWidth: 2,
            color: PDFLib.rgb(0.98, 0.98, 1)
        });

        // Dibujar barra superior
        page.drawRectangle({
            x: adjustedX,
            y: adjustedY - 30,
            width: boxWidth,
            height: 30,
            color: PDFLib.rgb(0.1, 0.3, 0.6)
        });

        // Dibujar texto
        let textY = adjustedY - padding - 8;
        for (const line of lines) {
            if (line.text) {
                const currentFont = line.font || font;
                const currentSize = line.size || fontSize;
                const currentColor = line.color || [0, 0, 0];

                page.drawText(line.text, {
                    x: adjustedX + padding,
                    y: textY,
                    size: currentSize,
                    font: currentFont,
                    color: PDFLib.rgb(...currentColor)
                });
            }
            textY -= (line.size || lineHeight);
        }

        console.log(`✅ Firma visible agregada en página ${pageIndex + 1} (${adjustedX}, ${adjustedY})`);
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
        this.pdfDoc.setKeywords(
            [
                `Firma:${signature.hash}`,
                `Razón:${reason}`,
                `Ubicación:${location}`,
                `Certificación:${certificationLevel}`,
                `Tipo:${certInfo.type}`,
                includeTimestamp ? `Timestamp:${new Date().toISOString()}` : ''
            ].filter(k => k)
        );
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
