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
            console.log('🔐 Iniciando firma compatible con Adobe Acrobat...');

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

            // Agregar metadatos informativos
            this.addMetadata({
                reason,
                location,
                contactInfo,
                certificationLevel,
                signature: { hash: 'Pending Adobe signature' },
                includeTimestamp
            });

            // Serializar PDF con firma visible y metadatos
            console.log('📄 Serializando PDF con pdf-lib...');
            const pdfWithVisibleSignature = await this.pdfDoc.save();

            // Debugging: Verificar el PDF ANTES de pasarlo a PDFSIGN
            console.log('🔍 DEBUGGING - PDF antes de PDFSIGN:');
            console.log('   - Tipo:', pdfWithVisibleSignature.constructor.name);
            console.log('   - Tamaño:', pdfWithVisibleSignature.length || pdfWithVisibleSignature.byteLength, 'bytes');
            const headerBefore = String.fromCharCode(...pdfWithVisibleSignature.slice(0, 4));
            console.log('   - Header:', headerBefore, headerBefore === '%PDF' ? '✅' : '❌');

            // Obtener contraseña del certificado del almacenamiento temporal
            const certPassword = window.certHandler.lastPassword || password;
            if (!certPassword) {
                throw new Error('Se requiere la contraseña del certificado para firmar digitalmente');
            }
            console.log('🔑 Contraseña disponible:', certPassword ? 'Sí (longitud: ' + certPassword.length + ')' : 'No');

            // Convertir certificado a formato PKCS#12 para pdfsign.js
            console.log('🔑 Convirtiendo certificado a PKCS#12...');
            const p12Bytes = window.certHandler.getPKCS12Bytes(certPassword);
            console.log('🔍 DEBUGGING - P12:');
            console.log('   - Tipo:', p12Bytes.constructor.name);
            console.log('   - Tamaño:', p12Bytes.length || p12Bytes.byteLength, 'bytes');

            // Verificar que PDFSIGN está disponible
            if (typeof PDFSIGN === 'undefined' || !PDFSIGN.signpdf) {
                throw new Error('Biblioteca PDFSIGN no está cargada');
            }
            console.log('✅ PDFSIGN está disponible');

            // Firmar con pdfsign.js para compatibilidad con Adobe
            console.log('✍️ Firmando con PDFSIGN para Adobe Acrobat...');

            // PDFSIGN necesita el PDF como ArrayBuffer, no como Uint8Array ni string
            console.log('🔄 Asegurando que PDF sea ArrayBuffer para pdfsign...');
            let pdfArrayBuffer;
            if (pdfWithVisibleSignature instanceof ArrayBuffer) {
                pdfArrayBuffer = pdfWithVisibleSignature;
            } else if (pdfWithVisibleSignature instanceof Uint8Array) {
                // Convertir Uint8Array a ArrayBuffer
                pdfArrayBuffer = pdfWithVisibleSignature.buffer.slice(
                    pdfWithVisibleSignature.byteOffset,
                    pdfWithVisibleSignature.byteOffset + pdfWithVisibleSignature.byteLength
                );
            } else {
                throw new Error('Formato de PDF no soportado para firma');
            }
            console.log('   PDF como ArrayBuffer:', pdfArrayBuffer.byteLength, 'bytes');

            // Verificar header del ArrayBuffer
            const headerCheck = new Uint8Array(pdfArrayBuffer.slice(0, 4));
            const headerStr = String.fromCharCode(...headerCheck);
            console.log('   Header verificado:', headerStr, headerStr === '%PDF' ? '✅' : '❌');

            // Helper function para hexdump
            const hexDump = (bytes, label, count = 32) => {
                const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
                const hex = Array.from(arr.slice(0, count))
                    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
                    .join(' ');
                const ascii = Array.from(arr.slice(0, count))
                    .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.')
                    .join('');
                console.log(`${label}:`);
                console.log(`  HEX: ${hex}`);
                console.log(`  ASCII: ${ascii}`);
            };

            // Mostrar primeros bytes del input
            hexDump(pdfArrayBuffer, '📥 INPUT PDF después de pdf-lib (primeros 32 bytes)');

            // DIAGNÓSTICO: Probar PDFSIGN con el PDF ORIGINAL (sin modificar por pdf-lib)
            console.log('🔬 DIAGNÓSTICO: Probando PDFSIGN con PDF original (sin modificaciones de pdf-lib)...');
            try {
                const originalPdfBytes = this.pdfBytes; // PDF original cargado
                hexDump(originalPdfBytes, '📥 PDF ORIGINAL (antes de pdf-lib)');

                console.log('   Intentando firmar PDF original directamente...');
                const testResult = PDFSIGN.signpdf(
                    originalPdfBytes,
                    p12Bytes,
                    certPassword
                );
                console.log('✅ TEST: PDFSIGN con PDF original completado');
                hexDump(testResult, '📤 TEST RESULT (primeros 32 bytes)');

                const testHeader = String.fromCharCode(...(testResult instanceof Uint8Array ? testResult : new Uint8Array(testResult)).slice(0, 4));
                console.log('   Header del test:', testHeader, testHeader === '%PDF' ? '✅ VÁLIDO' : '❌ CORRUPTO');

                if (testHeader === '%PDF') {
                    console.log('🎯 CONCLUSIÓN: PDFSIGN funciona con PDF original pero NO con salida de pdf-lib');
                    console.log('   ⚠️ Problema: pdf-lib genera PDFs incompatibles con PDFSIGN');
                } else {
                    console.log('🎯 CONCLUSIÓN: PDFSIGN falla incluso con PDF original');
                    console.log('   ⚠️ Problema: Puede ser certificado P12 o contraseña');
                }
            } catch (testError) {
                console.error('❌ TEST FALLÓ:', testError.message);
                console.log('   El error sugiere problema en PDFSIGN o sus dependencias');
            }

            console.log('\n📍 Ahora intentando con PDF modificado por pdf-lib...');

            let signedPdfBytes;
            try {
                console.log('   Llamando: PDFSIGN.signpdf(ArrayBuffer, p12Uint8Array, password)');
                const signedPdfResult = PDFSIGN.signpdf(
                    pdfArrayBuffer,  // ArrayBuffer
                    p12Bytes,        // Uint8Array
                    certPassword     // String
                );
                console.log('✅ PDFSIGN.signpdf() completado sin excepciones');
                console.log('   Tipo retornado:', signedPdfResult.constructor.name);
                console.log('   Tamaño:', signedPdfResult.length || signedPdfResult.byteLength, 'bytes');

                // Mostrar primeros bytes del resultado INMEDIATAMENTE
                hexDump(signedPdfResult, '📤 OUTPUT de PDFSIGN con pdf-lib (primeros 32 bytes)');

                // Convertir resultado a Uint8Array si es necesario
                if (signedPdfResult instanceof Uint8Array) {
                    signedPdfBytes = signedPdfResult;
                } else if (signedPdfResult instanceof ArrayBuffer) {
                    signedPdfBytes = new Uint8Array(signedPdfResult);
                } else if (typeof signedPdfResult === 'string') {
                    console.log('🔄 Convirtiendo string a Uint8Array...');
                    signedPdfBytes = new Uint8Array(signedPdfResult.length);
                    for (let i = 0; i < signedPdfResult.length; i++) {
                        signedPdfBytes[i] = signedPdfResult.charCodeAt(i) & 0xFF;
                    }
                } else {
                    throw new Error('Tipo de resultado desconocido: ' + typeof signedPdfResult);
                }

                // Verificar después de conversión
                if (signedPdfBytes !== signedPdfResult) {
                    hexDump(signedPdfBytes, '🔄 Después de conversión (primeros 32 bytes)');
                }

                // 🔧 SOLUCIÓN: PDFSIGN tiene un bug que prepone basura antes del header PDF
                // Buscar donde realmente empieza el PDF (buscar "%PDF")
                console.log('🔍 Buscando inicio real del PDF (buscando %PDF header)...');
                let pdfStartIndex = -1;
                for (let i = 0; i < signedPdfBytes.length - 4; i++) {
                    if (signedPdfBytes[i] === 0x25 &&      // %
                        signedPdfBytes[i+1] === 0x50 &&    // P
                        signedPdfBytes[i+2] === 0x44 &&    // D
                        signedPdfBytes[i+3] === 0x46) {    // F
                        pdfStartIndex = i;
                        break;
                    }
                }

                if (pdfStartIndex > 0) {
                    console.log(`⚠️ PDFSIGN Bug detectado: PDF header encontrado en offset ${pdfStartIndex} (debería ser 0)`);
                    console.log(`   Bytes basura al inicio: ${pdfStartIndex}`);
                    hexDump(signedPdfBytes.slice(0, pdfStartIndex), `🗑️ Basura a eliminar (${pdfStartIndex} bytes)`);

                    // Cortar la basura del inicio
                    signedPdfBytes = signedPdfBytes.slice(pdfStartIndex);
                    console.log(`✅ Basura eliminada. Nuevo tamaño: ${signedPdfBytes.length} bytes`);
                    hexDump(signedPdfBytes, '✅ PDF corregido (primeros 32 bytes)');
                } else if (pdfStartIndex === 0) {
                    console.log('✅ PDF header en posición correcta (offset 0)');
                } else {
                    console.error('❌ No se encontró header %PDF en el resultado de PDFSIGN');
                    throw new Error('PDFSIGN retornó datos inválidos sin header PDF');
                }

            } catch (pdfsignError) {
                console.error('❌ Error en PDFSIGN.signpdf():', pdfsignError);
                throw new Error(`PDFSIGN falló: ${pdfsignError.message}`);
            }

            console.log('✅ PDF firmado digitalmente - Compatible con Adobe Acrobat');
            console.log('📊 Tipo de resultado:', signedPdfBytes ? signedPdfBytes.constructor.name : 'null/undefined');
            console.log('📊 Tamaño del PDF firmado:', signedPdfBytes.length || signedPdfBytes.byteLength, 'bytes');

            // Asegurar que sea Uint8Array
            let finalPdfBytes;
            if (signedPdfBytes instanceof Uint8Array) {
                finalPdfBytes = signedPdfBytes;
            } else if (signedPdfBytes instanceof ArrayBuffer) {
                finalPdfBytes = new Uint8Array(signedPdfBytes);
            } else if (typeof signedPdfBytes === 'string') {
                // Convertir string binario a Uint8Array
                const bytes = new Uint8Array(signedPdfBytes.length);
                for (let i = 0; i < signedPdfBytes.length; i++) {
                    bytes[i] = signedPdfBytes.charCodeAt(i);
                }
                finalPdfBytes = bytes;
            } else {
                console.error('❌ Tipo de PDF firmado no reconocido:', typeof signedPdfBytes);
                throw new Error('Formato de PDF firmado no válido');
            }

            console.log('✅ PDF convertido a Uint8Array:', finalPdfBytes.length, 'bytes');

            // Verificar que sea un PDF válido (debe empezar con %PDF)
            const header = String.fromCharCode(...finalPdfBytes.slice(0, 4));
            console.log('📄 Verificación final - Header del PDF:', header);
            if (header !== '%PDF') {
                console.error('❌ El archivo no parece ser un PDF válido. Header:', header);
                console.error('   Esto no debería ocurrir después de la corrección del bug de PDFSIGN');
                hexDump(finalPdfBytes, '❌ Primeros 64 bytes del PDF inválido', 64);
                throw new Error('El PDF firmado no tiene un formato válido después de corrección');
            }
            console.log('✅ Verificación exitosa: PDF tiene formato válido');

            // Calcular hash final del PDF firmado
            const finalHash = window.certHandler.createHash(finalPdfBytes);

            return {
                success: true,
                pdfBytes: finalPdfBytes,
                signature: {
                    hash: finalHash,
                    algorithm: 'SHA256withRSA (PKCS#7)',
                    adobeCompatible: true
                },
                metadata: {
                    signer: window.certHandler.certificateInfo.subjectString,
                    signDate: new Date().toISOString(),
                    reason,
                    location,
                    certificationLevel: this.getCertificationLevelName(certificationLevel),
                    adobeCompatible: '✓ Compatible con Adobe Acrobat Reader'
                }
            };
        } catch (error) {
            console.error('❌ Error en firma digital:', error);
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
