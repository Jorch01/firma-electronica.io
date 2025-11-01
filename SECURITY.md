# Política de Seguridad

## Versiones Soportadas

| Versión | Soportada          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reportar una Vulnerabilidad

Si descubres una vulnerabilidad de seguridad en esta aplicación, por favor:

1. **NO** abras un issue público
2. Envía un correo a: [security@firma-electronica.io](mailto:security@firma-electronica.io)
3. Incluye los siguientes detalles:
   - Descripción de la vulnerabilidad
   - Pasos para reproducirla
   - Posible impacto
   - Sugerencias de solución (opcional)

## Mejores Prácticas de Seguridad

### Para Usuarios

1. **Protege tus Certificados**
   - Nunca compartas tus archivos .cer, .key o .pfx
   - Usa contraseñas fuertes para tus certificados
   - Almacena tus certificados en ubicaciones seguras

2. **Uso de la Aplicación**
   - Verifica siempre el hash SHA-256 de documentos importantes
   - No firmes documentos sin leerlos completamente
   - Mantén un registro de los documentos que firmas

3. **Conexión Segura**
   - En producción, usa siempre HTTPS
   - Verifica el certificado SSL del servidor
   - No uses redes WiFi públicas para firmar documentos

### Para Desarrolladores

1. **Manejo de Certificados**
   - Los certificados se procesan solo en memoria
   - Se eliminan inmediatamente después de su uso
   - Nunca se almacenan en disco sin cifrado

2. **Archivos Temporales**
   - Se eliminan automáticamente después de su uso
   - Limpieza periódica de archivos antiguos
   - Nombres de archivo aleatorios para evitar conflictos

3. **Validación de Entrada**
   - Validación estricta de tipos de archivo
   - Límites de tamaño de archivo
   - Sanitización de nombres de archivo

4. **Dependencias**
   - Mantener todas las dependencias actualizadas
   - Revisar regularmente con `npm audit`
   - Usar versiones específicas en producción

## Configuración de Producción

### Recomendaciones Esenciales

1. **Servidor HTTPS**
```bash
# Usar certificado SSL válido
npm install --save express-https-redirect
```

2. **Variables de Entorno**
```bash
NODE_ENV=production
PORT=443
```

3. **Firewall**
- Permitir solo puertos necesarios (80, 443)
- Bloquear acceso directo a archivos temporales

4. **Rate Limiting**
```bash
npm install --save express-rate-limit
```

5. **Helmet.js**
```bash
npm install --save helmet
```

6. **Logs y Monitoreo**
- Implementar logging centralizado
- Monitorear intentos de acceso no autorizados
- Alertas automáticas para actividades sospechosas

## Auditorías de Seguridad

Esta aplicación debe ser auditada regularmente:
- Análisis estático de código
- Pruebas de penetración
- Revisión de dependencias
- Análisis de vulnerabilidades

## Cumplimiento Legal

Los usuarios deben cumplir con:
- Ley de Firma Electrónica Avanzada (México)
- NOM-151-SCFI-2016
- Regulaciones del SAT sobre e.firma
- Políticas del Poder Judicial sobre certificados digitales

## Contacto

Para reportes de seguridad: security@firma-electronica.io
Para soporte general: support@firma-electronica.io

---

Última actualización: 2025-01-01
