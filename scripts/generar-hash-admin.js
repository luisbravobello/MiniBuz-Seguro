'use strict';

/**
 * Utilidad de Jorge para crear ADMIN_PASSWORD_HASH sin escribir la clave
 * en el codigo, argumentos de linea de comandos o historial de PowerShell.
 * Ejecutar desde la raiz: node scripts/generar-hash-admin.js
 */

const { hashPassword } = require('../auth/password');

function pedirSecreto(mensaje) {
  return new Promise((resolve, reject) => {
    const entrada = process.stdin;
    const salida = process.stdout;
    if (!entrada.isTTY || typeof entrada.setRawMode !== 'function') {
      reject(new Error('Ejecutar en una terminal interactiva (PowerShell/Terminal).'));
      return;
    }

    let valor = '';
    salida.write(mensaje);
    entrada.setEncoding('utf8');
    entrada.setRawMode(true);
    entrada.resume();

    function finalizar(error) {
      entrada.removeListener('data', recibir);
      entrada.setRawMode(false);
      entrada.pause();
      salida.write('\n');
      if (error) reject(error);
      else resolve(valor);
    }

    function recibir(datos) {
      for (const tecla of datos) {
        if (tecla === '\u0003') return finalizar(new Error('Operación cancelada.'));
        if (tecla === '\r' || tecla === '\n') return finalizar(null);
        if (tecla === '\u007f' || tecla === '\b') {
          valor = Array.from(valor).slice(0, -1).join('');
          continue;
        }
        if (tecla >= ' ' && tecla !== '\u001b') valor += tecla;
      }
    }

    entrada.on('data', recibir);
  });
}

async function ejecutar() {
  const secreto = await pedirSecreto('Contrasena administrativa de prueba (no se muestra): ');
  const confirmacion = await pedirSecreto('Repite la contrasena: ');
  if (secreto !== confirmacion) throw new Error('Las contrasenas no coinciden.');
  if (Buffer.byteLength(secreto, 'utf8') < 12) {
    throw new Error('Utiliza al menos 12 bytes para la contrasena de prueba.');
  }
  const hash = await hashPassword(secreto);
  console.log('\nCopia SOLO esta linea en tu archivo .env local:');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log('\nNo compartas la contrasena ni subas .env a Git.');
}

ejecutar().catch(error => {
  console.error('No se genero el hash:', error.message);
  process.exitCode = 1;
});
