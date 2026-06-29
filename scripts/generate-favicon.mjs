import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const faviconSvgPath = new URL('../assets/favicon.svg', import.meta.url);
const favicon32Path = new URL('../assets/favicon-32.png', import.meta.url);
const appleTouchIconPath = new URL('../assets/apple-touch-icon.png', import.meta.url);
const faviconIcoPath = new URL('../favicon.ico', import.meta.url);

const palette = {
  bg: [13, 13, 16, 255],
  surface: [24, 26, 32, 255],
  border: [46, 126, 107, 255],
  gold: [246, 197, 93, 255],
  goldDark: [125, 82, 22, 255],
  ink: [17, 18, 22, 255],
  mint: [92, 211, 178, 255],
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="FF14Gils favicon">
  <title>FF14Gils</title>
  <rect width="64" height="64" rx="14" fill="#0d0d10"/>
  <rect x="4" y="4" width="56" height="56" rx="12" fill="#181a20" stroke="#2e7e6b" stroke-width="3"/>
  <circle cx="32" cy="32" r="20" fill="#f6c55d" stroke="#7d5216" stroke-width="4"/>
  <path d="M43 25c-2.7-4.3-7-6.4-12.7-6.4-8 0-14.3 5.9-14.3 13.5 0 7.8 6.3 13.3 14.9 13.3 5.3 0 9.7-1.7 12.9-5.1V31H31v7h5.9c-1.4 1.2-3.5 1.8-6 1.8-5.3 0-8.8-3.1-8.8-7.8 0-4.6 3.5-7.8 8.4-7.8 3.1 0 5.4 1.2 7.2 3.6L43 25Z" fill="#111216"/>
  <circle cx="46" cy="17" r="5" fill="#5cd3b2"/>
</svg>
`;

await writeText(faviconSvgPath, svg);

const favicon32 = createIconPng(32);
const appleTouchIcon = createIconPng(180);
await writeBinary(favicon32Path, favicon32);
await writeBinary(appleTouchIconPath, appleTouchIcon);
await writeBinary(faviconIcoPath, createIco(favicon32));

console.log('Generated favicon.svg, favicon-32.png, apple-touch-icon.png, and favicon.ico');

async function writeText(path, content) {
  await mkdir(dirname(fileURLToPath(path)), { recursive: true });
  await writeFile(path, content, 'utf8');
}

async function writeBinary(path, content) {
  await mkdir(dirname(fileURLToPath(path)), { recursive: true });
  await writeFile(path, content);
}

function createIconPng(size) {
  const pixels = new Uint8Array(size * size * 4);
  const scale = size / 64;

  fillRoundedRect(pixels, size, 0, 0, size, size, 14 * scale, palette.bg);
  fillRoundedRect(
    pixels,
    size,
    4 * scale,
    4 * scale,
    56 * scale,
    56 * scale,
    12 * scale,
    palette.surface,
  );
  strokeRoundedRect(
    pixels,
    size,
    4 * scale,
    4 * scale,
    56 * scale,
    56 * scale,
    12 * scale,
    3 * scale,
    palette.border,
  );
  fillCircle(pixels, size, 32 * scale, 32 * scale, 20 * scale, palette.gold);
  strokeCircle(pixels, size, 32 * scale, 32 * scale, 20 * scale, 4 * scale, palette.goldDark);
  drawPixelGlyphG(pixels, size, 18 * scale, 18 * scale, 4 * scale, palette.ink);
  fillCircle(pixels, size, 46 * scale, 17 * scale, 5 * scale, palette.mint);

  return encodePng(size, size, pixels);
}

function fillRoundedRect(pixels, size, x, y, width, height, radius, color) {
  for (let py = Math.floor(y); py < Math.ceil(y + height); py += 1) {
    for (let px = Math.floor(x); px < Math.ceil(x + width); px += 1) {
      if (isInsideRoundedRect(px + 0.5, py + 0.5, x, y, width, height, radius)) {
        setPixel(pixels, size, px, py, color);
      }
    }
  }
}

function strokeRoundedRect(pixels, size, x, y, width, height, radius, strokeWidth, color) {
  for (let py = Math.floor(y); py < Math.ceil(y + height); py += 1) {
    for (let px = Math.floor(x); px < Math.ceil(x + width); px += 1) {
      const insideOuter = isInsideRoundedRect(px + 0.5, py + 0.5, x, y, width, height, radius);
      const insideInner = isInsideRoundedRect(
        px + 0.5,
        py + 0.5,
        x + strokeWidth,
        y + strokeWidth,
        width - strokeWidth * 2,
        height - strokeWidth * 2,
        Math.max(radius - strokeWidth, 0),
      );
      if (insideOuter && !insideInner) {
        setPixel(pixels, size, px, py, color);
      }
    }
  }
}

function isInsideRoundedRect(px, py, x, y, width, height, radius) {
  const left = x + radius;
  const right = x + width - radius;
  const top = y + radius;
  const bottom = y + height - radius;
  const nearestX = Math.max(left, Math.min(px, right));
  const nearestY = Math.max(top, Math.min(py, bottom));
  const dx = px - nearestX;
  const dy = py - nearestY;

  return (
    px >= x &&
    px <= x + width &&
    py >= y &&
    py <= y + height &&
    dx * dx + dy * dy <= radius * radius
  );
}

function fillCircle(pixels, size, cx, cy, radius, color) {
  const radiusSquared = radius * radius;
  for (let py = Math.floor(cy - radius); py < Math.ceil(cy + radius); py += 1) {
    for (let px = Math.floor(cx - radius); px < Math.ceil(cx + radius); px += 1) {
      const dx = px + 0.5 - cx;
      const dy = py + 0.5 - cy;
      if (dx * dx + dy * dy <= radiusSquared) {
        setPixel(pixels, size, px, py, color);
      }
    }
  }
}

function strokeCircle(pixels, size, cx, cy, radius, strokeWidth, color) {
  const outer = radius * radius;
  const inner = Math.max(radius - strokeWidth, 0) ** 2;
  for (let py = Math.floor(cy - radius); py < Math.ceil(cy + radius); py += 1) {
    for (let px = Math.floor(cx - radius); px < Math.ceil(cx + radius); px += 1) {
      const dx = px + 0.5 - cx;
      const dy = py + 0.5 - cy;
      const distance = dx * dx + dy * dy;
      if (distance <= outer && distance >= inner) {
        setPixel(pixels, size, px, py, color);
      }
    }
  }
}

function drawPixelGlyphG(pixels, size, x, y, cellSize, color) {
  const glyph = [
    '0111110',
    '1100011',
    '1100000',
    '1100000',
    '1101111',
    '1100011',
    '1100011',
    '1100011',
    '0111110',
  ];

  for (const [row, pattern] of glyph.entries()) {
    for (let column = 0; column < pattern.length; column += 1) {
      if (pattern[column] === '1') {
        fillRoundedRect(
          pixels,
          size,
          x + column * cellSize,
          y + row * cellSize,
          cellSize * 0.92,
          cellSize * 0.92,
          Math.max(cellSize * 0.18, 1),
          color,
        );
      }
    }
  }
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;

  const index = (Math.floor(y) * size + Math.floor(x)) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

function encodePng(width, height, rgba) {
  const rowLength = width * 4 + 1;
  const raw = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * rowLength] = 0;
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, y * rowLength + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    createPngChunk('IHDR', createIhdr(width, height)),
    createPngChunk('IDAT', deflateSync(raw)),
    createPngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createIhdr(width, height) {
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(width, 0);
  buffer.writeUInt32BE(height, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  buffer[10] = 0;
  buffer[11] = 0;
  buffer[12] = 0;

  return buffer;
}

function createPngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const directory = Buffer.alloc(16);
  directory[0] = 32;
  directory[1] = 32;
  directory[2] = 0;
  directory[3] = 0;
  directory.writeUInt16LE(1, 4);
  directory.writeUInt16LE(32, 6);
  directory.writeUInt32LE(png.length, 8);
  directory.writeUInt32LE(header.length + directory.length, 12);

  return Buffer.concat([header, directory, png]);
}
