import { describe, expect, it, vi } from "vitest";
import {
  readBoundedUtf8Body,
  type BoundedBodyRequest,
} from "../../../../supabase/functions/_shared/boundedRequestBody";

function streamedRequest(
  chunks: Uint8Array<ArrayBuffer>[],
  headers: HeadersInit = {},
  onCancel?: (reason: unknown) => void,
): BoundedBodyRequest {
  let index = 0;
  return {
    headers: new Headers(headers),
    body: new ReadableStream<Uint8Array<ArrayBuffer>>({
      pull(controller) {
        if (index < chunks.length) {
          controller.enqueue(chunks[index]);
          index += 1;
        } else {
          controller.close();
        }
      },
      cancel: onCancel,
    }),
  };
}

describe("bounded request body reader", () => {
  it("accepts a body without Content-Length only while the streamed bytes stay in bounds", async () => {
    const encoder = new TextEncoder();
    await expect(readBoundedUtf8Body(
      streamedRequest([encoder.encode("id=tr_1234567890")]),
      2_048,
    )).resolves.toEqual({
      ok: true,
      text: "id=tr_1234567890",
      bytesRead: 16,
    });
  });

  it("cancels a chunked body as soon as cumulative bytes exceed the hard limit", async () => {
    const cancelled = vi.fn();
    const result = await readBoundedUtf8Body(
      streamedRequest(
        [new Uint8Array(1_500), new Uint8Array(600)],
        {},
        cancelled,
      ),
      2_048,
    );

    expect(result).toEqual({
      ok: false,
      reason: "body_too_large",
      bytesRead: 2_100,
    });
    expect(cancelled).toHaveBeenCalledWith("REQUEST_BODY_TOO_LARGE");
  });

  it("rejects an invalid or oversized declared length before reading the stream", async () => {
    const cancelled = vi.fn();
    await expect(readBoundedUtf8Body(
      streamedRequest([new Uint8Array(1)], { "content-length": "unknown" }, cancelled),
      2_048,
    )).resolves.toEqual({
      ok: false,
      reason: "invalid_content_length",
      bytesRead: 0,
    });
    await expect(readBoundedUtf8Body(
      streamedRequest([new Uint8Array(1)], { "content-length": "2049" }, cancelled),
      2_048,
    )).resolves.toEqual({
      ok: false,
      reason: "body_too_large",
      bytesRead: 0,
    });
    expect(cancelled).not.toHaveBeenCalled();
  });
});
