# 🚀 CÓMO USAR - LÉEME PRIMERO

## ⚠️ IMPORTANTE: El sitio se ve igual que antes

**Es un problema de CACHÉ del navegador.** Aquí está la solución:

## ✅ SOLUCIÓN RÁPIDA (3 pasos)

### 1️⃣ Abre el archivo de prueba
```
public/test.html
```
Haz doble click en ese archivo para abrirlo en tu navegador.

### 2️⃣ Verifica que funcione
Debe decir:
- ✅ pdf-lib cargado correctamente
- ✅ node-forge cargado correctamente

### 3️⃣ Fuerza la recarga del navegador

**Windows/Linux:**
- Presiona: `Ctrl + Shift + R`

**Mac:**
- Presiona: `Cmd + Shift + R`

---

## 🎯 PARA USAR LA APLICACIÓN

### Método 1: Abrir directamente (más fácil)
```bash
# Doble click en:
public/index.html
```

### Método 2: Con servidor local (recomendado)
```bash
cd public
python -m http.server 8000
```
Luego abre en tu navegador: http://localhost:8000

---

## 🔍 CÓMO SABER SI ES LA VERSIÓN NUEVA

### ✅ Versión Nueva (Correcta)
- Dice: **"Aplicación web 100% en línea - Todo se procesa en tu navegador"**
- Tiene badge: **"Tus certificados y documentos nunca salen de tu computadora"**
- **4 pestañas**: Firmar, Validar, Firma por Lotes, Ayuda
- **Workflow en 3 pasos** con números
- **Visor de PDF integrado**
- **NO necesita** npm install
- **NO tiene** carpeta server/

### ❌ Versión Vieja (Incorrecta - Caché)
- Tiene backend Node.js
- Necesita npm install
- Tiene carpetas: uploads/, temp/, server/
- NO dice "100% en línea"

---

## 🛠️ SI SIGUE SIN FUNCIONAR

### 1. Limpiar caché completamente

**Chrome/Edge:**
1. Presiona `F12`
2. Click derecho en el botón "Recargar" del navegador
3. Selecciona: **"Vaciar caché y volver a cargar de manera forzada"**

**Firefox:**
1. Presiona `Ctrl + Shift + Delete`
2. Marca solo "Caché"
3. Click "Limpiar ahora"

### 2. Usar modo incógnito
- Chrome/Edge: `Ctrl + Shift + N`
- Firefox: `Ctrl + Shift + P`

### 3. Cerrar TODO y empezar de nuevo
1. Cierra TODAS las pestañas del navegador
2. Cierra el navegador completamente
3. Abre el navegador de nuevo
4. Abre `public/test.html`
5. Luego abre `public/index.html`

---

## 📁 ESTRUCTURA CORRECTA

```
firma-electronica.io/
├── public/              ← TODO ESTÁ AQUÍ
│   ├── index.html      ← APLICACIÓN PRINCIPAL
│   ├── test.html       ← PRUEBA
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── app.js
│       ├── certificateHandler.js
│       ├── pdfSigner.js
│       ├── pdfValidator.js
│       └── pdfViewer.js
├── README.md
└── LICENSE
```

**NO HAY:**
- ❌ node_modules/
- ❌ package.json
- ❌ server/
- ❌ uploads/
- ❌ temp/

---

## 🎓 FLUJO DE USO

1. **Abrir**: `public/index.html` (con Ctrl+Shift+R para forzar recarga)
2. **Paso 1**: Cargar certificado (e.firma SAT o PFX)
3. **Paso 2**: Cargar PDF
4. **Paso 3**: Configurar y firmar
5. **Resultado**: PDF firmado se descarga automáticamente

---

## 💡 TIPS

- **No necesitas internet** después de cargar la página por primera vez
- **Tus archivos NO se suben** a ningún servidor - todo es local
- **Funciona en**: Chrome, Firefox, Edge, Safari
- **Es seguro**: Todo ocurre en tu navegador

---

## ❓ PREGUNTAS COMUNES

**P: ¿Por qué se ve igual que antes?**
R: Caché del navegador. Presiona `Ctrl+Shift+R` para forzar recarga.

**P: ¿Necesito instalar algo?**
R: NO. Solo abre el archivo HTML en tu navegador.

**P: ¿Dónde está la aplicación?**
R: En `public/index.html`

**P: ¿Es seguro?**
R: Sí, 100% local. Nada se envía a servidores.

**P: ¿Puedo usar sin internet?**
R: Sí, después de la primera carga.

---

## 🆘 AYUDA

Si después de todo esto sigue sin funcionar:

1. Abre la consola del navegador (`F12`)
2. Ve a la pestaña "Console"
3. Copia cualquier mensaje de error (líneas rojas)
4. Repórtalo en GitHub Issues

---

**¡Ahora sí, a firmar documentos! 🎉**
