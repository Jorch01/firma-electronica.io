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

            // 2. Calcular ByteRange inicial
            const byteRange = this.calculateByteRange(pdfWithPlaceholder);
            console.log('✅ ByteRange calculado:', byteRange);

            // 3. CRÍTICO: Actualizar ByteRange en el PDF ANTES de firmar
            console.log('📝 Actualizando ByteRange en PDF...');
            const byteRangeStr = `[${byteRange.map(n => String(n).padStart(10, '0')).join(' ')}]`;
            let pdfStringTemp = this.uint8ArrayToString(pdfWithPlaceholder);
            pdfStringTemp = pdfStringTemp.replace(
                /\/ByteRange\s*\[[^\]]*\]/,
                `/ByteRange ${byteRangeStr}`
            );
            const pdfWithByteRange = this.stringToUint8Array(pdfStringTemp);
            console.log('✅ ByteRange actualizado en PDF');

            // 4. RECALCULAR ByteRange para verificar que no cambió
            const byteRangeVerify = this.calculateByteRange(pdfWithByteRange);
            console.log('🔍 Verificación ByteRange:', byteRangeVerify);

            if (JSON.stringify(byteRange) !== JSON.stringify(byteRangeVerify)) {
                console.error('❌ ByteRange cambió después de actualizar!');
                console.error('   Original:', byteRange);
                console.error('   Después:', byteRangeVerify);
                throw new Error('ByteRange inválido - cambió después de actualizar');
            }

            // 5. Obtener datos a firmar (del PDF con ByteRange actualizado)
            const dataToSign = this.getDataToSign(pdfWithByteRange, byteRangeVerify);
            console.log('✅ Datos preparados para firma:', dataToSign.length, 'bytes');

            // 6. Crear firma PKCS#7
            const signature = this.createPKCS7Signature(dataToSign, certificate, privateKey);
            console.log('✅ Firma PKCS#7 creada:', signature.length, 'bytes');

            // 7. Insertar firma en el PDF (SIN modificar ByteRange)
            const signedPDF = this.insertSignatureOnly(pdfWithByteRange, signature);
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

        // DEBUG: Mostrar primeros 2000 caracteres del PDF
        console.log('🔍 DEBUG - Primeros 2000 caracteres del PDF:');
        console.log(pdfString.substring(0, 2000));

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
        console.log('✅ Root encontrado: objeto', rootObjNum);

        // DEBUG: Listar todos los objetos en el PDF
        const allObjMatches = pdfString.match(/(\d+)\s+\d+\s+obj/g);
        if (allObjMatches) {
            const objNumbers = allObjMatches.map(m => m.match(/(\d+)/)[1]);
            console.log('📋 Objetos encontrados en PDF:', objNumbers.slice(0, 50).join(', '));
            console.log(`   Total de objetos: ${objNumbers.length}`);
        }

        // Encontrar el objeto del catálogo - buscar específicamente el número exacto
        const searchStr = `${rootObjNum} 0 obj`;
        const objStart = pdfString.indexOf(searchStr);

        if (objStart === -1) {
            console.error('❌ No se encontró objeto catálogo:', rootObjNum);
            console.error(`   Buscando: "${searchStr}"`);
            throw new Error('No se pudo encontrar objeto catálogo');
        }

        console.log(`✅ Objeto ${rootObjNum} encontrado en posición:`, objStart);

        const objEnd = pdfString.indexOf('endobj', objStart);

        if (objEnd === -1) {
            console.error('❌ No se encontró fin del objeto:', rootObjNum);
            throw new Error('No se pudo parsear objeto catálogo');
        }

        const catalogObj = pdfString.substring(objStart, objEnd + 6);
        console.log('✅ Catálogo encontrado');
        console.log('📄 Objeto completo:');
        console.log(catalogObj);

        // Extraer el diccionario del catálogo
        const dictMatch = catalogObj.match(/<<([\s\S]*)>>/);
        if (!dictMatch) {
            console.error('❌ No se pudo extraer diccionario del catálogo');
            throw new Error('No se pudo parsear diccionario del catálogo');
        }

        const catalogDict = dictMatch[1];
        console.log('✅ Diccionario extraído:', catalogDict.substring(0, 300));

        // Buscar /Pages en el diccionario del catálogo
        const pagesMatch = catalogDict.match(/\/Pages\s+(\d+)\s+\d+\s+R/);

        if (!pagesMatch) {
            console.error('❌ No se encontró /Pages en el catálogo');
            console.error('   Diccionario:', catalogDict);
            throw new Error('No se encontró objeto Pages');
        }

        const pagesObjNum = parseInt(pagesMatch[1]);
        console.log('✅ Pages encontrado: objeto', pagesObjNum);

        // Encontrar objeto Pages - buscar específicamente
        const pagesSearchStr = `${pagesObjNum} 0 obj`;
        const pagesObjStart = pdfString.indexOf(pagesSearchStr);

        if (pagesObjStart === -1) {
            console.error('❌ No se encontró objeto Pages:', pagesObjNum);
            throw new Error('No se encontró objeto Pages');
        }

        console.log(`✅ Objeto Pages ${pagesObjNum} encontrado en posición:`, pagesObjStart);

        const pagesObjEnd = pdfString.indexOf('endobj', pagesObjStart);

        if (pagesObjEnd === -1) {
            throw new Error('No se pudo parsear objeto Pages');
        }

        const pagesObj = pdfString.substring(pagesObjStart, pagesObjEnd + 6);
        console.log('📄 Objeto Pages:', pagesObj.substring(0, 500));

        // Extraer diccionario del objeto Pages
        const pagesDictMatch = pagesObj.match(/<<([\s\S]*)>>/);
        if (!pagesDictMatch) {
            throw new Error('No se pudo extraer diccionario de Pages');
        }

        const pagesDict = pagesDictMatch[1];

        // Extraer referencia a Kids (primera página)
        const kidsMatch = pagesDict.match(/\/Kids\s*\[\s*(\d+)\s+\d+\s+R/);
        if (!kidsMatch) {
            console.error('❌ No se encontró /Kids en Pages');
            console.error('   Diccionario Pages:', pagesDict);
            throw new Error('No se encontró array Kids');
        }

        const firstPageObjNum = parseInt(kidsMatch[1]);
        console.log('✅ Primera página encontrada: objeto', firstPageObjNum);

        // Obtener el siguiente número de objeto disponible
        const allObjects = pdfString.match(/(\d+)\s+\d+\s+obj/g) || [];
        const objectNumbers = allObjects.map(match => parseInt(match.match(/(\d+)/)[1]));
        const nextObjNum = Math.max(...objectNumbers) + 1;

        const sigObjNum = nextObjNum;
        const annotObjNum = nextObjNum + 1;

        // Crear objeto de firma con placeholder
        // TEMPORAL: Aumentado a 1048576 (1MB) porque forge incluye contenido completo
        const signatureSize = 1048576; // Firma con contenido ~535KB, necesitamos espacio extra
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

        console.log('✅ Objetos insertados');

        // Modificar la primera página para agregar la anotación
        // Buscar el objeto de la primera página específicamente
        const firstPageSearchStr = `${firstPageObjNum} 0 obj`;
        const pageStart = pdfString.indexOf(firstPageSearchStr);

        if (pageStart !== -1) {
            const pageEnd = pdfString.indexOf('endobj', pageStart);

            if (pageEnd !== -1) {
                const pageObj = pdfString.substring(pageStart, pageEnd);

                // Buscar el último >> antes de endobj para insertar /Annots
                const lastDictEnd = pageObj.lastIndexOf('>>');

                if (lastDictEnd !== -1) {
                    const beforeDict = pdfString.substring(0, pageStart + lastDictEnd);
                    const afterDict = pdfString.substring(pageStart + lastDictEnd);

                    pdfString = beforeDict + `/Annots [${annotObjNum} 0 R]` + afterDict;
                    console.log('✅ Anotación agregada a página');
                }
            }
        }

        // Modificar el catálogo para agregar AcroForm
        // Recalcular posición del catálogo después de insertar
        const catalogSearchStr2 = `${rootObjNum} 0 obj`;
        const catStart = pdfString.indexOf(catalogSearchStr2);

        if (catStart !== -1) {
            const catEnd = pdfString.indexOf('endobj', catStart);

            if (catEnd !== -1) {
                const catObj = pdfString.substring(catStart, catEnd);
                const lastDictEnd = catObj.lastIndexOf('>>');

                if (lastDictEnd !== -1) {
                    const beforeDict = pdfString.substring(0, catStart + lastDictEnd);
                    const afterDict = pdfString.substring(catStart + lastDictEnd);

                    pdfString = beforeDict + `/AcroForm<</Fields[${annotObjNum} 0 R]/SigFlags 3>>` + afterDict;
                    console.log('✅ AcroForm agregado a catálogo');
                }
            }
        }

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

        // Buscar el placeholder de /Contents con el patrón exacto
        const contentsPattern = /\/Contents\s*<([0-9a-fA-F]+)>/;
        const contentsMatch = pdfString.match(contentsPattern);

        if (!contentsMatch) {
            throw new Error('No se encontró /Contents placeholder');
        }

        // Posición del < antes del contenido hex
        const contentsStart = contentsMatch.index + contentsMatch[0].indexOf('<') + 1;
        const contentsLength = contentsMatch[1].length;
        const contentsEnd = contentsStart + contentsLength;

        console.log('🔍 ByteRange Debug:');
        console.log('   - Posición inicio placeholder:', contentsStart);
        console.log('   - Longitud placeholder:', contentsLength);
        console.log('   - Posición fin placeholder:', contentsEnd);
        console.log('   - Tamaño total PDF:', pdfBytes.length);

        // ByteRange: [inicio1 longitud1 inicio2 longitud2]
        const range1Start = 0;
        const range1Length = contentsStart - 1; // Hasta antes del <
        const range2Start = contentsEnd + 1;    // Después del >
        const range2Length = pdfBytes.length - range2Start;

        const byteRange = [range1Start, range1Length, range2Start, range2Length];

        console.log('   - ByteRange:', byteRange);
        console.log('   - Bytes firmados parte 1:', range1Start, 'a', range1Start + range1Length - 1);
        console.log('   - Bytes firmados parte 2:', range2Start, 'a', range2Start + range2Length - 1);
        console.log('   - Total bytes firmados:', range1Length + range2Length);
        console.log('   - Bytes NO firmados (placeholder):', contentsLength);

        return byteRange;
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

        // Establecer contenido - forge lo necesita para calcular messageDigest
        const dataString = this.uint8ArrayToString(data);
        p7.content = this.forge.util.createBuffer(dataString);

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
                    // forge calcula automáticamente el hash
                },
                {
                    type: this.forge.pki.oids.signingTime,
                    value: new Date()
                }
            ]
        });

        // Generar firma (detached=true para no incluir contenido en output)
        p7.sign({ detached: true });

        // Convertir a ASN.1
        let asn1 = p7.toAsn1();

        console.log('🔍 Debug firma PKCS#7:');
        console.log(`   - Tamaño datos firmados: ${data.length} bytes`);

        // NO manipular eContent - dejar que forge maneje detached correctamente
        console.log(`   ℹ️ Usando firma PKCS#7 generada por forge sin modificaciones`);

        // Convertir a DER
        const derBuffer = this.forge.asn1.toDer(asn1).getBytes();
        console.log(`   - Tamaño DER final: ${derBuffer.length} bytes`);

        // Convertir a hex string
        const hexString = this.forge.util.bytesToHex(derBuffer);

        console.log(`   - Tamaño hex: ${hexString.length} caracteres`);
        console.log(`✅ Firma PKCS#7 generada (esperado: 4000-8000 chars)`);

        // Validar tamaño razonable
        if (hexString.length > 16384) {
            console.warn(`⚠️ ADVERTENCIA: Firma muy grande (${hexString.length} chars). Posible problema.`);
        }

        return hexString;
    }

    /**
     * Inserta SOLO la firma en el PDF (sin modificar ByteRange)
     */
    insertSignatureOnly(pdfBytes, signatureHex) {
        console.log('📥 Insertando solo firma en PDF (sin modificar ByteRange)...');

        let pdfString = this.uint8ArrayToString(pdfBytes);

        // Validar que la firma quepa en el placeholder
        const placeholderMatch = pdfString.match(/\/Contents\s*<([0-9a-fA-F]+)>/);
        if (!placeholderMatch) {
            throw new Error('No se encontró placeholder de /Contents');
        }

        const placeholderSize = placeholderMatch[1].length;
        console.log(`   Tamaño placeholder: ${placeholderSize} caracteres`);
        console.log(`   Tamaño firma: ${signatureHex.length} caracteres`);

        if (signatureHex.length > placeholderSize) {
            throw new Error(`Firma demasiado grande: ${signatureHex.length} > ${placeholderSize}`);
        }

        // Rellenar con ceros si la firma es más pequeña
        const paddedSignature = signatureHex.padEnd(placeholderSize, '0');
        console.log(`   Firma con padding: ${paddedSignature.length} caracteres`);

        // Insertar firma con padding en /Contents
        pdfString = pdfString.replace(
            /\/Contents\s*<[0-9a-fA-F]+>/,
            `/Contents <${paddedSignature}>`
        );

        console.log('✅ Firma insertada correctamente (ByteRange sin cambios)');

        return this.stringToUint8Array(pdfString);
    }

    /**
     * Inserta la firma en el PDF (DEPRECATED - usar insertSignatureOnly)
     */
    insertSignature(pdfBytes, signatureHex, byteRange) {
        console.log('📥 Insertando firma en PDF...');

        let pdfString = this.uint8ArrayToString(pdfBytes);

        // Validar que la firma quepa en el placeholder
        const placeholderMatch = pdfString.match(/\/Contents\s*<([0-9a-fA-F]+)>/);
        if (placeholderMatch) {
            const placeholderSize = placeholderMatch[1].length;
            console.log(`   Tamaño placeholder: ${placeholderSize} caracteres`);
            console.log(`   Tamaño firma: ${signatureHex.length} caracteres`);

            if (signatureHex.length > placeholderSize) {
                throw new Error(`Firma demasiado grande: ${signatureHex.length} > ${placeholderSize}`);
            }

            // Rellenar con ceros si la firma es más pequeña
            const paddedSignature = signatureHex.padEnd(placeholderSize, '0');
            console.log(`   Firma con padding: ${paddedSignature.length} caracteres`);

            // Actualizar ByteRange
            const byteRangeStr = `[${byteRange.map(n => String(n).padStart(10, '0')).join(' ')}]`;
            console.log(`   ByteRange final: ${byteRangeStr}`);

            pdfString = pdfString.replace(
                /\/ByteRange\s*\[[^\]]*\]/,
                `/ByteRange ${byteRangeStr}`
            );

            // Insertar firma con padding en /Contents
            pdfString = pdfString.replace(
                /\/Contents\s*<[0-9a-fA-F]+>/,
                `/Contents <${paddedSignature}>`
            );

            console.log('✅ Firma y ByteRange insertados correctamente');
        } else {
            throw new Error('No se encontró placeholder de /Contents para insertar firma');
        }

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
