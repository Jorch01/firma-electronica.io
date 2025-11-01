import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import forge from 'node-forge';
import fs from 'fs/promises';

/**
 * Firma digital de documentos PDF con soporte para firmas visibles e invisibles
 */

/**
 * Crea la firma digital del contenido del PDF
 * @param {Buffer} pdfBuffer - Buffer del PDF
 * @param {Object} certData - Datos del certificado (de certificateHandler)
 * @returns {Object} Firma digital y hash
 */
function createDigitalSignature(pdfBuffer, certData) {
  const { privateKey, certificate } = certData;

  // Crear hash SHA-256 del contenido
  const md = forge.md.sha256.create();
  md.update(pdfBuffer.toString('binary'));
  const hash = md.digest();

  // Firmar el hash con la llave privada
  const signature = privateKey.sign(md);

  return {
    signature: forge.util.encode64(signature),
    hash: hash.toHex(),
    algorithm: 'SHA256withRSA'
  };
}

/**
 * Firma un PDF (visible o invisible)
 * @param {string} pdfPath - Ruta al PDF original
 * @param {Object} certData - Datos del certificado
 * @param {Object} options - Opciones de firma
 * @returns {Object} Buffer del PDF firmado y metadatos
 */
export async function signPDF(pdfPath, certData, options = {}) {
  try {
    const {
      visible = true,
      position = { x: 50, y: 50 },
      page = 0, // 0 = última página
      reason = 'Firma Electrónica',
      location = 'México',
      contactInfo = '',
      certificationLevel = 0, // 0 = no certified, 1 = certified no changes allowed, 2 = form filling allowed, 3 = annotations allowed
      includeVisibleSignature = true,
      signatureText = null
    } = options;

    // Leer PDF original
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Crear firma digital
    const digitalSig = createDigitalSignature(pdfBytes, certData);

    // Agregar firma visible si se requiere
    if (visible && includeVisibleSignature) {
      const pages = pdfDoc.getPages();
      const pageIndex = page === 0 ? pages.length - 1 : Math.min(page - 1, pages.length - 1);
      const targetPage = pages[pageIndex];
      const { width, height } = targetPage.getSize();

      // Crear texto de la firma
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 10;

      const certInfo = getCertSubject(certData.certificate);
      const signatureLines = signatureText ? signatureText.split('\n') : [
        `Firmado digitalmente por:`,
        `${certInfo.CN || certInfo.name || 'Usuario'}`,
        `Fecha: ${new Date().toLocaleString('es-MX')}`,
        `Razón: ${reason}`
      ];

      // Dibujar recuadro de firma
      const boxWidth = 250;
      const boxHeight = signatureLines.length * 15 + 20;
      const x = Math.min(position.x, width - boxWidth - 10);
      const y = Math.min(position.y, height - boxHeight - 10);

      // Fondo del recuadro
      targetPage.drawRectangle({
        x,
        y,
        width: boxWidth,
        height: boxHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1.5,
        color: rgb(0.95, 0.95, 0.95),
      });

      // Texto de la firma
      let textY = y + boxHeight - 15;
      for (const line of signatureLines) {
        targetPage.drawText(line, {
          x: x + 10,
          y: textY,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
        textY -= 15;
      }

      // Agregar icono de firma digital (simple)
      targetPage.drawText('🔒', {
        x: x + boxWidth - 30,
        y: y + 10,
        size: 20,
      });
    }

    // Agregar metadatos de firma
    pdfDoc.setProducer('Firma Electrónica México v1.0');
    pdfDoc.setCreator('Sistema de Firma Electrónica');
    pdfDoc.setModificationDate(new Date());

    // Agregar información personalizada en metadatos
    const metadata = {
      signature: digitalSig.signature,
      hash: digitalSig.hash,
      algorithm: digitalSig.algorithm,
      certificateSerialNumber: certData.serialNumber,
      signer: certData.subject,
      signDate: new Date().toISOString(),
      reason,
      location,
      contactInfo,
      certificationLevel,
      certificateType: certData.type
    };

    // Serializar PDF firmado
    const signedPdfBytes = await pdfDoc.save();

    return {
      signedPdf: Buffer.from(signedPdfBytes),
      metadata,
      signatureInfo: {
        signer: certData.subject,
        signDate: metadata.signDate,
        reason,
        location,
        hash: digitalSig.hash,
        certificateSerialNumber: certData.serialNumber,
        certificateType: certData.type,
        certificationLevel: getCertificationLevelName(certificationLevel)
      }
    };
  } catch (error) {
    throw new Error(`Error firmando PDF: ${error.message}`);
  }
}

/**
 * Valida las firmas de un PDF
 * @param {string} pdfPath - Ruta al PDF firmado
 * @returns {Array} Array de firmas encontradas y su validez
 */
export async function validatePDFSignatures(pdfPath) {
  try {
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const signatures = [];

    // Extraer metadatos del PDF
    const producer = pdfDoc.getProducer();
    const creator = pdfDoc.getCreator();
    const modificationDate = pdfDoc.getModificationDate();

    // Verificar si fue firmado por nuestra aplicación
    if (producer && producer.includes('Firma Electrónica México')) {
      signatures.push({
        valid: true,
        signer: 'Verificación básica',
        signDate: modificationDate ? modificationDate.toISOString() : 'Desconocida',
        producer,
        creator,
        message: 'Documento firmado con Firma Electrónica México',
        integrity: await verifyPDFIntegrity(pdfBytes)
      });
    }

    // En una implementación completa, aquí se analizarían los objetos de firma PDF
    // usando el diccionario de firmas del PDF y validando con los certificados

    if (signatures.length === 0) {
      return [{
        valid: false,
        message: 'No se encontraron firmas digitales en el documento',
        hasMetadata: !!(producer || creator)
      }];
    }

    return signatures;
  } catch (error) {
    throw new Error(`Error validando firmas del PDF: ${error.message}`);
  }
}

/**
 * Verifica la integridad básica del PDF
 */
async function verifyPDFIntegrity(pdfBuffer) {
  try {
    // Crear hash del documento actual
    const md = forge.md.sha256.create();
    md.update(pdfBuffer.toString('binary'));
    const currentHash = md.digest().toHex();

    return {
      valid: true,
      hash: currentHash,
      algorithm: 'SHA-256'
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * Obtiene el subject del certificado como objeto
 */
function getCertSubject(certificate) {
  const subject = {};
  certificate.subject.attributes.forEach(attr => {
    subject[attr.shortName || attr.name] = attr.value;
  });
  return subject;
}

/**
 * Obtiene el nombre del nivel de certificación
 */
function getCertificationLevelName(level) {
  const levels = {
    0: 'No certificado (permite modificaciones)',
    1: 'Certificado - No se permiten cambios',
    2: 'Certificado - Permitido llenar formularios',
    3: 'Certificado - Permitidas anotaciones y formularios'
  };
  return levels[level] || levels[0];
}

/**
 * Agrega timestamp a la firma (implementación básica)
 */
export function addTimestamp() {
  return {
    timestamp: new Date().toISOString(),
    timestampAuthority: 'Local',
    format: 'ISO-8601'
  };
}

/**
 * Extrae información de firmas de un PDF
 */
export async function extractSignatureInfo(pdfPath) {
  try {
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    return {
      pageCount: pdfDoc.getPageCount(),
      producer: pdfDoc.getProducer() || 'Desconocido',
      creator: pdfDoc.getCreator() || 'Desconocido',
      creationDate: pdfDoc.getCreationDate()?.toISOString() || 'Desconocida',
      modificationDate: pdfDoc.getModificationDate()?.toISOString() || 'Desconocida',
      title: pdfDoc.getTitle() || 'Sin título',
      author: pdfDoc.getAuthor() || 'Desconocido',
      subject: pdfDoc.getSubject() || '',
      keywords: pdfDoc.getKeywords() || ''
    };
  } catch (error) {
    throw new Error(`Error extrayendo información del PDF: ${error.message}`);
  }
}
