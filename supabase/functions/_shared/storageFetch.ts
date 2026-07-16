const MAX_FILE_BYTES = 12 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export function validateStorageUrl(value: string): URL {
  const baseValue = Deno.env.get("SUPABASE_URL");
  if (!baseValue) throw new Error("SUPABASE_URL is not configured");
  const base = new URL(baseValue);
  const url = new URL(value);
  if (
    url.origin !== base.origin ||
    url.username ||
    url.password ||
    url.port !== base.port ||
    !url.pathname.startsWith("/storage/v1/object/")
  ) {
    throw new Error("Invalid storage URL");
  }
  return url;
}

export async function loadStorageFile(fileUrl: string): Promise<{ bytes: ArrayBuffer; mime: string }> {
  const url = validateStorageUrl(fileUrl);
  const response = await fetch(url, { redirect: "error" });
  if (!response.ok) throw new Error("Storage fetch failed");
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_FILE_BYTES) throw new Error("File too large");
  const mime = (response.headers.get("content-type") ?? "").split(";", 1)[0].toLowerCase();
  if (!ALLOWED_MIME.has(mime)) throw new Error("Unsupported MIME type");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error("File too large");
  return { bytes, mime };
}

export function validateBase64(value: string, mime: string): void {
  if (!ALLOWED_MIME.has(mime.toLowerCase())) throw new Error("Unsupported MIME type");
  if (value.length > Math.ceil(MAX_FILE_BYTES / 3) * 4) throw new Error("File too large");
}
