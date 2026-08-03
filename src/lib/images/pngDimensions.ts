export type PngDimensions = {
  height: number;
  width: number;
};

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export function getPngDataUrlDimensions(dataUrl: string): PngDimensions {
  const separatorIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:image/png;base64,") || separatorIndex < 0) {
    return { width: 1, height: 1 };
  }

  try {
    const header = atob(dataUrl.slice(separatorIndex + 1, separatorIndex + 33));
    const bytes = Uint8Array.from(header, (character) => character.charCodeAt(0));
    if (
      bytes.length < 24 ||
      PNG_SIGNATURE.some((value, index) => bytes[index] !== value) ||
      String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR"
    ) {
      return { width: 1, height: 1 };
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    return width > 0 && height > 0 ? { width, height } : { width: 1, height: 1 };
  } catch {
    return { width: 1, height: 1 };
  }
}
