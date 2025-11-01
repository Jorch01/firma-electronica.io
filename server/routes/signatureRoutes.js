import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadCertificate,
  signDocument,
  validateDocument,
  getPDFInfo,
  downloadSignedFile
} from '../controllers/signatureController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    // Validar tipos de archivo
    const allowedTypes = {
      pdfFile: ['.pdf'],
      cerFile: ['.cer'],
      keyFile: ['.key'],
      pfxFile: ['.pfx', '.p12']
    };

    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = allowedTypes[file.fieldname];

    if (allowedExts && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no válido para ${file.fieldname}: ${ext}`));
    }
  }
});

// Rutas
router.post('/load-certificate',
  upload.fields([
    { name: 'cerFile', maxCount: 1 },
    { name: 'keyFile', maxCount: 1 },
    { name: 'pfxFile', maxCount: 1 }
  ]),
  loadCertificate
);

router.post('/sign',
  upload.fields([
    { name: 'pdfFile', maxCount: 1 },
    { name: 'cerFile', maxCount: 1 },
    { name: 'keyFile', maxCount: 1 },
    { name: 'pfxFile', maxCount: 1 }
  ]),
  signDocument
);

router.post('/validate',
  upload.fields([
    { name: 'pdfFile', maxCount: 1 }
  ]),
  validateDocument
);

router.post('/pdf-info',
  upload.fields([
    { name: 'pdfFile', maxCount: 1 }
  ]),
  getPDFInfo
);

router.get('/download/:filename', downloadSignedFile);

export default router;
