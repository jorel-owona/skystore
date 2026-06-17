/**
 * make-ico.js - Convertit logoSky.png en logoSkyStore.ico
 * Utilise le module 'png-to-ico' si disponible, sinon copie le PNG.
 */
const fs = require('fs');
const path = require('path');

const srcPng = path.join(__dirname, '../asset/logoSky.png');
const destIco = path.join(__dirname, '../asset/logoSkyStore.ico');

// electron-builder accepte aussi les PNG directement, mais l'ICO est préféré sous Windows
// On utilise une approche manuelle : créer un ICO minimal qui encapsule le PNG
// (format ICO = header + image PNG embedded)

async function pngToIco(pngPath, icoPath) {
  const pngData = fs.readFileSync(pngPath);

  // Taille de l'image PNG brute
  const dataSize = pngData.length;

  // En-tête ICO :
  // - 6 bytes : ICONDIR (reserved=0, type=1, count=1)
  // - 16 bytes : ICONDIRENTRY (width, height, colorCount, reserved, planes, bitCount, size, offset)
  const headerSize = 6;
  const entrySize = 16;
  const imageOffset = headerSize + entrySize; // 22

  const buf = Buffer.alloc(imageOffset + dataSize);

  // ICONDIR
  buf.writeUInt16LE(0, 0);       // reserved
  buf.writeUInt16LE(1, 2);       // type = 1 (icon)
  buf.writeUInt16LE(1, 4);       // count = 1 image

  // ICONDIRENTRY
  buf.writeUInt8(0, 6);          // width  (0 = 256px)
  buf.writeUInt8(0, 7);          // height (0 = 256px)
  buf.writeUInt8(0, 8);          // color count (0 = no palette)
  buf.writeUInt8(0, 9);          // reserved
  buf.writeUInt16LE(1, 10);      // planes
  buf.writeUInt16LE(32, 12);     // bit count
  buf.writeUInt32LE(dataSize, 14); // size of image data
  buf.writeUInt32LE(imageOffset, 18); // offset of image data

  // Image data (PNG brut)
  pngData.copy(buf, imageOffset);

  fs.writeFileSync(icoPath, buf);
  console.log('[make-ico] ICO créé avec succès :', icoPath);
}

pngToIco(srcPng, destIco)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[make-ico] Erreur :', err.message);
    // Fallback : copie le PNG en le renommant .ico (fonctionne avec electron-builder)
    fs.copyFileSync(srcPng, destIco);
    console.log('[make-ico] Fallback : PNG copié en tant que .ico');
    process.exit(0);
  });
