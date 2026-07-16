import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reserveItemPhotoJob, validateItemPhoto } from "@/lib/server/itemPhotoJobs";

function file(bytes: number[], type: string) {
  return new File([new Uint8Array(bytes)], "photo.bin", { type });
}

const baseInput = {
  request: new Request("http://localhost/api", { method: "POST" }),
  proposedJobId: "123e4567-e89b-42d3-a456-426614174000",
  tenantId: "galvanik-kreile",
  userId: "user-42",
  orderId: "order-42",
  itemId: "item-42",
  photo: {
    bytes: new Uint8Array([0xff, 0xd8, 0xff, ...Array(9).fill(0)]),
    mimeType: "image/jpeg" as const,
    extension: "jpg" as const,
    contentSha256: "a".repeat(64),
  },
  proposedStoragePath: "galvanik-kreile/order-42/item-42/123e4567-e89b-42d3-a456-426614174000.jpg",
};

describe("item photo job contracts", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts only supported MIME/signature pairs", async () => {
    await expect(validateItemPhoto(file([0xff, 0xd8, 0xff, ...Array(9).fill(0)], "image/jpeg")))
      .resolves.toMatchObject({ mimeType: "image/jpeg", extension: "jpg" });
    await expect(validateItemPhoto(file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0], "image/png")))
      .resolves.toMatchObject({ mimeType: "image/png", extension: "png" });
    await expect(validateItemPhoto(file([0xff, 0xd8, 0xff, ...Array(9).fill(0)], "image/png")))
      .rejects.toThrow("INVALID_ITEM_PHOTO");
    await expect(validateItemPhoto(file(Array(12).fill(0), "image/heic")))
      .rejects.toThrow("INVALID_ITEM_PHOTO");
  });

  it("fails closed without the capture HMAC secret", async () => {
    const rpc = vi.fn();
    await expect(reserveItemPhotoJob({
      ...baseInput,
      client: { rpc } as unknown as SupabaseClient,
    })).rejects.toThrow("CAPTURE_USAGE_MISCONFIGURED");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps durable quota and settled replay decisions", async () => {
    vi.stubEnv("CAPTURE_USAGE_HMAC_SECRET", "0123456789abcdef0123456789abcdef");
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{
        allowed: false,
        job_id: null,
        replay: false,
        upload_required: false,
        job_status: "rejected",
        reserved_storage_path: null,
        replay_result: null,
        retry_after_seconds: 60,
        decision_reason: "user_window",
      }], error: null })
      .mockResolvedValueOnce({ data: [{
        allowed: true,
        job_id: baseInput.proposedJobId,
        replay: true,
        upload_required: false,
        job_status: "succeeded",
        reserved_storage_path: baseInput.proposedStoragePath,
        replay_result: { material: "Stahl", confidence: 0.9 },
        retry_after_seconds: 0,
        decision_reason: "replay_result",
      }], error: null });
    const client = { rpc } as unknown as SupabaseClient;
    await expect(reserveItemPhotoJob({ ...baseInput, client })).resolves.toEqual({
      kind: "rejected",
      retryAfterSeconds: 60,
      terminal: false,
    });
    await expect(reserveItemPhotoJob({ ...baseInput, client })).resolves.toMatchObject({
      kind: "replay",
      result: { material: "Stahl", confidence: 0.9 },
    });
  });
});
