/**
 * The app's icon, for a phone's home screen.
 *
 * The manifest had asked for /icons/icon-192.png and icon-512.png since
 * the beginning and neither existed, so every load fetched them and was
 * refused — and anyone adding My Kutumbh to their home screen got a
 * blank square.
 *
 * Drawn here rather than fetched: a leaf on the app's own purple, the
 * same one that sits in the header. No image library, because a PNG is
 * only pixels, a checksum and zlib — all of which Node already has.
 *
 *   node scripts/make-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const INK = [0x24, 0x12, 0x38];    // #241238, the header's deep purple
const LEAF = [0x9C, 0xCC, 0x65];   // a green that holds up against it
const VEIN = [0x6B, 0x9E, 0x3F];   // the midrib, a shade deeper

/** A leaf: where two circles overlap, turned on its side, with a stem. */
function draw(size) {
  const px = Buffer.alloc(size * size * 4);
  const c = size / 2;
  // Kept inside the middle 80%: Android crops a maskable icon to a
  // circle, and a leaf whose tips reach the corners loses them.
  const safe = 0.78;
  const r = size * 0.62 * safe;    // circle radius
  const off = size * 0.30 * safe;  // how far apart the two centres sit

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Turn the coordinates 45°, so the leaf lies corner to corner
      const dx = x - c, dy = y - c;
      const rx = (dx + dy) * Math.SQRT1_2;
      const ry = (dy - dx) * Math.SQRT1_2;

      const inA = Math.hypot(rx, ry - off) < r;
      const inB = Math.hypot(rx, ry + off) < r;

      // The midrib runs the length of it, and a stem below
      const onVein = inA && inB && Math.abs(rx) < size * 0.016 && ry < size * 0.24;
      const onStem = Math.abs(rx) < size * 0.019 && ry > size * 0.21 && ry < size * 0.35;

      const colour = onVein || onStem ? VEIN : inA && inB ? LEAF : INK;

      const i = (y * size + x) * 4;
      px[i] = colour[0];
      px[i + 1] = colour[1];
      px[i + 2] = colour[2];
      px[i + 3] = 255;
    }
  }
  return px;
}

/** Wrap raw pixels as a PNG: signature, header, data, end. */
function toPng(px, size) {
  // Each row is preceded by its filter byte; 0 means "no filter"
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;    // bits per channel
  ihdr[9] = 6;    // truecolour with alpha
  ihdr[10] = 0;   // deflate
  ihdr[11] = 0;   // adaptive filtering
  ihdr[12] = 0;   // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const dir = join(process.cwd(), "public", "icons");
mkdirSync(dir, { recursive: true });

for (const size of [192, 512]) {
  const file = join(dir, `icon-${size}.png`);
  writeFileSync(file, toPng(draw(size), size));
  console.log(`icon-${size}.png written`);
}
