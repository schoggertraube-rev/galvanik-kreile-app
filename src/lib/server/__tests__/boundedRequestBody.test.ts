import { describe, expect, it, vi } from "vitest";
import { readUtf8BodyWithinLimit } from "@/lib/server/boundedRequestBody";

function streamOf(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

describe("readUtf8BodyWithinLimit", () => {
  it("decodes a body at the exact UTF-8 byte boundary", async () => {
    const bytes = new TextEncoder().encode('{"notice":"Grüße"}');
    const request = { body: streamOf(bytes) };

    await expect(readUtf8BodyWithinLimit(request, bytes.byteLength))
      .resolves.toBe('{"notice":"Grüße"}');
  });

  it("cancels a chunked stream as soon as its real byte limit is exceeded", async () => {
    const cancel = vi.fn();
    let pullCount = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pullCount += 1;
        controller.enqueue(new Uint8Array(10));
      },
      cancel,
    });

    await expect(readUtf8BodyWithinLimit({ body: stream }, 16))
      .rejects.toThrow("REQUEST_BODY_TOO_LARGE");
    expect(pullCount).toBe(2);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("rejects malformed UTF-8 instead of replacing bytes silently", async () => {
    const stream = streamOf(new Uint8Array([0xc3, 0x28]));
    await expect(readUtf8BodyWithinLimit({ body: stream }, 16)).rejects.toThrow();
  });
});
