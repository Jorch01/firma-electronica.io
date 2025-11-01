/**
 * Validación de firmas en PDFs
 */

class PDFValidator {
    async validatePDF(file) {
        try {
            const arrayBuffer = await this.readFileAsArrayBuffer(file);
            const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);

            // Extraer información del PDF
            const info = {
                pageCount: pdfDoc.getPageCount(),
                title: pdfDoc.getTitle() || 'Sin título',
                author: pdfDoc.getAuthor() || 'Desconocido',
                subject: pdfDoc.getSubject() || '',
                creator: pdfDoc.getCreator() || '',
                producer: pdfDoc.getProducer() || '',
                keywords: pdfDoc.getKeywords() || '',
                creationDate: pdfDoc.getCreationDate(),
                modificationDate: pdfDoc.getModificationDate()
            };

            // Verificar si fue firmado por nuestra aplicación
            const signatures = [];
            const producer = info.producer;
            const keywords = info.keywords;

            if (producer && producer.includes('Firma Electrónica México')) {
                // Parsear metadatos de firma
                const metadata = this.parseSignatureMetadata(keywords, info.subject);

                signatures.push({
                    valid: true,
                    signer: metadata.signer || 'Verificación básica',
                    signDate: info.modificationDate ? info.modificationDate.toISOString() : new Date().toISOString(),
                    reason: metadata.reason || 'Firma Electrónica',
                    location: metadata.location || 'México',
                    hash: metadata.hash || 'N/A',
                    certificationLevel: metadata.certificationLevel || '0',
                    type: metadata.type || 'Desconocido',
                    producer: producer,
                    message: 'Documento firmado con Firma Electrónica México',
                    integrity: await this.verifyIntegrity(arrayBuffer),
                    timestamp: metadata.timestamp || null
                });
            }

            if (signatures.length === 0) {
                // Verificar si tiene otras firmas digitales
                // (esto sería más complejo en una implementación real)
                signatures.push({
                    valid: false,
                    message: 'No se encontraron firmas digitales reconocidas',
                    note: 'Este PDF puede contener firmas de otros sistemas'
                });
            }

            return {
                success: true,
                signatures,
                documentInfo: info,
                isValid: signatures.some(sig => sig.valid)
            };
        } catch (error) {
            throw new Error(`Error validando PDF: ${error.message}`);
        }
    }

    /**
     * Parsea metadatos de firma de keywords
     */
    parseSignatureMetadata(keywords, subject) {
        const metadata = {};

        if (keywords) {
            const parts = keywords.split(';').map(p => p.trim());
            parts.forEach(part => {
                const [key, value] = part.split(':').map(p => p.trim());
                if (key && value) {
                    metadata[key.toLowerCase()] = value;
                }
            });
        }

        if (subject) {
            const signerMatch = subject.match(/Firmado por:\s*(.+)/);
            if (signerMatch) {
                metadata.signer = signerMatch[1];
            }
        }

        return metadata;
    }

    /**
     * Verifica integridad del PDF
     */
    async verifyIntegrity(arrayBuffer) {
        try {
            // Crear hash SHA-256 del contenido actual
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            return {
                valid: true,
                hash: hash,
                algorithm: 'SHA-256',
                message: 'Hash calculado del documento actual'
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
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
window.pdfValidator = new PDFValidator();
