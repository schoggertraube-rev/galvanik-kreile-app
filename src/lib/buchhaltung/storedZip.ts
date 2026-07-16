export type StoredZipEntry = {
  name: string;
  content: string | Uint8Array;
};

const encoder = new TextEncoder();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function header(size: number, write: (view: DataView) => void): Uint8Array {
  const bytes = new Uint8Array(size);
  write(new DataView(bytes.buffer));
  return bytes;
}

/** Creates a deterministic, standards-compliant ZIP using STORE (no compression). */
export function createStoredZip(entries: StoredZipEntry[]): Uint8Array {
  if (entries.length === 0 || entries.length > 1000) {
    throw new Error('ZIP_ENTRY_COUNT_INVALID');
  }

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    if (!entry.name || entry.name.length > 240 || entry.name.includes('..') || entry.name.startsWith('/')) {
      throw new Error('ZIP_ENTRY_NAME_INVALID');
    }
    const name = encoder.encode(entry.name.replaceAll('\\', '/'));
    const content = typeof entry.content === 'string' ? encoder.encode(entry.content) : entry.content;
    const checksum = crc32(content);

    const localHeader = header(30, (view) => {
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0x0800, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, 33, true);
      view.setUint32(14, checksum, true);
      view.setUint32(18, content.byteLength, true);
      view.setUint32(22, content.byteLength, true);
      view.setUint16(26, name.byteLength, true);
      view.setUint16(28, 0, true);
    });
    localParts.push(localHeader, name, content);

    const centralHeader = header(46, (view) => {
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, 0x0800, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, 0, true);
      view.setUint16(14, 33, true);
      view.setUint32(16, checksum, true);
      view.setUint32(20, content.byteLength, true);
      view.setUint32(24, content.byteLength, true);
      view.setUint16(28, name.byteLength, true);
      view.setUint16(30, 0, true);
      view.setUint16(32, 0, true);
      view.setUint16(34, 0, true);
      view.setUint16(36, 0, true);
      view.setUint32(38, 0, true);
      view.setUint32(42, localOffset, true);
    });
    centralParts.push(centralHeader, name);
    localOffset += localHeader.byteLength + name.byteLength + content.byteLength;
  }

  const centralDirectory = concat(centralParts);
  const end = header(22, (view) => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, entries.length, true);
    view.setUint16(10, entries.length, true);
    view.setUint32(12, centralDirectory.byteLength, true);
    view.setUint32(16, localOffset, true);
    view.setUint16(20, 0, true);
  });

  return concat([...localParts, centralDirectory, end]);
}
