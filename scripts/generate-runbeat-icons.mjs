import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const sizes = [16, 32, 48, 128];
const outDir = 'public/icons';
const sample = 4;

mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function rgb(hex) {
  const raw = hex.slice(1);
  return [0, 2, 4].map((i) => Number.parseInt(raw.slice(i, i + 2), 16));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function gradient(t) {
  const a = t < 0.5 ? rgb('#3B82F6') : rgb('#6C5CE7');
  const b = t < 0.5 ? rgb('#6C5CE7') : rgb('#8B5CF6');
  const k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k), 255];
}

function blend(buf, size, x, y, color, alpha = 1) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  const a = Math.max(0, Math.min(1, alpha)) * (color[3] / 255);
  const inv = 1 - a;
  buf[i] = buf[i] * inv + color[0] * a;
  buf[i + 1] = buf[i + 1] * inv + color[1] * a;
  buf[i + 2] = buf[i + 2] * inv + color[2] * a;
  buf[i + 3] = Math.min(255, buf[i + 3] + 255 * a);
}

function drawLine(buf, size, x1, y1, x2, y2, width, color) {
  const r = width / 2;
  const minX = Math.floor(Math.min(x1, x2) - r - 2);
  const maxX = Math.ceil(Math.max(x1, x2) + r + 2);
  const minY = Math.floor(Math.min(y1, y2) - r - 2);
  const maxY = Math.ceil(Math.max(y1, y2) + r + 2);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
      const cx = x1 + t * dx;
      const cy = y1 + t * dy;
      const d = Math.hypot(px - cx, py - cy);
      if (d <= r + 1) blend(buf, size, x, y, color, Math.min(1, r + 1 - d));
    }
  }
}

function drawCircle(buf, size, cx, cy, r, color) {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r + 1) blend(buf, size, x, y, color, Math.min(1, r + 1 - d));
    }
  }
}

function render(size) {
  const hi = size * sample;
  const buf = Buffer.alloc(hi * hi * 4);
  const white = [...rgb('#F8F9FC'), 255];
  const soft = [...rgb('#DDD6FE'), 255];
  const c = hi / 2;

  for (let y = 0; y < hi; y++) {
    for (let x = 0; x < hi; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      if (d <= hi * 0.44 + 1) {
        blend(buf, hi, x, y, gradient((x + y) / (hi * 2)), 1);
      }
    }
  }

  drawLine(buf, hi, hi * 0.28, hi * 0.60, hi * 0.70, hi * 0.32, hi * 0.07, white);
  drawLine(buf, hi, hi * 0.36, hi * 0.66, hi * 0.68, hi * 0.66, hi * 0.07, white);
  drawLine(buf, hi, hi * 0.59, hi * 0.36, hi * 0.74, hi * 0.25, hi * 0.06, white);
  drawLine(buf, hi, hi * 0.74, hi * 0.25, hi * 0.76, hi * 0.43, hi * 0.06, white);
  drawCircle(buf, hi, hi * 0.28, hi * 0.60, hi * 0.055, white);
  drawCircle(buf, hi, hi * 0.69, hi * 0.66, hi * 0.052, soft);

  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sums = [0, 0, 0, 0];
      for (let sy = 0; sy < sample; sy++) {
        for (let sx = 0; sx < sample; sx++) {
          const i = ((y * sample + sy) * hi + (x * sample + sx)) * 4;
          sums[0] += buf[i];
          sums[1] += buf[i + 1];
          sums[2] += buf[i + 2];
          sums[3] += buf[i + 3];
        }
      }
      const o = (y * size + x) * 4;
      out[o] = Math.round(sums[0] / (sample * sample));
      out[o + 1] = Math.round(sums[1] / (sample * sample));
      out[o + 2] = Math.round(sums[2] / (sample * sample));
      out[o + 3] = Math.round(sums[3] / (sample * sample));
    }
  }

  return out;
}

function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const rows = [];
  for (let y = 0; y < size; y++) {
    rows.push(Buffer.from([0]));
    rows.push(pixels.subarray(y * size * 4, (y + 1) * size * 4));
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of sizes) {
  writeFileSync(`${outDir}/icon-${size}.png`, png(size, render(size)));
}
