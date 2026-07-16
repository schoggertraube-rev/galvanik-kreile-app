export async function readUtf8BodyWithinLimit(
  request: { readonly body: ReadableStream<Uint8Array> | null },
  maxBytes: number,
): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error("INVALID_BODY_LIMIT");
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let completed = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        completed = true;
        break;
      }
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        throw new Error("REQUEST_BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (!completed) {
      try {
        await reader.cancel("request body rejected");
      } catch {
        // The original bounded-read failure is authoritative.
      }
    }
    throw error;
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(body);
}
