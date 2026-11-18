import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

import { build } from "esbuild";

const currentDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(currentDir, "..");
const distDir = resolve(rootDir, "dist");
const webDownloadZip = resolve(
  rootDir,
  "../web/public/downloads/starstask-siakad-injector.zip",
);

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i += 1) {
  let c = i;
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c >>> 0;
}

function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function collectFiles(dir, base = dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = resolve(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      results.push(...collectFiles(fullPath, base));
    } else {
      results.push({
        name: relative(base, fullPath).replace(/\\/g, "/"),
        data: readFileSync(fullPath),
      });
    }
  }
  return results;
}

function createZipBuffer(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const compressed = deflateRawSync(file.data);
    const crc = crc32(file.data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(file.data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(file.data.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(files.length, 8);
  endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralDir.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, endRecord]);
}

async function runBuild() {
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });

  await Promise.all([
    build({
      entryPoints: [resolve(rootDir, "src/background.ts")],
      outfile: resolve(distDir, "background.js"),
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "chrome114",
      sourcemap: false,
      minify: false,
    }),
    build({
      entryPoints: [resolve(rootDir, "src/content.ts")],
      outfile: resolve(distDir, "content.js"),
      bundle: true,
      format: "iife",
      platform: "browser",
      target: "chrome114",
      sourcemap: false,
      minify: false,
    }),
    build({
      entryPoints: [resolve(rootDir, "src/popup/popup.ts")],
      outfile: resolve(distDir, "popup.js"),
      bundle: true,
      format: "iife",
      platform: "browser",
      target: "chrome114",
      sourcemap: false,
      minify: false,
    }),
  ]);

  cpSync(resolve(rootDir, "manifest.json"), resolve(distDir, "manifest.json"));
  cpSync(
    resolve(rootDir, "src/popup/popup.html"),
    resolve(distDir, "popup.html"),
  );
  cpSync(
    resolve(rootDir, "src/popup/popup.css"),
    resolve(distDir, "popup.css"),
  );
  cpSync(resolve(rootDir, "icons"), resolve(distDir, "icons"), {
    recursive: true,
  });

  mkdirSync(dirname(webDownloadZip), { recursive: true });
  writeFileSync(webDownloadZip, createZipBuffer(collectFiles(distDir)));
}

runBuild().catch((error) => {
  console.error("Extension build failed:", error);
  process.exitCode = 1;
});
