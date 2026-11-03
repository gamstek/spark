#!/usr/bin/env node
// Regenerate delivery images after importing design slices with lanhu-slices.mjs.
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const require = createRequire(
  new URL('../apps/api/package.json', import.meta.url),
);
const sharp = require('sharp');
const root = fileURLToPath(
  new URL('../apps/activity/src/assets/slices/', import.meta.url),
);
const write = process.argv.includes('--write');
let before = 0;
let after = 0;

async function optimize(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await optimize(path);
      continue;
    }
    if (!/\.(jpe?g|png)$/i.test(entry.name)) continue;
    const source = await stat(path);
    const qr = entry.name === 'qr.png';
    const icon = entry.name.startsWith('icon');
    const image = sharp(await readFile(path)).rotate();
    image.resize({
      width: qr
        ? 720
        : icon
          ? 258
          : entry.name === 'wheel-face.png'
            ? 1050
            : 1125,
      withoutEnlargement: true,
    });
    const output = await (
      /\.png$/i.test(entry.name)
        ? image.png({
            compressionLevel: 9,
            palette: true,
            quality: qr ? 100 : 85,
            effort: 10,
          })
        : image.jpeg({ quality: 78, mozjpeg: true, progressive: true })
    ).toBuffer();
    if (output.length >= source.size) {
      before += source.size;
      after += source.size;
      console.log(
        `${relative(root, path)}: already smaller (${source.size} bytes), keeping original`,
      );
      continue;
    }
    if (write) {
      await writeFile(path, output);
    }
    before += source.size;
    after += output.length;
    console.log(
      `${relative(root, path)}: ${source.size} -> ${output.length} bytes (${Math.round(100 - (output.length / source.size) * 100)}% smaller)`,
    );
  }
}

await optimize(root);
console.log(
  `Total: ${before} -> ${after} bytes (${before ? (100 - (after / before) * 100).toFixed(1) : 0}% smaller)${write ? '' : ' (dry run; add --write to apply)'}`,
);
