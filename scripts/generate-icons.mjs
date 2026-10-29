#!/usr/bin/env node
/**
 * Generates the PWA icons committed under `apps/web/public/icons`.
 *
 * The project intentionally has no image toolchain dependency; these are
 * simple, deterministic shapes encoded as PNG with Node's zlib. Re-run this
 * script after changing the brand colours.
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(root, "apps", "web", "public", "icons");

const BRAND = [30, 58, 138, 255]; // --color-accent #1e3a8a
const WHITE = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];

/** Signed area test used to fill the star polygon. */
function isInsidePolygon(x, y, points) {
  let inside = false;

  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function starPoints(center, outerRadius, innerRadius) {
  const points = [];

  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    points.push([
      center + Math.cos(angle) * radius,
      center + Math.sin(angle) * radius,
    ]);
  }

  return points;
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);

  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Renders a star at 4x resolution, then averages samples so edges are smooth
 * without pulling in a canvas dependency.
 */
function renderIcon(size, { background, foreground, starRatio }) {
  const scale = 4;
  const pixels = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const star = starPoints(center, size * starRatio, size * starRatio * 0.382);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let covered = 0;

      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const sampleX = x + (sx + 0.5) / scale;
          const sampleY = y + (sy + 0.5) / scale;

          if (isInsidePolygon(sampleX, sampleY, star)) {
            covered += 1;
          }
        }
      }

      const alpha = covered / (scale * scale);
      const offset = (y * size + x) * 4;

      for (let channel = 0; channel < 4; channel += 1) {
        pixels[offset + channel] = Math.round(
          background[channel] * (1 - alpha) + foreground[channel] * alpha,
        );
      }
    }
  }

  return encodePng(size, size, pixels);
}

mkdirSync(outputDir, { recursive: true });

const files = [
  [
    "icon-192.png",
    192,
    { background: BRAND, foreground: WHITE, starRatio: 0.32 },
  ],
  [
    "icon-512.png",
    512,
    { background: BRAND, foreground: WHITE, starRatio: 0.32 },
  ],
  [
    "icon-maskable-512.png",
    512,
    { background: BRAND, foreground: WHITE, starRatio: 0.26 },
  ],
  [
    "apple-touch-icon.png",
    180,
    { background: BRAND, foreground: WHITE, starRatio: 0.3 },
  ],
  [
    "badge-96.png",
    96,
    { background: CLEAR, foreground: WHITE, starRatio: 0.38 },
  ],
];

for (const [name, size, options] of files) {
  writeFileSync(join(outputDir, name), renderIcon(size, options));
  console.log(`wrote apps/web/public/icons/${name}`);
}
