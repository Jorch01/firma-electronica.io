# 🔐 Firma Electrónica México

Aplicación web completa para firma electrónica de documentos PDF compatible con **e.firma del SAT** y **certificados PFX** del Poder Judicial de la Federación y otras autoridades certificadoras.

## ✨ Características

### Compatibilidad de Certificados
- ✅ **e.firma SAT** (archivos .cer + .key con contraseña)
- ✅ **Certificados PFX/PKCS#12** (.pfx, .p12 del Poder Judicial y otros)

### Funcionalidades de Firma
- 🖊️ **Firma visible** con selección de posición y página
- 👁️ **Firma invisible** (solo firma digital)
- 📄 **Múltiples niveles de certificación**:
  - No certificado (permite modificaciones posteriores)
  - Certificado sin cambios permitidos
  - Certificado con llenado de formularios permitido
  - Certificado con anotaciones permitidas
- ⏰ **Timestamp** (marca de tiempo)
- 📝 **Metadatos personalizables** (motivo, ubicación, contacto)

### Validación y Seguridad
- ✓ **Validación de firmas existentes**
- 🔒 **Verificación de integridad** (hash SHA-256)
- 📊 **Extracción de información del PDF**
- 🔍 **Inspección de certificados**

### Interfaz de Usuario
- 🎨 **Diseño moderno y responsive**
- 📱 **Compatible con móviles y tablets**
- 🖱️ **Drag & drop** para archivos
- ⚡ **Interfaz intuitiva y fácil de usar**

## 🚀 Instalación

### Requisitos Previos
- Node.js 18 o superior
- npm o yarn

### Pasos de Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/Jorch01/firma-electronica.io.git
cd firma-electronica.io
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Iniciar el servidor**
```bash
npm start
```

Para desarrollo con hot-reload:
```bash
npm run dev
```

4. **Abrir en el navegador**
```
http://localhost:3000
```

## 📖 Uso

### 1. Firmar un Documento

#### Con e.firma SAT:
1. Selecciona "e.firma SAT (.cer + .key)"
2. Carga tu archivo `.cer`
3. Carga tu archivo `.key`
4. Ingresa la contraseña de tu e.firma
5. Arrastra o selecciona el PDF a firmar
6. Configura las opciones de firma:
   - Firma visible/invisible
   - Posición en el documento (X, Y, página)
   - Motivo y ubicación
   - Nivel de certificación
7. Haz clic en "Firmar Documento"
8. Descarga tu PDF firmado

#### Con Certificado PFX:
1. Selecciona "Certificado PFX/P12"
2. Carga tu archivo `.pfx` o `.p12`
3. Ingresa la contraseña del certificado
4. Sigue los pasos 5-8 anteriores

### 2. Validar Firmas

1. Ve a la pestaña "Validar Firmas"
2. Arrastra o selecciona el PDF firmado
3. Haz clic en "Validar Firmas"
4. Revisa el reporte de validación que incluye:
   - Estado de cada firma (válida/inválida)
   - Información del firmante
   - Fecha de firma
   - Hash de integridad
   - Metadatos del documento

### 3. Información del PDF

1. Ve a la pestaña "Información PDF"
2. Arrastra o selecciona el PDF
3. Haz clic en "Obtener Información"
4. Revisa los metadatos del documento:
   - Número de páginas
   - Título, autor, asunto
   - Fechas de creación y modificación
   - Productor y creador

## 🔧 Configuración

### Variables de Entorno

Crea un archivo `.env` (opcional):

```env
PORT=3000
NODE_ENV=production
```

### Configuración del Servidor

Edita `server/index.js` para ajustar:
- Puerto del servidor
- Límites de tamaño de archivo
- Configuración de CORS

## 📁 Estructura del Proyecto

```
firma-electronica.io/
├── server/
│   ├── controllers/
│   │   └── signatureController.js    # Controladores de API
│   ├── routes/
│   │   └── signatureRoutes.js        # Rutas de API
│   ├── utils/
│   │   ├── certificateHandler.js     # Manejo de certificados
│   │   └── pdfSigner.js              # Firma de PDFs
│   └── index.js                      # Servidor principal
├── public/
│   ├── css/
│   │   └── styles.css                # Estilos de la aplicación
│   ├── js/
│   │   └── app.js                    # Lógica del frontend
│   ├── assets/                       # Recursos estáticos
│   └── index.html                    # Página principal
├── uploads/                          # Archivos temporales de subida
├── temp/                             # Archivos firmados temporales
├── test-pdfs/                        # PDFs de prueba
├── package.json
├── .gitignore
└── README.md
```

## 🔒 Seguridad

### Buenas Prácticas Implementadas

- ✅ Las contraseñas **nunca se almacenan** en el servidor
- ✅ Los certificados se procesan en memoria y se eliminan inmediatamente
- ✅ Los archivos temporales se eliminan automáticamente después de su uso
- ✅ Validación de tipos de archivo en servidor y cliente
- ✅ Límites de tamaño de archivo (50MB por defecto)
- ✅ CORS configurado para mayor seguridad

### Recomendaciones Adicionales

Para uso en producción:
1. Usar HTTPS/TLS
2. Implementar autenticación de usuarios
3. Agregar rate limiting
4. Usar sesiones seguras
5. Implementar logging y auditoría
6. Configurar un firewall de aplicación web (WAF)

## 🛠️ API REST

### Endpoints Disponibles

#### POST `/api/sign`
Firma un documento PDF

**Body (multipart/form-data):**
- `pdfFile`: Archivo PDF a firmar
- `cerFile`: Archivo .cer (para e.firma)
- `keyFile`: Archivo .key (para e.firma)
- `pfxFile`: Archivo .pfx (para PFX)
- `password`: Contraseña del certificado
- `type`: "EFIRMA_SAT" o "PFX"
- `signatureOptions`: JSON con opciones de firma

**Response:**
```json
{
  "success": true,
  "signatureInfo": { ... },
  "downloadUrl": "/api/download/signed_xxx.pdf"
}
```

#### POST `/api/validate`
Valida las firmas de un PDF

**Body (multipart/form-data):**
- `pdfFile`: Archivo PDF a validar

**Response:**
```json
{
  "success": true,
  "signatures": [ ... ],
  "documentInfo": { ... },
  "isValid": true
}
```

#### POST `/api/pdf-info`
Obtiene información de un PDF

**Body (multipart/form-data):**
- `pdfFile`: Archivo PDF

**Response:**
```json
{
  "success": true,
  "info": {
    "pageCount": 5,
    "title": "...",
    "author": "...",
    ...
  }
}
```

#### GET `/api/download/:filename`
Descarga un archivo firmado

## 🧪 Pruebas

Para probar la aplicación necesitas:
1. Un certificado e.firma del SAT válido (archivos .cer y .key)
2. O un certificado PFX válido (.pfx o .p12)
3. Uno o varios archivos PDF para firmar

Coloca tus PDFs de prueba en la carpeta `test-pdfs/`.

```bash
npm test
```

## 📚 Tecnologías

### Backend
- **Node.js** - Runtime de JavaScript
- **Express** - Framework web
- **pdf-lib** - Manipulación de PDFs
- **node-forge** - Criptografía y certificados digitales
- **multer** - Manejo de archivos multipart

### Frontend
- **HTML5** - Estructura
- **CSS3** - Estilos modernos
- **JavaScript (ES6+)** - Lógica de la aplicación
- **Fetch API** - Comunicación con el servidor

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 👥 Autores

- **Desarrollador Principal** - [Jorch01](https://github.com/Jorch01)

## 🙏 Agradecimientos

- SAT (Servicio de Administración Tributaria) por la especificación de e.firma
- Poder Judicial de la Federación por los estándares de certificados digitales
- Comunidad de código abierto por las librerías utilizadas

## 📞 Soporte

Si encuentras algún problema o tienes alguna pregunta:
- Abre un [Issue](https://github.com/Jorch01/firma-electronica.io/issues)
- Consulta la [documentación](https://github.com/Jorch01/firma-electronica.io/wiki)

## 🔮 Roadmap

Características futuras planeadas:
- [ ] Firma de múltiples documentos en lote
- [ ] Soporte para más formatos de certificados
- [ ] Integración con TSA (Time Stamping Authority)
- [ ] API de validación de certificados en línea
- [ ] Firma de documentos en la nube
- [ ] Modo de firma biométrica
- [ ] Generación de reportes de auditoría
- [ ] Dashboard de administración
- [ ] Autenticación de usuarios
- [ ] Integración con sistemas externos

## ⚖️ Legal

Esta aplicación es una herramienta de software para firma electrónica. Los usuarios son responsables del uso apropiado de sus certificados digitales y del cumplimiento de las leyes y regulaciones aplicables en su jurisdicción.

---

**Hecho con ❤️ en México**
