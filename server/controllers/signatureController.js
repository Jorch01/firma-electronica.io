import { loadCertificateFromBuffers, getCertificateInfo } from '../utils/certificateHandler.js';
import { signPDF, validatePDFSignatures, extractSignatureInfo, addTimestamp } from '../utils/pdfSigner.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Carga y valida certificado
 */
export async function loadCertificate(req, res) {
  try {
    const { password, type = 'EFIRMA_SAT' } = req.body;
    const files = req.files;

    if (!password) {
      return res.status(400).json({ error: 'Se requiere la contraseña del certificado' });
    }

    let certData;

    if (type === 'PFX') {
      // Para PFX solo se necesita un archivo
      if (!files.pfxFile || files.pfxFile.length === 0) {
        return res.status(400).json({ error: 'Se requiere el archivo PFX' });
      }

      const pfxBuffer = await fs.readFile(files.pfxFile[0].path);
      certData = await loadCertificateFromBuffers(pfxBuffer, null, password, 'PFX');

      // Limpiar archivo temporal
      await fs.unlink(files.pfxFile[0].path);
    } else {
      // Para e.firma SAT se necesitan .cer y .key
      if (!files.cerFile || files.cerFile.length === 0 || !files.keyFile || files.keyFile.length === 0) {
        return res.status(400).json({ error: 'Se requieren ambos archivos: .cer y .key' });
      }

      const cerBuffer = await fs.readFile(files.cerFile[0].path);
      const keyBuffer = await fs.readFile(files.keyFile[0].path);

      certData = await loadCertificateFromBuffers(cerBuffer, keyBuffer, password, 'EFIRMA_SAT');

      // Limpiar archivos temporales
      await fs.unlink(files.cerFile[0].path);
      await fs.unlink(files.keyFile[0].path);
    }

    const certInfo = getCertificateInfo(certData);

    // Guardar datos del certificado en sesión (en producción usar sesiones seguras)
    // Por simplicidad, retornamos un token temporal
    const sessionToken = Buffer.from(JSON.stringify({
      timestamp: Date.now(),
      serialNumber: certData.serialNumber
    })).toString('base64');

    res.json({
      success: true,
      certificate: certInfo,
      sessionToken,
      message: 'Certificado cargado exitosamente'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

/**
 * Firma un documento PDF
 */
export async function signDocument(req, res) {
  try {
    const { password, type = 'EFIRMA_SAT', signatureOptions } = req.body;
    const files = req.files;

    if (!password) {
      return res.status(400).json({ error: 'Se requiere la contraseña del certificado' });
    }

    if (!files.pdfFile || files.pdfFile.length === 0) {
      return res.status(400).json({ error: 'Se requiere el archivo PDF a firmar' });
    }

    // Cargar certificado
    let certData;
    if (type === 'PFX') {
      if (!files.pfxFile || files.pfxFile.length === 0) {
        return res.status(400).json({ error: 'Se requiere el archivo PFX' });
      }
      const pfxBuffer = await fs.readFile(files.pfxFile[0].path);
      certData = await loadCertificateFromBuffers(pfxBuffer, null, password, 'PFX');
      await fs.unlink(files.pfxFile[0].path);
    } else {
      if (!files.cerFile || files.cerFile.length === 0 || !files.keyFile || files.keyFile.length === 0) {
        return res.status(400).json({ error: 'Se requieren ambos archivos: .cer y .key' });
      }
      const cerBuffer = await fs.readFile(files.cerFile[0].path);
      const keyBuffer = await fs.readFile(files.keyFile[0].path);
      certData = await loadCertificateFromBuffers(cerBuffer, keyBuffer, password, 'EFIRMA_SAT');
      await fs.unlink(files.cerFile[0].path);
      await fs.unlink(files.keyFile[0].path);
    }

    // Parsear opciones de firma
    const options = signatureOptions ? JSON.parse(signatureOptions) : {};

    // Agregar timestamp si se solicita
    if (options.includeTimestamp) {
      options.timestamp = addTimestamp();
    }

    // Firmar PDF
    const pdfPath = files.pdfFile[0].path;
    const result = await signPDF(pdfPath, certData, options);

    // Guardar PDF firmado temporalmente
    const signedFileName = `signed_${Date.now()}_${files.pdfFile[0].originalname}`;
    const signedFilePath = path.join(__dirname, '../../temp', signedFileName);
    await fs.writeFile(signedFilePath, result.signedPdf);

    // Limpiar archivo original
    await fs.unlink(pdfPath);

    res.json({
      success: true,
      signatureInfo: result.signatureInfo,
      downloadUrl: `/download/${signedFileName}`,
      message: 'Documento firmado exitosamente'
    });
  } catch (error) {
    // Limpiar archivos en caso de error
    try {
      if (req.files) {
        for (const fileArray of Object.values(req.files)) {
          for (const file of fileArray) {
            await fs.unlink(file.path).catch(() => {});
          }
        }
      }
    } catch (e) {}

    res.status(400).json({ error: error.message });
  }
}

/**
 * Valida firmas de un PDF
 */
export async function validateDocument(req, res) {
  try {
    const files = req.files;

    if (!files.pdfFile || files.pdfFile.length === 0) {
      return res.status(400).json({ error: 'Se requiere el archivo PDF a validar' });
    }

    const pdfPath = files.pdfFile[0].path;

    // Validar firmas
    const signatures = await validatePDFSignatures(pdfPath);

    // Extraer información adicional
    const pdfInfo = await extractSignatureInfo(pdfPath);

    // Limpiar archivo temporal
    await fs.unlink(pdfPath);

    res.json({
      success: true,
      signatures,
      documentInfo: pdfInfo,
      isValid: signatures.some(sig => sig.valid),
      message: signatures.some(sig => sig.valid)
        ? 'El documento contiene firmas válidas'
        : 'No se encontraron firmas válidas'
    });
  } catch (error) {
    // Limpiar archivo en caso de error
    try {
      if (req.files && req.files.pdfFile && req.files.pdfFile[0]) {
        await fs.unlink(req.files.pdfFile[0].path).catch(() => {});
      }
    } catch (e) {}

    res.status(400).json({ error: error.message });
  }
}

/**
 * Extrae información de un PDF
 */
export async function getPDFInfo(req, res) {
  try {
    const files = req.files;

    if (!files.pdfFile || files.pdfFile.length === 0) {
      return res.status(400).json({ error: 'Se requiere el archivo PDF' });
    }

    const pdfPath = files.pdfFile[0].path;
    const pdfInfo = await extractSignatureInfo(pdfPath);

    // Limpiar archivo temporal
    await fs.unlink(pdfPath);

    res.json({
      success: true,
      info: pdfInfo
    });
  } catch (error) {
    try {
      if (req.files && req.files.pdfFile && req.files.pdfFile[0]) {
        await fs.unlink(req.files.pdfFile[0].path).catch(() => {});
      }
    } catch (e) {}

    res.status(400).json({ error: error.message });
  }
}

/**
 * Descarga un archivo firmado
 */
export async function downloadSignedFile(req, res) {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../temp', filename);

    // Verificar que el archivo existe
    await fs.access(filePath);

    res.download(filePath, filename, async (err) => {
      if (err) {
        console.error('Error descargando archivo:', err);
      }
      // Limpiar archivo después de descargar
      try {
        await fs.unlink(filePath);
      } catch (e) {
        console.error('Error limpiando archivo temporal:', e);
      }
    });
  } catch (error) {
    res.status(404).json({ error: 'Archivo no encontrado' });
  }
}
