import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import signatureRoutes from './routes/signatureRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Rutas de API
app.use('/api', signatureRoutes);

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: err.message || 'Error interno del servidor'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        🔐  Firma Electrónica México                      ║
║                                                           ║
║        Servidor iniciado en puerto ${PORT}                   ║
║        http://localhost:${PORT}                              ║
║                                                           ║
║        Características:                                   ║
║        ✓ Soporte e.firma SAT (.cer + .key)              ║
║        ✓ Soporte certificados PFX                        ║
║        ✓ Firma visible e invisible                       ║
║        ✓ Validación de firmas                            ║
║        ✓ Certificación de documentos                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
