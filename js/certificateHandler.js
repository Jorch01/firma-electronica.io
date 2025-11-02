/**
 * Manejo de Certificados Digitales (e.firma SAT y PFX)
 * Todo el procesamiento se realiza en el navegador
 */

class CertificateHandler {
    constructor() {
        this.certificate = null;
        this.privateKey = null;
        this.certificateInfo = null;
        this.type = null;
        this.lastPassword = null; // Guardar contraseña para firma digital

        // Verificar que forge esté disponible
        if (typeof forge === 'undefined') {
            console.error('❌ ERROR CRÍTICO: node-forge no está cargado. Verifica la conexión a internet y que el CDN esté disponible.');
        } else {
            console.log('✅ CertificateHandler iniciado correctamente. forge versión:', forge.version || 'desconocida');
        }
    }

    /**
     * Carga e.firma SAT (archivos .cer + .key)
     */
    async loadEfirmaSAT(cerFile, keyFile, password) {
        console.log('🔐 loadEfirmaSAT: Iniciando carga de e.firma SAT...');
        console.log('📄 Archivo CER:', cerFile?.name, 'Tamaño:', cerFile?.size, 'bytes');
        console.log('🔑 Archivo KEY:', keyFile?.name, 'Tamaño:', keyFile?.size, 'bytes');
        console.log('🔒 Contraseña proporcionada:', password ? 'Sí (longitud: ' + password.length + ')' : 'No');

        try {
            // Leer archivos
            console.log('📖 Leyendo archivos...');
            const cerBuffer = await this.readFileAsArrayBuffer(cerFile);
            const keyBuffer = await this.readFileAsArrayBuffer(keyFile);
            console.log('✅ Archivos leídos. CER:', cerBuffer.byteLength, 'bytes, KEY:', keyBuffer.byteLength, 'bytes');

            // Convertir certificado DER a forge
            console.log('🔄 Convirtiendo certificado DER a formato forge...');
            const cerBytes = forge.util.createBuffer(new Uint8Array(cerBuffer));
            const asn1Cert = forge.asn1.fromDer(cerBytes);
            this.certificate = forge.pki.certificateFromAsn1(asn1Cert);
            console.log('✅ Certificado convertido exitosamente');

            // Descifrar llave privada
            console.log('🔓 Descifrando llave privada...');
            const keyBytes = forge.util.createBuffer(new Uint8Array(keyBuffer));

            try {
                // Intentar como PKCS#8 encriptado
                console.log('🔄 Intentando descifrar como PKCS#8 encriptado...');
                const asn1Key = forge.asn1.fromDer(keyBytes);
                this.privateKey = forge.pki.decryptRsaPrivateKey(asn1Key, password);

                if (!this.privateKey) {
                    // Intentar como PKCS#5
                    console.log('🔄 PKCS#8 falló, intentando como PKCS#5...');
                    keyBytes.clear();
                    keyBytes.putBytes(new Uint8Array(keyBuffer));
                    const p8 = forge.pki.decryptPrivateKeyInfo(forge.asn1.fromDer(keyBytes), password);
                    this.privateKey = forge.pki.privateKeyFromAsn1(p8);
                }
            } catch (e) {
                console.error('❌ Error al descifrar llave privada:', e.message);
                throw new Error('Contraseña incorrecta o formato de llave no soportado');
            }

            if (!this.privateKey) {
                console.error('❌ No se pudo descifrar la llave privada');
                throw new Error('No se pudo descifrar la llave privada. Verifique la contraseña.');
            }

            console.log('✅ Llave privada descifrada exitosamente');

            this.type = 'EFIRMA_SAT';
            this.lastPassword = password; // Guardar para firma digital
            console.log('📋 Extrayendo información del certificado...');
            this.certificateInfo = this.extractCertificateInfo();
            console.log('✅ e.firma SAT cargada completamente:', this.certificateInfo);

            return {
                success: true,
                certificate: this.certificateInfo
            };
        } catch (error) {
            console.error('❌ Error final en loadEfirmaSAT:', error);
            throw new Error(`Error cargando e.firma SAT: ${error.message}`);
        }
    }

    /**
     * Carga certificado PFX/PKCS#12
     */
    async loadPFX(pfxFile, password) {
        console.log('🔐 loadPFX: Iniciando carga de certificado PFX...');
        console.log('📦 Archivo PFX:', pfxFile?.name, 'Tamaño:', pfxFile?.size, 'bytes');
        console.log('🔒 Contraseña proporcionada:', password ? 'Sí (longitud: ' + password.length + ')' : 'No');

        try {
            console.log('📖 Leyendo archivo PFX...');
            const pfxBuffer = await this.readFileAsArrayBuffer(pfxFile);
            console.log('✅ Archivo leído:', pfxBuffer.byteLength, 'bytes');

            const pfxBytes = forge.util.createBuffer(new Uint8Array(pfxBuffer));

            // Parsear PKCS#12
            console.log('🔄 Parseando PKCS#12...');
            const asn1 = forge.asn1.fromDer(pfxBytes);
            const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
            console.log('✅ PKCS#12 parseado exitosamente');

            // Extraer certificado
            console.log('📜 Extrayendo certificado...');
            const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
            const certBag = certBags[forge.pki.oids.certBag];
            if (!certBag || certBag.length === 0) {
                console.error('❌ No se encontró certificado en el PFX');
                throw new Error('No se encontró certificado en el archivo PFX');
            }
            this.certificate = certBag[0].cert;
            console.log('✅ Certificado extraído');

            // Extraer llave privada
            console.log('🔑 Extrayendo llave privada...');
            const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
            let keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];

            if (!keyBag || keyBag.length === 0) {
                console.log('🔄 No se encontró llave cifrada, intentando con keyBag sin cifrar...');
                const keyBags2 = p12.getBags({ bagType: forge.pki.oids.keyBag });
                keyBag = keyBags2[forge.pki.oids.keyBag];
            }

            if (!keyBag || keyBag.length === 0) {
                console.error('❌ No se encontró llave privada en el PFX');
                throw new Error('No se encontró llave privada en el archivo PFX');
            }
            this.privateKey = keyBag[0].key;
            console.log('✅ Llave privada extraída');

            this.type = 'PFX';
            this.lastPassword = password; // Guardar para firma digital
            console.log('📋 Extrayendo información del certificado...');
            this.certificateInfo = this.extractCertificateInfo();
            console.log('✅ Certificado PFX cargado completamente:', this.certificateInfo);

            return {
                success: true,
                certificate: this.certificateInfo
            };
        } catch (error) {
            console.error('❌ Error en loadPFX:', error);
            if (error.message.includes('Invalid password')) {
                throw new Error('Contraseña incorrecta');
            }
            throw new Error(`Error cargando certificado PFX: ${error.message}`);
        }
    }

    /**
     * Extrae información del certificado
     */
    extractCertificateInfo() {
        if (!this.certificate) return null;

        const subject = {};
        const issuer = {};

        this.certificate.subject.attributes.forEach(attr => {
            subject[attr.shortName || attr.name] = attr.value;
        });

        this.certificate.issuer.attributes.forEach(attr => {
            issuer[attr.shortName || attr.name] = attr.value;
        });

        const now = new Date();
        const isValid = now >= this.certificate.validity.notBefore &&
                       now <= this.certificate.validity.notAfter;

        return {
            subject,
            issuer,
            serialNumber: this.certificate.serialNumber,
            validFrom: this.certificate.validity.notBefore,
            validTo: this.certificate.validity.notAfter,
            isValid,
            type: this.type,
            subjectString: this.certificate.subject.attributes
                .map(attr => `${attr.shortName}=${attr.value}`)
                .join(', '),
            issuerString: this.certificate.issuer.attributes
                .map(attr => `${attr.shortName}=${attr.value}`)
                .join(', ')
        };
    }

    /**
     * Firma datos con la llave privada
     */
    signData(data) {
        if (!this.privateKey) {
            throw new Error('No hay llave privada cargada');
        }

        const md = forge.md.sha256.create();
        md.update(data, 'utf8');

        const signature = this.privateKey.sign(md);
        return forge.util.encode64(signature);
    }

    /**
     * Crea hash SHA-256 de datos
     */
    createHash(data) {
        const md = forge.md.sha256.create();
        if (typeof data === 'string') {
            md.update(data, 'utf8');
        } else {
            md.update(forge.util.binary.raw.encode(new Uint8Array(data)));
        }
        return md.digest().toHex();
    }

    /**
     * Obtiene el certificado en formato PEM
     */
    getCertificatePEM() {
        if (!this.certificate) return null;
        return forge.pki.certificateToPem(this.certificate);
    }

    /**
     * Verifica si el certificado está vigente
     */
    isCertificateValid() {
        if (!this.certificate) return false;
        const now = new Date();
        return now >= this.certificate.validity.notBefore &&
               now <= this.certificate.validity.notAfter;
    }

    /**
     * Obtiene el certificado y clave en formato PKCS#12 (P12) para pdfsign.js
     * Necesario para compatibilidad con Adobe Acrobat
     */
    getPKCS12Bytes(password) {
        console.log('🔐 Generando PKCS#12 para firma Adobe...');

        if (!this.certificate || !this.privateKey) {
            throw new Error('No hay certificado o clave privada cargados');
        }

        try {
            // Crear un nuevo contenedor PKCS#12
            const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
                this.privateKey,
                [this.certificate],
                password,
                {
                    algorithm: '3des', // Algoritmo de encriptación
                    count: 2048, // Iteraciones
                    saltSize: 8 // Tamaño del salt
                }
            );

            // Convertir a DER (formato binario)
            const p12Der = forge.asn1.toDer(p12Asn1).getBytes();

            // Convertir a Uint8Array
            const p12Bytes = new Uint8Array(p12Der.length);
            for (let i = 0; i < p12Der.length; i++) {
                p12Bytes[i] = p12Der.charCodeAt(i);
            }

            console.log('✅ PKCS#12 generado:', p12Bytes.length, 'bytes');

            return p12Bytes;
        } catch (error) {
            console.error('❌ Error generando PKCS#12:', error);
            throw new Error(`Error generando PKCS#12: ${error.message}`);
        }
    }

    /**
     * Limpia los datos del certificado de la memoria
     */
    clear() {
        this.certificate = null;
        this.privateKey = null;
        this.certificateInfo = null;
        this.type = null;
        this.lastPassword = null; // Limpiar contraseña
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
     * Obtiene información resumida para mostrar
     */
    getSummary() {
        if (!this.certificateInfo) return null;

        const { subject, validFrom, validTo, isValid, type } = this.certificateInfo;

        return {
            name: subject.CN || subject.name || 'Desconocido',
            organization: subject.O || subject.organizationName || 'N/A',
            email: subject.emailAddress || 'N/A',
            validFrom: validFrom.toLocaleDateString('es-MX'),
            validTo: validTo.toLocaleDateString('es-MX'),
            isValid,
            type,
            daysRemaining: Math.ceil((validTo - new Date()) / (1000 * 60 * 60 * 24))
        };
    }
}

// Instancia global
window.certHandler = new CertificateHandler();
