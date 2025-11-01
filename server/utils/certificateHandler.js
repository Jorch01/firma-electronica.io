import forge from 'node-forge';
import fs from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Manejo de certificados digitales para e.firma SAT y PFX
 */

/**
 * Carga certificado e.firma del SAT (.cer + .key)
 * @param {string} cerPath - Ruta al archivo .cer
 * @param {string} keyPath - Ruta al archivo .key
 * @param {string} password - Contraseña de la llave privada
 * @returns {Object} Objeto con certificado y llave privada
 */
export async function loadEfirmaSAT(cerPath, keyPath, password) {
  try {
    // Leer archivos
    const cerBuffer = await fs.readFile(cerPath);
    const keyBuffer = await fs.readFile(keyPath);

    // Convertir certificado DER a PEM
    const cerBase64 = cerBuffer.toString('base64');
    const cerPem = `-----BEGIN CERTIFICATE-----\n${cerBase64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;

    // Parsear certificado
    const certificate = forge.pki.certificateFromPem(cerPem);

    // Descifrar llave privada (formato DER encriptado)
    let privateKey;
    try {
      // Intentar como PKCS#8 encriptado
      const encryptedKey = forge.util.decode64(keyBuffer.toString('base64'));
      const asn1 = forge.asn1.fromDer(encryptedKey);
      privateKey = forge.pki.decryptRsaPrivateKey(asn1, password);
    } catch (error) {
      // Intentar como PKCS#5 (formato antiguo SAT)
      try {
        const p7 = forge.pkcs7.messageFromPem(
          `-----BEGIN ENCRYPTED PRIVATE KEY-----\n${keyBuffer.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END ENCRYPTED PRIVATE KEY-----`
        );
        privateKey = forge.pki.decryptRsaPrivateKey(p7, password);
      } catch (e) {
        throw new Error('No se pudo descifrar la llave privada. Verifique la contraseña.');
      }
    }

    if (!privateKey) {
      throw new Error('No se pudo descifrar la llave privada. Verifique la contraseña.');
    }

    return {
      certificate,
      privateKey,
      certificatePem: cerPem,
      type: 'EFIRMA_SAT',
      subject: certificate.subject.attributes.map(attr => `${attr.shortName}=${attr.value}`).join(', '),
      issuer: certificate.issuer.attributes.map(attr => `${attr.shortName}=${attr.value}`).join(', '),
      validFrom: certificate.validity.notBefore,
      validTo: certificate.validity.notAfter,
      serialNumber: certificate.serialNumber
    };
  } catch (error) {
    throw new Error(`Error cargando e.firma SAT: ${error.message}`);
  }
}

/**
 * Carga certificado PFX (PKCS#12)
 * @param {string} pfxPath - Ruta al archivo .pfx o .p12
 * @param {string} password - Contraseña del archivo PFX
 * @returns {Object} Objeto con certificado y llave privada
 */
export async function loadPFX(pfxPath, password) {
  try {
    const pfxBuffer = await fs.readFile(pfxPath);
    const pfxBase64 = pfxBuffer.toString('base64');
    const pfxDer = forge.util.decode64(pfxBase64);

    // Parsear PKCS#12
    const p12Asn1 = forge.asn1.fromDer(pfxDer);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    // Extraer certificado y llave privada
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

    const certificate = certBags[forge.pki.oids.certBag]?.[0]?.cert;
    const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;

    if (!certificate || !privateKey) {
      throw new Error('No se encontró certificado o llave privada en el archivo PFX');
    }

    const certificatePem = forge.pki.certificateToPem(certificate);

    return {
      certificate,
      privateKey,
      certificatePem,
      type: 'PFX',
      subject: certificate.subject.attributes.map(attr => `${attr.shortName}=${attr.value}`).join(', '),
      issuer: certificate.issuer.attributes.map(attr => `${attr.shortName}=${attr.value}`).join(', '),
      validFrom: certificate.validity.notBefore,
      validTo: certificate.validity.notAfter,
      serialNumber: certificate.serialNumber
    };
  } catch (error) {
    throw new Error(`Error cargando certificado PFX: ${error.message}`);
  }
}

/**
 * Carga certificado desde Buffer (usado en uploads)
 */
export async function loadCertificateFromBuffers(cerBuffer, keyBuffer, password, type = 'EFIRMA_SAT') {
  if (type === 'PFX') {
    // Para PFX, cerBuffer contiene el archivo completo
    const pfxBase64 = cerBuffer.toString('base64');
    const pfxDer = forge.util.decode64(pfxBase64);
    const p12Asn1 = forge.asn1.fromDer(pfxDer);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

    const certificate = certBags[forge.pki.oids.certBag]?.[0]?.cert;
    const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;

    if (!certificate || !privateKey) {
      throw new Error('No se encontró certificado o llave privada en el archivo PFX');
    }

    return {
      certificate,
      privateKey,
      certificatePem: forge.pki.certificateToPem(certificate),
      type: 'PFX',
      subject: certificate.subject.attributes.map(attr => `${attr.shortName}=${attr.value}`).join(', '),
      issuer: certificate.issuer.attributes.map(attr => `${attr.shortName}=${attr.value}`).join(', '),
      validFrom: certificate.validity.notBefore,
      validTo: certificate.validity.notAfter,
      serialNumber: certificate.serialNumber
    };
  } else {
    // e.firma SAT
    const cerBase64 = cerBuffer.toString('base64');
    const cerPem = `-----BEGIN CERTIFICATE-----\n${cerBase64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;
    const certificate = forge.pki.certificateFromPem(cerPem);

    let privateKey;
    try {
      const encryptedKey = forge.util.decode64(keyBuffer.toString('base64'));
      const asn1 = forge.asn1.fromDer(encryptedKey);
      privateKey = forge.pki.decryptRsaPrivateKey(asn1, password);
    } catch (error) {
      throw new Error('No se pudo descifrar la llave privada. Verifique la contraseña.');
    }

    if (!privateKey) {
      throw new Error('No se pudo descifrar la llave privada.');
    }

    return {
      certificate,
      privateKey,
      certificatePem: cerPem,
      type: 'EFIRMA_SAT',
      subject: certificate.subject.attributes.map(attr => `${attr.shortName}=${attr.value}`).join(', '),
      issuer: certificate.issuer.attributes.map(attr => `${attr.shortName}=${attr.value}`).join(', '),
      validFrom: certificate.validity.notBefore,
      validTo: certificate.validity.notAfter,
      serialNumber: certificate.serialNumber
    };
  }
}

/**
 * Valida si un certificado está vigente
 */
export function isCertificateValid(certificate) {
  const now = new Date();
  return now >= certificate.validity.notBefore && now <= certificate.validity.notAfter;
}

/**
 * Extrae información del certificado
 */
export function getCertificateInfo(certData) {
  const { certificate } = certData;
  const subject = {};
  const issuer = {};

  certificate.subject.attributes.forEach(attr => {
    subject[attr.shortName || attr.name] = attr.value;
  });

  certificate.issuer.attributes.forEach(attr => {
    issuer[attr.shortName || attr.name] = attr.value;
  });

  return {
    subject,
    issuer,
    serialNumber: certificate.serialNumber,
    validFrom: certificate.validity.notBefore,
    validTo: certificate.validity.notAfter,
    isValid: isCertificateValid(certificate),
    type: certData.type
  };
}
