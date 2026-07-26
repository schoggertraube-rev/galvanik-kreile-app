export function parseSafeInternalPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) {
    return null;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || /[\\\u0000-\u001f]/.test(decoded)) {
    return null;
  }
  try {
    const parsed = new URL(value, "https://kreile.invalid");
    if (parsed.origin !== "https://kreile.invalid") return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function safeReturnTo(value: string | null | undefined, fallback: string): string {
  return parseSafeInternalPath(value) ?? fallback;
}
