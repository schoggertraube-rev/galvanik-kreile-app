import { describe, expect, it, vi } from "vitest";

type UploadHandler = (request: Request) => Promise<Response>;

const uploadRoutes: Array<{ name: string; load: () => Promise<unknown> }> = [
  { name: "scan-upload", load: async () => (await import("@/app/api/erfassung/scan-upload/route")).POST },
  { name: "item-photo-upload", load: async () => (await import("@/app/api/erfassung/item-photo-upload/route")).POST },
];

describe("erfassung upload routes — quarantine", () => {
  it.each(uploadRoutes)("returns 503 before parsing the upload body: $name", async ({ load }) => {
    const formData = vi.fn(() => { throw new Error("formData must not be read"); });
    const request = { formData } as unknown as Request;
    const handler = (await load()) as UploadHandler;

    const response = await handler(request);

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "NOT_AVAILABLE" });
    expect(formData).not.toHaveBeenCalled();
  });
});
