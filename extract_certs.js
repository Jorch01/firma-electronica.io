#!/usr/bin/env node

/**
 * Script para extraer certificados de un PDF firmado
 */

const fs = require('fs');
const path = require('path');

// Cargar node-forge desde CDN no funciona en Node.js, así que lo hacemos manualmente
// Este script debe ejecutarse en un navegador o necesitamos node-forge instalado

const pdfPath = process.argv[2] || './docs/test_firmado_adobe.pdf';

console.log('📄 Leyendo PDF:', pdfPath);

try {
    const pdfBytes = fs.readFileSync(pdfPath);
    console.log('✅ PDF leído:', pdfBytes.length, 'bytes');

    // Convertir a string para buscar patrones
    const pdfString = pdfBytes.toString('binary');

    // Buscar firma PKCS#7
    const contentsMatch = pdfString.match(/\/Contents\s*<([0-9a-fA-F]+)>/);

    if (!contentsMatch) {
        console.error('❌ No se encontró firma en el PDF');
        process.exit(1);
    }

    const signatureHex = contentsMatch[1];
    console.log('✅ Firma encontrada:', signatureHex.length, 'caracteres hex');

    // Guardar firma como archivo binario para procesarla externamente
    const sigBytes = Buffer.from(signatureHex, 'hex');
    const sigPath = './signature.p7s';
    fs.writeFileSync(sigPath, sigBytes);
    console.log('✅ Firma guardada en:', sigPath);
    console.log('\n📋 Para extraer certificados, ejecuta:');
    console.log('openssl pkcs7 -inform DER -in signature.p7s -print_certs -out certs.pem');

} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}
