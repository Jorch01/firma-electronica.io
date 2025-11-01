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
    }

    /**
     * Carga e.firma SAT (archivos .cer + .key)
     */
    async loadEfirmaSAT(cerFile, keyFile, password) {
        try {
            // Leer archivos
            const cerBuffer = await this.readFileAsArrayBuffer(cerFile);
            const keyBuffer = await this.readFileAsArrayBuffer(keyFile);

            // Convertir certificado DER a forge
            const cerBytes = forge.util.createBuffer(new Uint8Array(cerBuffer));
            const asn1Cert = forge.asn1.fromDer(cerBytes);
            this.certificate = forge.pki.certificateFromAsn1(asn1Cert);

            // Descifrar llave privada
            const keyBytes = forge.util.createBuffer(new Uint8Array(keyBuffer));

            try {
                // Intentar como PKCS#8 encriptado
                const asn1Key = forge.asn1.fromDer(keyBytes);
                this.privateKey = forge.pki.decryptRsaPrivateKey(asn1Key, password);

                if (!this.privateKey) {
                    // Intentar como PKCS#5
                    keyBytes.clear();
                    keyBytes.putBytes(new Uint8Array(keyBuffer));
                    const p8 = forge.pki.decryptPrivateKeyInfo(forge.asn1.fromDer(keyBytes), password);
                    this.privateKey = forge.pki.privateKeyFromAsn1(p8);
                }
            } catch (e) {
                throw new Error('Contraseña incorrecta o formato de llave no soportado');
            }

            if (!this.privateKey) {
                throw new Error('No se pudo descifrar la llave privada. Verifique la contraseña.');
            }

            this.type = 'EFIRMA_SAT';
            this.certificateInfo = this.extractCertificateInfo();

            return {
                success: true,
                certificate: this.certificateInfo
            };
        } catch (error) {
            throw new Error(`Error cargando e.firma SAT: ${error.message}`);
        }
    }

    /**
     * Carga certificado PFX/PKCS#12
     */
    async loadPFX(pfxFile, password) {
        try {
            const pfxBuffer = await this.readFileAsArrayBuffer(pfxFile);
            const pfxBytes = forge.util.createBuffer(new Uint8Array(pfxBuffer));

            // Parsear PKCS#12
            const asn1 = forge.asn1.fromDer(pfxBytes);
            const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

            // Extraer certificado
            const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
            const certBag = certBags[forge.pki.oids.certBag];
            if (!certBag || certBag.length === 0) {
                throw new Error('No se encontró certificado en el archivo PFX');
            }
            this.certificate = certBag[0].cert;

            // Extraer llave privada
            const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
            let keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];

            if (!keyBag || keyBag.length === 0) {
                // Intentar con keyBag sin cifrar
                const keyBags2 = p12.getBags({ bagType: forge.pki.oids.keyBag });
                keyBag = keyBags2[forge.pki.oids.keyBag];
            }

            if (!keyBag || keyBag.length === 0) {
                throw new Error('No se encontró llave privada en el archivo PFX');
            }
            this.privateKey = keyBag[0].key;

            this.type = 'PFX';
            this.certificateInfo = this.extractCertificateInfo();

            return {
                success: true,
                certificate: this.certificateInfo
            };
        } catch (error) {
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
     * Limpia los datos del certificado de la memoria
     */
    clear() {
        this.certificate = null;
        this.privateKey = null;
        this.certificateInfo = null;
        this.type = null;
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
