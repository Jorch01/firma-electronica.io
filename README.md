# 🔐 Firma Electrónica México - Aplicación Web

**Aplicación web 100% del lado del cliente para firma electrónica de documentos PDF**

Compatible con **e.firma del SAT** y **certificados PFX** del Poder Judicial de la Federación.

---

## ✨ Características Principales

### 🔒 100% Seguro - Todo Ocurre en tu Navegador
- **Sin servidor**: Todo el procesamiento se realiza localmente en tu navegador
- **Privacidad total**: Tus certificados y documentos nunca salen de tu computadora
- **Funciona offline**: Después de cargar la página, puedes desconectar internet

### 📝 Firma Digital Completa
- ✅ **e.firma SAT** (archivos .cer + .key con contraseña)
- ✅ **Certificados PFX/PKCS#12** (.pfx, .p12 del Poder Judicial y otros)
- 🖊️ **Firma visible** con selección interactiva de área en el PDF
- 👁️ **Firma invisible** (solo firma digital sin representación visual)
- ⏰ **Timestamp** (marca de tiempo automática)
- 🔐 **Hash SHA-256** para verificación de integridad

### 🎯 Funciones Avanzadas
- **Visor de PDF integrado**: Visualiza y navega por el documento antes de firmar
- **Selección de área interactiva**: Haz clic y arrastra para posicionar la firma
- **Niveles de certificación**:
  - No certificado (documento abierto a más firmas)
  - Certificado sin cambios permitidos (documento cerrado)
  - Certificado con formularios permitidos
  - Certificado con anotaciones permitidas
- **Firma por lotes**: Firma múltiples documentos a la vez
- **Validación de firmas**: Verifica firmas existentes en PDFs
- **Metadatos personalizables**: Razón, ubicación, información de contacto

### 🎨 Interfaz Moderna
- Diseño responsive (móviles, tablets, escritorio)
- Drag & drop para archivos
- Navegación intuitiva por pestañas
- Feedback visual en tiempo real
- Descarga automática de PDFs firmados

---

## 🚀 Cómo Usar

### 1. Abrir la Aplicación

Simplemente abre `public/index.html` en tu navegador, o despliega en cualquier hosting estático:

```bash
# Con cualquier servidor web estático
cd public
python -m http.server 8000
# Abre http://localhost:8000
```

### 2. Firmar un Documento

#### Paso 1: Cargar Certificado

**Para e.firma SAT:**
1. Selecciona "e.firma SAT"
2. Carga tu archivo `.cer` (certificado)
3. Carga tu archivo `.key` (llave privada)
4. Ingresa tu contraseña
5. Haz clic en "Cargar y Validar Certificado"

**Para Certificado PFX:**
1. Selecciona "Certificado PFX"
2. Carga tu archivo `.pfx` o `.p12`
3. Ingresa tu contraseña
4. Haz clic en "Cargar y Validar Certificado"

#### Paso 2: Cargar PDF
- Arrastra tu PDF o haz clic para seleccionarlo
- El visor de PDF se abrirá automáticamente

#### Paso 3: Configurar y Firmar
- Activa/desactiva firma visible
- Haz clic y arrastra en el PDF para seleccionar dónde colocar la firma
- Configura razón, ubicación y nivel de certificación
- Haz clic en "Firmar Documento Ahora"
- El PDF firmado se descargará automáticamente

### 3. Validar Firmas
1. Ve a la pestaña "Validar Firmas"
2. Arrastra el PDF firmado
3. Haz clic en "Validar Firmas"
4. Revisa el reporte de validación

### 4. Firma por Lotes
1. Carga tu certificado en la pestaña principal
2. Ve a "Firma por Lotes"
3. Selecciona múltiples PDFs
4. Haz clic en "Firmar Todos los Documentos"
5. Todos los PDFs firmados se descargarán automáticamente

---

## 🏗️ Arquitectura

### Tecnologías

**Frontend Puro:**
- HTML5, CSS3, JavaScript (ES6+)
- Sin frameworks pesados - máxima compatibilidad

**Librerías (vía CDN):**
- [pdf-lib](https://pdf-lib.js.org/) - Manipulación de PDFs
- [node-forge](https://github.com/digitalbazaar/forge) - Criptografía y certificados
- [PDF.js](https://mozilla.github.io/pdf.js/) - Visualización de PDFs

### Estructura del Proyecto

```
firma-electronica.io/
├── public/
│   ├── index.html                      # Aplicación principal
│   ├── css/
│   │   └── styles.css                  # Estilos
│   └── js/
│       ├── certificateHandler.js       # Manejo de certificados
│       ├── pdfSigner.js                # Firma de PDFs
│       ├── pdfValidator.js             # Validación de firmas
│       ├── pdfViewer.js                # Visor de PDF
│       └── app.js                      # Lógica principal
├── README.md
├── LICENSE
└── SECURITY.md
```

---

## 🔒 Seguridad

### Principios de Seguridad

✅ **Tu privacidad es lo primero:**
- Contraseñas nunca se almacenan (solo se usan en memoria)
- Certificados se procesan exclusivamente en tu navegador
- Sin comunicación con servidores externos (excepto CDN de librerías)
- Sin cookies, sin tracking, sin analytics

✅ **Código abierto:**
- Todo el código es visible y auditable
- Sin código ofuscado
- Puedes ejecutarlo completamente offline

### Recomendaciones

1. **Verifica siempre** que estás usando la aplicación desde una fuente confiable
2. **Usa conexión segura** (HTTPS) si la despliegas en un servidor
3. **Mantén actualizados** tus certificados digitales
4. **Verifica las firmas** de documentos importantes
5. **Guarda tus certificados** en un lugar seguro

---

## 🌐 Despliegue

### Hosting Estático

Puedes desplegar esta aplicación en cualquier servicio de hosting estático:

**GitHub Pages:**
```bash
# Fork el repositorio y activa GitHub Pages en la rama main
```

**Netlify:**
```bash
# Arrastra la carpeta 'public' a Netlify
```

**Vercel:**
```bash
# Conecta tu repositorio a Vercel
```

**Servidor Web:**
```bash
# Copia la carpeta 'public' a tu servidor web
cp -r public/* /var/www/html/firma-electronica/
```

---

## 📖 Documentación Técnica

### Carga de Certificados

La aplicación soporta dos formatos:

1. **e.firma SAT**: Formato DER separado (.cer + .key)
   - Certificado público en formato DER
   - Llave privada encriptada con contraseña

2. **PFX/PKCS#12**: Formato unificado (.pfx, .p12)
   - Contiene certificado y llave privada juntos
   - Protegido por contraseña

### Proceso de Firma

1. **Carga del PDF**: Se lee el archivo en memoria usando FileReader API
2. **Procesamiento**: pdf-lib manipula el PDF para agregar la firma visual
3. **Firma criptográfica**: node-forge genera el hash SHA-256 y lo firma con la llave privada
4. **Metadatos**: Se agregan metadatos al PDF con información de la firma
5. **Descarga**: El PDF firmado se genera como Blob y se descarga automáticamente

### Validación de Firmas

La aplicación puede validar:
- Firmas realizadas por esta misma aplicación
- Metadatos embebidos en el PDF
- Hash de integridad del documento
- Información del certificado utilizado

---

## 🤝 Contribuir

Las contribuciones son bienvenidas:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

---

## 🙏 Agradecimientos

- **SAT** (Servicio de Administración Tributaria) por el formato e.firma
- **Poder Judicial de la Federación** por los estándares de certificados digitales
- Comunidad open source por las excelentes librerías JavaScript

---

## ❓ FAQ

### ¿Es realmente seguro?
Sí. Todo el procesamiento ocurre en tu navegador. Puedes verificar el código fuente y ejecutarlo offline.

### ¿Funciona sin conexión a internet?
Sí. Después de cargar la página por primera vez (que necesita descargar las librerías), puedes desconectarte y seguir usándola.

### ¿Las firmas son legalmente válidas?
Esta aplicación genera firmas digitales con certificados válidos. Sin embargo, la validez legal depende del contexto y las leyes locales. Consulta con un abogado para tu caso específico.

### ¿Puedo usar esto en mi empresa?
Sí, es open source bajo licencia MIT. Puedes modificarlo y desplegarlo internamente.

### ¿En qué navegadores funciona?
Chrome, Firefox, Edge, Safari y Opera modernos. Se recomienda usar las últimas versiones.

### ¿Guarda mis documentos o certificados?
No. Todo se procesa en memoria y se descarta inmediatamente.

---

## 📞 Soporte

- **Issues**: [GitHub Issues](https://github.com/Jorch01/firma-electronica.io/issues)
- **Documentación**: Este README y comentarios en el código
- **Seguridad**: Ver [SECURITY.md](SECURITY.md)

---

**Hecho con ❤️ para México 🇲🇽**

*Democratizando la firma electrónica, una línea de código a la vez.*
