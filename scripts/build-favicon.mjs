import fs from 'node:fs/promises';
import sharp from 'sharp';

// public/favicon.svg is the approved, self-contained three-quarter Brick artwork.
const publicDir = new URL('../public/', import.meta.url);
const source = await fs.readFile(new URL('favicon.svg', publicDir));
const docsImages = new URL('../docs/images/', import.meta.url);
await fs.mkdir(docsImages, { recursive: true });
await fs.writeFile(new URL('avatar.png', docsImages), await sharp(source).resize(176, 176).png().toBuffer());
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(size => sharp(source).resize(size, size).png().toBuffer()));
for (const [index, size] of sizes.entries()) {
  if (size !== 48) await fs.writeFile(new URL(`favicon-${size}.png`, publicDir), images[index]);
}

// ICO directory followed by one PNG payload for each native favicon size.
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
for (const [index, size] of sizes.entries()) {
  const entry = 6 + index * 16;
  directory[entry] = size;
  directory[entry + 1] = size;
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(images[index].length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += images[index].length;
}
await fs.writeFile(new URL('favicon.ico', publicDir), Buffer.concat([directory, ...images]));
console.log('Generated Brick PNG favicons and 16/32/48px ICO.');
