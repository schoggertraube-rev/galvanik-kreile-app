export type BoundedBodyRequest = Pick<Request, "headers" | "body">;

export type BoundedBodyResult =
  | { ok: true; text: string; bytesRead: number }
  | {
      ok: false;
      reason: "invalid_content_length" | "body_too_large" | "body_read_failed";
      bytesRead: number;
    };

export async function readBoundedUtf8Body(
  request: BoundedBodyRequest,
  maxBytes: number,
): Promise<BoundedBodyResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new Error("INVALID_BODY_LIMIT");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0) {
      return { ok: false, reason: "invalid_content_length", bytesRead: 0 };
    }
    if (declaredBytes > maxBytes) {
      return { ok: false, reason: "body_too_large", bytesRead: 0 };
    }
  }

  if (!request.body) return { ok: true, text: "", bytesRead: 0 };

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytesRead = 0;
  let text = "";

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytesRead += chunk.value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel("REQUEST_BODY_TOO_LARGE");
        return { ok: false, reason: "body_too_large", bytesRead };
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, text, bytesRead };
  } catch {
    try {
      await reader.cancel("REQUEST_BODY_READ_FAILED");
    } catch {
      // The stream may already be closed or errored.
    }
    return { ok: false, reason: "body_read_failed", bytesRead };
  } finally {
    reader.releaseLock();
  }
}
