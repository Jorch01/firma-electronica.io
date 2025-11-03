/**
 * Firma PKCS#7 para PDFs
 * Implementación manual de firma digital compatible con Adobe Acrobat
 */

class PKCS7Signer {
    constructor() {
        this.forge = window.forge;
    }

    /**
     * Firma un PDF con PKCS#7 detached
     * @param {Uint8Array} pdfBytes - PDF a firmar
     * @param {Object} certificate - Certificado forge
     * @param {Object} privateKey - Llave privada forge
     * @param {Object} options - Opciones de firma
     * @returns {Uint8Array} PDF firmado
     */
    async signPDF(pdfBytes, certificate, privateKey, options = {}) {
        const {
            reason = 'Firma Electrónica',
            location = 'México',
            contactInfo = '',
            name = ''
        } = options;

        console.log('🔐 Iniciando firma PKCS#7...');

        try {
            // 1. Preparar el PDF para la firma
            const pdfWithPlaceholder = this.addSignaturePlaceholder(pdfBytes, {
                reason,
                location,
                contactInfo,
                name
            });

            console.log('✅ Placeholder agregado');

            // 2. Calcular ByteRange
            const byteRange = this.calculateByteRange(pdfWithPlaceholder);
            console.log('✅ ByteRange calculado:', byteRange);

            // 3. Obtener datos a firmar (excluir el placeholder de /Contents)
            const dataToSign = this.getDataToSign(pdfWithPlaceholder, byteRange);
            console.log('✅ Datos preparados para firma:', dataToSign.length, 'bytes');

            // 4. Crear firma PKCS#7
            const signature = this.createPKCS7Signature(dataToSign, certificate, privateKey);
            console.log('✅ Firma PKCS#7 creada:', signature.length, 'bytes');

            // 5. Insertar firma en el PDF
            const signedPDF = this.insertSignature(pdfWithPlaceholder, signature, byteRange);
            console.log('✅ Firma insertada en PDF');

            return signedPDF;

        } catch (error) {
            console.error('❌ Error en firma PKCS#7:', error);
            throw error;
        }
    }

    /**
     * Agrega un placeholder para la firma en el PDF
     */
    addSignaturePlaceholder(pdfBytes, options) {
        console.log('📝 Agregando placeholder de firma...');

        // Convertir a string para manipular
        let pdfString = this.uint8ArrayToString(pdfBytes);

        // Buscar el final del PDF
        const eofMatch = pdfString.match(/%%EOF\s*$/);
        if (!eofMatch) {
            throw new Error('No se encontró %%EOF en el PDF');
        }

        const insertPosition = eofMatch.index;

        // Buscar el último objeto y xref
        const xrefMatch = pdfString.match(/startxref\s+(\d+)\s+%%EOF/);
        if (!xrefMatch) {
            throw new Error('No se encontró startxref');
        }

        const lastXrefOffset = parseInt(xrefMatch[1]);

        // Encontrar el catálogo (Root)
        const catalogMatch = pdfString.match(/\/Root\s+(\d+)\s+(\d+)\s+R/);
        if (!catalogMatch) {
            throw new Error('No se encontró objeto Root');
        }

        const rootObjNum = parseInt(catalogMatch[1]);

        // Encontrar el objeto del catálogo
        const catalogObjPattern = new RegExp(`${rootObjNum}\\s+\\d+\\s+obj\\s*<<([^>]*)>>`);
        const catalogObjMatch = pdfString.match(catalogObjPattern);

        if (!catalogObjMatch) {
            throw new Error('No se pudo parsear objeto catálogo');
        }

        // Buscar primera página
        const pagesMatch = pdfString.match(/\/Pages\s+(\d+)\s+\d+\s+R/);
        if (!pagesMatch) {
            throw new Error('No se encontró objeto Pages');
        }

        const pagesObjNum = parseInt(pagesMatch[1]);

        // Encontrar objeto Pages para obtener primera página
        const pagesObjPattern = new RegExp(`${pagesObjNum}\\s+\\d+\\s+obj\\s*<<([^>]*)>>`);
        const pagesObjMatch = pdfString.match(pagesObjPattern);

        if (!pagesObjMatch) {
            throw new Error('No se pudo parsear objeto Pages');
        }

        // Extraer referencia a Kids (primera página)
        const kidsMatch = pagesObjMatch[1].match(/\/Kids\s*\[\s*(\d+)\s+\d+\s+R/);
        if (!kidsMatch) {
            throw new Error('No se encontró array Kids');
        }

        const firstPageObjNum = parseInt(kidsMatch[1]);

        // Obtener el siguiente número de objeto disponible
        const allObjects = pdfString.match(/(\d+)\s+\d+\s+obj/g) || [];
        const objectNumbers = allObjects.map(match => parseInt(match.match(/(\d+)/)[1]));
        const nextObjNum = Math.max(...objectNumbers) + 1;

        const sigObjNum = nextObjNum;
        const annotObjNum = nextObjNum + 1;

        // Crear objeto de firma con placeholder
        const signatureSize = 8192; // Espacio para la firma (4096 bytes = 8192 hex chars)
        const placeholder = '0'.repeat(signatureSize);

        const now = new Date();
        const dateStr = this.formatPDFDate(now);

        const sigObject = `
${sigObjNum} 0 obj
<<
/Type /Sig
/Filter /Adobe.PPKLite
/SubFilter /adbe.pkcs7.detached
/Name (${options.name})
/Reason (${options.reason})
/Location (${options.location})
/M (${dateStr})
/ByteRange [0000000000 0000000000 0000000000 0000000000]
/Contents <${placeholder}>
>>
endobj
`;

        // Crear anotación de firma
        const annotObject = `
${annotObjNum} 0 obj
<<
/Type /Annot
/Subtype /Widget
/FT /Sig
/Rect [0 0 0 0]
/F 132
/T (Signature1)
/V ${sigObjNum} 0 R
/P ${firstPageObjNum} 0 R
>>
endobj
`;

        // Insertar los nuevos objetos antes del xref
        pdfString = pdfString.slice(0, insertPosition) +
                    sigObject +
                    annotObject +
                    pdfString.slice(insertPosition);

        // Modificar la primera página para agregar la anotación
        const pageObjPattern = new RegExp(`(${firstPageObjNum}\\s+\\d+\\s+obj\\s*<<[^>]*)(>>)`);
        pdfString = pdfString.replace(pageObjPattern,
            `$1/Annots [${annotObjNum} 0 R]$2`);

        // Modificar el catálogo para agregar AcroForm
        const catalogPattern = new RegExp(`(${rootObjNum}\\s+\\d+\\s+obj\\s*<<[^>]*)(>>)`);
        pdfString = pdfString.replace(catalogPattern,
            `$1/AcroForm<</Fields[${annotObjNum} 0 R]/SigFlags 3>>$2`);

        console.log('✅ Objetos de firma agregados');
        console.log(`   - Objeto firma: ${sigObjNum}`);
        console.log(`   - Objeto anotación: ${annotObjNum}`);

        return this.stringToUint8Array(pdfString);
    }

    /**
     * Calcula el ByteRange para la firma
     */
    calculateByteRange(pdfBytes) {
        const pdfString = this.uint8ArrayToString(pdfBytes);

        // Buscar el placeholder de /Contents
        const contentsMatch = pdfString.match(/\/Contents\s*<([0-9a-fA-F]+)>/);
        if (!contentsMatch) {
            throw new Error('No se encontró /Contents placeholder');
        }

        const contentsStart = contentsMatch.index + contentsMatch[0].indexOf('<') + 1;
        const contentsLength = contentsMatch[1].length;
        const contentsEnd = contentsStart + contentsLength;

        // ByteRange: [inicio1 longitud1 inicio2 longitud2]
        // inicio1 = 0
        // longitud1 = posición antes de <
        // inicio2 = posición después de >
        // longitud2 = resto del archivo

        const range1Start = 0;
        const range1Length = contentsStart - 1;
        const range2Start = contentsEnd + 1;
        const range2Length = pdfBytes.length - range2Start;

        return [range1Start, range1Length, range2Start, range2Length];
    }

    /**
     * Obtiene los datos a firmar (excluyendo el placeholder)
     */
    getDataToSign(pdfBytes, byteRange) {
        const [start1, length1, start2, length2] = byteRange;

        const part1 = pdfBytes.slice(start1, start1 + length1);
        const part2 = pdfBytes.slice(start2, start2 + length2);

        // Concatenar ambas partes
        const dataToSign = new Uint8Array(part1.length + part2.length);
        dataToSign.set(part1, 0);
        dataToSign.set(part2, part1.length);

        return dataToSign;
    }

    /**
     * Crea la firma PKCS#7 detached
     */
    createPKCS7Signature(data, certificate, privateKey) {
        console.log('🔏 Generando firma PKCS#7 detached...');

        // Crear mensaje PKCS#7
        const p7 = this.forge.pkcs7.createSignedData();

        p7.content = this.forge.util.createBuffer(data);

        // Agregar certificado
        p7.addCertificate(certificate);

        // Agregar firmante
        p7.addSigner({
            key: privateKey,
            certificate: certificate,
            digestAlgorithm: this.forge.pki.oids.sha256,
            authenticatedAttributes: [
                {
                    type: this.forge.pki.oids.contentType,
                    value: this.forge.pki.oids.data
                },
                {
                    type: this.forge.pki.oids.messageDigest
                    // Valor se calcula automáticamente
                },
                {
                    type: this.forge.pki.oids.signingTime,
                    value: new Date()
                }
            ]
        });

        // Generar firma (detached = true, no incluye el contenido original)
        p7.sign({ detached: true });

        // Convertir a DER
        const derBuffer = this.forge.asn1.toDer(p7.toAsn1()).getBytes();

        // Convertir a hex string
        const hexString = this.forge.util.bytesToHex(derBuffer);

        console.log(`✅ Firma PKCS#7 generada: ${hexString.length} caracteres hex`);

        return hexString;
    }

    /**
     * Inserta la firma en el PDF
     */
    insertSignature(pdfBytes, signatureHex, byteRange) {
        console.log('📥 Insertando firma en PDF...');

        let pdfString = this.uint8ArrayToString(pdfBytes);

        // Actualizar ByteRange
        const byteRangeStr = `[${byteRange.map(n => String(n).padStart(10, '0')).join(' ')}]`;
        pdfString = pdfString.replace(
            /\/ByteRange\s*\[[^\]]*\]/,
            `/ByteRange ${byteRangeStr}`
        );

        // Insertar firma en /Contents
        pdfString = pdfString.replace(
            /\/Contents\s*<[0-9a-fA-F]+>/,
            `/Contents <${signatureHex}>`
        );

        console.log('✅ Firma insertada');

        return this.stringToUint8Array(pdfString);
    }

    /**
     * Formatea una fecha en formato PDF
     */
    formatPDFDate(date) {
        const pad = (n) => String(n).padStart(2, '0');

        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());

        // Obtener offset de timezone
        const offset = -date.getTimezoneOffset();
        const offsetHours = pad(Math.floor(Math.abs(offset) / 60));
        const offsetMinutes = pad(Math.abs(offset) % 60);
        const offsetSign = offset >= 0 ? '+' : '-';

        return `D:${year}${month}${day}${hours}${minutes}${seconds}${offsetSign}${offsetHours}'${offsetMinutes}'`;
    }

    /**
     * Convierte Uint8Array a string binario
     */
    uint8ArrayToString(uint8Array) {
        let binaryString = '';
        const chunkSize = 32768; // Procesar en chunks para evitar stack overflow

        for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
            binaryString += String.fromCharCode.apply(null, chunk);
        }

        return binaryString;
    }

    /**
     * Convierte string binario a Uint8Array
     */
    stringToUint8Array(str) {
        const uint8Array = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
            uint8Array[i] = str.charCodeAt(i);
        }
        return uint8Array;
    }
}

// Instancia global
window.pkcs7Signer = new PKCS7Signer();
