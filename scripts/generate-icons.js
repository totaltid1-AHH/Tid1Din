import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, drawFn) {
  // RGBA buffer
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const idatData = zlib.deflateSync(rawData);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcVal = zlib.crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // PNG Signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type 6 = RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', idatData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

// Tegn DinTid-ikon: Himmelblå avrundet bakgrunn med hvit klokke
function drawDinTidIcon(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const rCorner = w * 0.22;

  // Sjekk om innenfor avrundet rektangel
  const dx = Math.abs(x - cx) - (cx - rCorner);
  const dy = Math.abs(y - cy) - (cy - rCorner);
  const distCorner = Math.sqrt(Math.max(0, dx) ** 2 + Math.max(0, dy) ** 2);
  
  if (dx > 0 && dy > 0 && distCorner > rCorner) {
    return [0, 0, 0, 0]; // Transparent utenfor
  }

  // Bakgrunnsgradient: #0284c7 (rgb 2, 132, 199) til #0ea5e9
  const grad = y / h;
  const bgR = Math.round(2 + grad * 12);
  const bgG = Math.round(132 + grad * 33);
  const bgB = Math.round(199 + grad * 34);

  // Klokkesirkel
  const distCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  const clockRadius = w * 0.34;
  const ringWidth = w * 0.045;

  if (Math.abs(distCenter - clockRadius) <= ringWidth / 2) {
    return [255, 255, 255, 255]; // Hvit sirkelring
  }

  // Klokkevisere: Timeviser (opp til kl 12) og Minuttviser (mot kl 3/4)
  const vX = x - cx;
  const vY = y - cy;

  // Timeviser (rett opp, lengde w*0.22, tykkelse w*0.04)
  if (Math.abs(vX) <= ringWidth / 2 && vY <= 0 && vY >= -w * 0.22) {
    return [255, 255, 255, 255];
  }

  // Minuttviser (vinkel ~45 grader ned-høyre)
  // roter 45 grader
  const cos45 = 0.7071;
  const sin45 = 0.7071;
  const rx = vX * cos45 - vY * sin45;
  const ry = vX * sin45 + vY * cos45;
  if (Math.abs(ry) <= ringWidth / 2 && rx >= 0 && rx <= w * 0.22) {
    return [255, 255, 255, 255];
  }

  // Sentrums-prikk
  if (distCenter <= ringWidth * 0.8) {
    return [255, 255, 255, 255];
  }

  return [bgR, bgG, bgB, 255];
}

const outDir = path.resolve('public');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// 1. pwa-192x192.png
const png192 = createPng(192, 192, drawDinTidIcon);
fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), png192);
console.log('Created pwa-192x192.png');

// 2. pwa-512x512.png
const png512 = createPng(512, 512, drawDinTidIcon);
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), png512);
console.log('Created pwa-512x512.png');

// 3. apple-touch-icon.png
const png180 = createPng(180, 180, drawDinTidIcon);
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), png180);
console.log('Created apple-touch-icon.png');
