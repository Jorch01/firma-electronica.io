# Guía de Inicio Rápido

## Instalación Express (5 minutos)

### 1. Instalar dependencias
```bash
npm install
```

### 2. Iniciar el servidor
```bash
npm start
```

### 3. Abrir en el navegador
```
http://localhost:3000
```

## Prueba Rápida

### Opción 1: Con e.firma SAT

1. Ve a la pestaña "Firmar Documento"
2. Selecciona "e.firma SAT (.cer + .key)"
3. Carga tus archivos:
   - `certificado.cer`
   - `clave.key`
4. Ingresa tu contraseña
5. Arrastra un PDF
6. Click en "Firmar Documento"
7. Descarga el PDF firmado

### Opción 2: Con certificado PFX

1. Ve a la pestaña "Firmar Documento"
2. Selecciona "Certificado PFX/P12"
3. Carga tu archivo `.pfx`
4. Ingresa tu contraseña
5. Arrastra un PDF
6. Click en "Firmar Documento"
7. Descarga el PDF firmado

## Validar un PDF firmado

1. Ve a la pestaña "Validar Firmas"
2. Arrastra el PDF firmado
3. Click en "Validar Firmas"
4. Revisa el reporte de validación

## Comandos Útiles

```bash
# Desarrollo con auto-reload
npm run dev

# Verificar vulnerabilidades
npm audit

# Ver estructura del proyecto
tree -I node_modules

# Ver logs del servidor
npm start | tee server.log
```

## Solución de Problemas Comunes

### Error: "Cannot find module"
```bash
npm install
```

### Error: "Port 3000 already in use"
Cambia el puerto en `.env` o usa:
```bash
PORT=3001 npm start
```

### Error: "Invalid certificate password"
- Verifica que la contraseña sea correcta
- Asegúrate de que los archivos .cer y .key correspondan al mismo certificado

### Error: "File too large"
Aumenta el límite en `server/index.js`:
```javascript
app.use(express.json({ limit: '100mb' }));
```

## Estructura Mínima para Desarrollo

```
firma-electronica.io/
├── server/          # Backend
├── public/          # Frontend
├── uploads/         # Archivos temporales
└── package.json     # Dependencias
```

## Tips de Desarrollo

1. **Hot Reload**: Usa `npm run dev` para auto-recargar en cambios
2. **Debug**: Agrega `console.log()` en los controllers
3. **Testing**: Usa Postman o curl para probar la API
4. **Frontend**: Los cambios en `public/` se ven inmediatamente

## Ejemplos de Uso de la API

### Firmar un PDF (curl)

```bash
curl -X POST http://localhost:3000/api/sign \
  -F "pdfFile=@documento.pdf" \
  -F "cerFile=@certificado.cer" \
  -F "keyFile=@clave.key" \
  -F "password=tu_password" \
  -F "type=EFIRMA_SAT" \
  -F 'signatureOptions={"visible":true,"page":0,"position":{"x":50,"y":50}}'
```

### Validar firmas (curl)

```bash
curl -X POST http://localhost:3000/api/validate \
  -F "pdfFile=@documento_firmado.pdf"
```

## Recursos Adicionales

- [Documentación completa](README.md)
- [Seguridad](SECURITY.md)
- [Licencia](LICENSE)

## Contacto

¿Problemas? Abre un [Issue en GitHub](https://github.com/Jorch01/firma-electronica.io/issues)

---

**¡Listo para firmar documentos! 🚀**
