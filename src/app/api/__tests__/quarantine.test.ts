import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

type RouteHandler = (request: Request) => Promise<Response>;

const quarantinedHandlers: Array<{ name: string; file: string; load: () => Promise<unknown> }> = [
  { name: "ocr-process", file: "src/app/api/ocr-process/route.ts", load: async () => (await import("@/app/api/ocr-process/route")).POST },
  { name: "scan-status", file: "src/app/api/erfassung/scan-status/[id]/route.ts", load: async () => (await import("@/app/api/erfassung/scan-status/[id]/route")).GET },
  { name: "scan-upload", file: "src/app/api/erfassung/scan-upload/route.ts", load: async () => (await import("@/app/api/erfassung/scan-upload/route")).POST },
  { name: "item-photo-upload", file: "src/app/api/erfassung/item-photo-upload/route.ts", load: async () => (await import("@/app/api/erfassung/item-photo-upload/route")).POST },
  { name: "customer-search", file: "src/app/api/erfassung/customer-search/route.ts", load: async () => (await import("@/app/api/erfassung/customer-search/route")).GET },
  { name: "customer-enrich", file: "src/app/api/erfassung/customer-enrich/route.ts", load: async () => (await import("@/app/api/erfassung/customer-enrich/route")).POST },
  { name: "freetext-extract", file: "src/app/api/erfassung/freetext-extract/route.ts", load: async () => (await import("@/app/api/erfassung/freetext-extract/route")).POST },
  { name: "inquiry-extract", file: "src/app/api/erfassung/inquiry-extract/route.ts", load: async () => (await import("@/app/api/erfassung/inquiry-extract/route")).POST },
  { name: "notes-extract", file: "src/app/api/erfassung/notes-extract/route.ts", load: async () => (await import("@/app/api/erfassung/notes-extract/route")).POST },
  { name: "payment-create", file: "src/app/api/payments/mollie/create/route.ts", load: async () => (await import("@/app/api/payments/mollie/create/route")).POST },
  { name: "email-send", file: "src/app/api/email/send/route.ts", load: async () => (await import("@/app/api/email/send/route")).POST },
  { name: "send-feedback", file: "src/app/api/cron/send-feedback/route.ts", load: async () => (await import("@/app/api/cron/send-feedback/route")).GET },
  { name: "morning-message", file: "src/app/api/morning-message/route.ts", load: async () => (await import("@/app/api/morning-message/route")).GET },
  { name: "today-has-deadlines", file: "src/app/api/today/has-deadlines/route.ts", load: async () => (await import("@/app/api/today/has-deadlines/route")).GET },
  { name: "today-important", file: "src/app/api/today/important/route.ts", load: async () => (await import("@/app/api/today/important/route")).GET },
  { name: "today-status", file: "src/app/api/today/status/route.ts", load: async () => (await import("@/app/api/today/status/route")).GET },
  { name: "today-timeline", file: "src/app/api/today/timeline/route.ts", load: async () => (await import("@/app/api/today/timeline/route")).GET },
  { name: "users", file: "src/app/api/users/route.ts", load: async () => (await import("@/app/api/users/route")).GET },
];

afterEach(() => vi.unstubAllGlobals());

describe("F0 W2C active route quarantine", () => {
  it.each(quarantinedHandlers)("returns a non-cacheable 503 before external side effects: $name", async ({ load }) => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const handler = (await load()) as RouteHandler;
    const requestBody = {
      formData: vi.fn(() => { throw new Error("request body must not be read"); }),
      json: vi.fn(() => { throw new Error("request body must not be read"); }),
      text: vi.fn(() => { throw new Error("request body must not be read"); }),
    } as unknown as Request;

    const response = await handler(requestBody);

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "NOT_AVAILABLE" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(requestBody.formData).not.toHaveBeenCalled();
    expect(requestBody.json).not.toHaveBeenCalled();
    expect(requestBody.text).not.toHaveBeenCalled();
  });
});

describe("F0 W2C active client containment", () => {
  it("removes browser upload and public-URL operations while keeping honest disabled controls", () => {
    const sources = [
      "src/app/buchhaltung/belege/neu/page.tsx",
      "src/components/orders/OrderOverlay.tsx",
      "src/components/erfassung/ScanFlow/ScanUpload.tsx",
      "src/components/erfassung/shared/ItemPhotoUploader.tsx",
      "src/components/intake/CameraCapture.tsx",
      "src/components/customers/NewCustomerForm.tsx",
      "src/components/orders/NewOrderForm.tsx",
      "src/components/orders/StatusMailDrawer.tsx",
      "src/lib/services/intakeService.ts",
      "src/lib/services/photoService.ts",
    ].map((file) => readFileSync(resolve(process.cwd(), file), "utf8"));

    for (const source of sources) {
      expect(source).not.toMatch(/getPublicUrl|\.storage\.from\(|\.upload\(|functions\.invoke|type="file"/);
    }
    for (const source of sources.slice(0, 8)) {
      expect(source).toMatch(/disabled|nicht verfügbar/i);
      expect(source).not.toMatch(/addEvent|processImage|createPaymentIntent|emailProvider\.send/);
    }
    expect(sources[0]).toContain("disabled");
    expect(sources[0]).toContain("nicht verfügbar");
    expect(sources[1]).toContain("disabled");
    expect(sources[1]).toContain("Nicht verfügbar");
  });

  it("removes the active payment-provider invocation and exposes an honest disabled control", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/orders/PaymentDrawer.tsx"), "utf8");

    expect(source).not.toMatch(/createPaymentIntent|mollieAdapter|functions\.invoke/);
    expect(source).toContain("disabled");
    expect(source).toContain("nicht verfügbar");
  });

  it("keeps every quarantined route limited to the quarantine port", () => {
    expect(quarantinedHandlers).toHaveLength(18);
    for (const { file } of quarantinedHandlers) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source.match(/^import .+;$/gm)).toEqual(['import { notAvailableResponse } from "@/lib/server/quarantine";']);
      expect(source).not.toMatch(/@\/db|drizzle|supabase|storage|admin|auth|event|provider|resend|mollie|ocr|fetch\(|formData\(|\.json\(|\.text\(/i);
    }
  });

  it("blocks the intake photo branch before its event and upload ports", () => {
    const intake = readFileSync(resolve(process.cwd(), "src/lib/services/intakeService.ts"), "utf8");
    const photo = readFileSync(resolve(process.cwd(), "src/lib/services/photoService.ts"), "utf8");

    expect(intake).not.toContain('import { photoService }');
    expect(intake.indexOf("data.items.some")).toBeLessThan(intake.indexOf("eventsRepository.addEvent"));
    expect(photo).not.toMatch(/createClient|storage|fetch\(|getPublicUrl|addEvent/);
    expect(photo).toMatch(/nicht verfügbar/i);
  });
});
