import 'server-only';
import { crc32, inflateSync } from 'node:zlib';

const COLOUR_FORMATS: Readonly<Record<number, { channels: number; depths: number[] } | undefined>> = {
  0: { channels: 1, depths: [1, 2, 4, 8, 16] },
  2: { channels: 3, depths: [8, 16] },
  3: { channels: 1, depths: [1, 2, 4, 8] },
  4: { channels: 2, depths: [8, 16] },
  6: { channels: 4, depths: [8, 16] },
};

const ADAM7 = [
  [0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4],
  [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2],
] as const;

/** The image decoder can pad missing rows. Verify their exact packed length
 * before passing the image to that decoder. Dimensions are bounded by the caller. */
export function hasCompletePngRaster(bytes: Uint8Array, width: number, height: number): boolean {
  const file = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (file.length < 45 || file.readUInt32BE(0) !== 0x89504e47 || file.readUInt32BE(4) !== 0x0d0a1a0a
    || file.readUInt32BE(8) !== 13 || file.toString('ascii', 12, 16) !== 'IHDR'
    || file.readUInt32BE(16) !== width || file.readUInt32BE(20) !== height) return false;

  const depth = file[24];
  const format = COLOUR_FORMATS[file[25]];
  const interlace = file[28];
  if (!format?.depths.includes(depth) || file[26] !== 0 || file[27] !== 0 || interlace > 1) return false;

  const chunks: Buffer[] = [];
  let offset = 8;
  let idatEnded = false;
  let hasEnd = false;
  while (offset + 12 <= file.length) {
    const size = file.readUInt32BE(offset);
    const crcOffset = offset + 8 + size;
    if (crcOffset + 4 > file.length || crc32(file.subarray(offset + 4, crcOffset)) !== file.readUInt32BE(crcOffset)) return false;
    const kind = file.toString('ascii', offset + 4, offset + 8);
    if (kind === 'IHDR' && offset !== 8) return false;
    if (kind === 'IDAT') {
      if (idatEnded) return false;
      chunks.push(file.subarray(offset + 8, crcOffset));
    } else if (chunks.length) {
      idatEnded = true;
    }
    offset = crcOffset + 4;
    if (kind === 'IEND') {
      hasEnd = size === 0 && offset === file.length;
      break;
    }
  }
  if (!hasEnd || !chunks.length) return false;

  const passes = interlace ? ADAM7 : [[0, 0, 1, 1]] as const;
  const scanlines = passes.flatMap(([x, y, dx, dy]) => {
    const columns = Math.ceil((width - x) / dx);
    const rows = Math.ceil((height - y) / dy);
    return columns > 0 && rows > 0 ? [{ rows, rowBytes: 1 + Math.ceil(columns * format.channels * depth / 8) }] : [];
  });
  const expectedLength = scanlines.reduce((sum, { rows, rowBytes }) => sum + rows * rowBytes, 0);
  try {
    const data = inflateSync(Buffer.concat(chunks), { maxOutputLength: expectedLength });
    if (data.length !== expectedLength) return false;
    let rowOffset = 0;
    for (const { rows, rowBytes } of scanlines) {
      for (let row = 0; row < rows; row++, rowOffset += rowBytes) {
        if (data[rowOffset] > 4) return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}
