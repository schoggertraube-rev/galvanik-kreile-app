import { describe, expect, it } from "vitest";

import { GET as customerSearch } from "@/app/api/erfassung/customer-search/route";
import { GET as scanStatus } from "@/app/api/erfassung/scan-status/[id]/route";
import { POST as scanUpload } from "@/app/api/erfassung/scan-upload/route";
import { POST as itemPhotoUpload } from "@/app/api/erfassung/item-photo-upload/route";
import { POST as ocrProcess } from "@/app/api/ocr-process/route";
import { GET as feedbackDispatch } from "@/app/api/cron/send-feedback/route";

async function expectNotConfigured(response: Response) {
  expect(response.status).toBe(503);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  await expect(response.json()).resolves.toMatchObject({ error: "NOT_CONFIGURED" });
}

describe("foundation-unavailable API boundaries", () => {
  it("does not start customer capture or scan-status reads", async () => {
    await expectNotConfigured(await customerSearch(new Request("https://example.test/api/erfassung/customer-search?q=ab")));
    await expectNotConfigured(await scanStatus(new Request("https://example.test/api/erfassung/scan-status/test")));
  });

  it("does not start uploads or OCR providers", async () => {
    const request = () => new Request("https://example.test/api", { method: "POST", body: "{}" });
    await expectNotConfigured(await scanUpload(request()));
    await expectNotConfigured(await itemPhotoUpload(request()));
    await expectNotConfigured(await ocrProcess(request()));
  });

  it("does not start feedback dispatch", async () => {
    await expectNotConfigured(await feedbackDispatch(new Request("https://example.test/api/cron/send-feedback")));
  });
});
