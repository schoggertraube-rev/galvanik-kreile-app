import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = { createClient: vi.fn(), db: vi.fn(), auth: vi.fn(), createId: vi.fn() };

vi.mock("@/lib/supabase/server", () => ({ createClient: ports.createClient }));
vi.mock("@/db", () => ({ db: ports.db }));
vi.mock("@/lib/server/authHelper", () => ({ checkAppAuth: ports.auth }));
vi.mock("@paralleldrive/cuid2", () => ({ createId: ports.createId }));

const denial = "NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt.";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function expectNoPortCalls() {
  for (const port of Object.values(ports)) expect(port).not.toHaveBeenCalled();
}

describe("W2C B2M3A fail-closed commands", () => {
  beforeEach(() => vi.clearAllMocks());

  it("denies every phone-note, status-event, cockpit, service, and repository writer without data or port access", async () => {
    const [phoneNotes, statusEvents, cockpit, { eventsRepository }, { labelService }, { intakeService }] = await Promise.all([
      import("../phoneNotes.actions"), import("../status-events.actions"), import("@/app/cockpit/actions"),
      import("@/lib/repositories/eventsRepository"), import("@/lib/services/labelService"), import("@/lib/services/intakeService"),
    ]);

    await expect(phoneNotes.createPhoneNote({ rawText: "note" })).resolves.toEqual({ success: false, error: "NOT_AVAILABLE", message: denial });
    await expect(phoneNotes.updatePhoneNote("note-1", {})).resolves.toEqual({ success: false, error: "NOT_AVAILABLE", message: denial });
    await expect(phoneNotes.getRecentPhoneNotes()).resolves.toEqual({ success: false, error: "NOT_AVAILABLE", message: denial });
    await expect(statusEvents.createStatusEvent({ orderId: "order-1", eventType: "NOTE_ADDED" })).resolves.toEqual({ ok: false, error: "CONFLICT", message: denial });
    await expect(statusEvents.getStatusEventsByOrderId("order-1")).resolves.toEqual({ ok: false, error: "CONFLICT", message: denial });
    await expect(statusEvents.getStatusEventsByItemId("item-1")).resolves.toEqual({ ok: false, error: "CONFLICT", message: denial });
    await expect(statusEvents.getRecentStatusEvents()).resolves.toEqual({ ok: false, error: "CONFLICT", message: denial });
    await expect(cockpit.savePhoneNote({ raw_text: "note", category: "x", urgency: "x" })).resolves.toEqual({ ok: false, error: "NOT_AVAILABLE", message: denial });
    await expect(eventsRepository.addEvent({ eventType: "NOTE_ADDED" })).resolves.toEqual({ ok: false, error: "NOT_AVAILABLE", message: denial });
    await expect(eventsRepository.getAll()).resolves.toEqual([]);
    await expect(labelService.generateLabel("order-1")).resolves.toEqual({ ok: false, error: "NOT_AVAILABLE", message: denial });
    await expect(intakeService.processIntake({ customerId: null, orderTitle: "x", items: [] })).resolves.toEqual({ ok: false, error: "NOT_AVAILABLE", message: denial });
    expectNoPortCalls();
  });
});

describe("W2C B2M3A caller quarantine", () => {
  it("removes event, local persistence, and unavailable writer chains while retaining explicitly allowed UI", async () => {
    const files = await Promise.all([
      "components/telefonnotiz/TelefonnotizDesktop.tsx", "app/kommunikation/KommunikationClient.tsx", "app/kommunikation/PhoneNoteDetailView.tsx",
      "components/orders/OrderActionGrid.tsx", "components/intake/OcrMatchResult.tsx", "components/orders/LabelPrintView.tsx", "components/intake/IntakeCompletionSummary.tsx",
      "app/cockpit/components/AgingKachel.tsx", "lib/repositories/eventsRepository.ts",
    ].map((file) => readFile(path.join(root, file), "utf8")));
    const [phoneDesktop, kommunikation, detail, grid, ocr, label, intake, aging, events] = files;

    for (const source of [phoneDesktop, kommunikation, detail, intake]) {
      expect(source).toContain("FoundationUnavailable");
      expect(source).not.toMatch(/phoneNotes\.actions|intakeService|<button|<form|useEffect/);
    }
    expect(kommunikation).not.toContain("getRecentPhoneNotes");
    expect(detail).not.toContain("updatePhoneNote");
    expect(grid).toContain("StationStatusButton");
    expect(grid).toContain("onPrint");
    expect(grid).toContain("tel:");
    expect(grid).toContain("NOT_AVAILABLE");
    expect(grid).not.toMatch(/FileReader|canvas|localStorage|addEvent|type="file"|new Event/);
    expect(ocr).not.toMatch(/eventsRepository|addEvent|OCR_SCAN_COMPLETED|CUSTOMER_MATCHED/);
    expect(label).toContain("window.print");
    expect(label).not.toMatch(/labelService|generateLabel|LABEL_PREPARED/);
    expect(aging).toContain("BUCKET_ORDER");
    expect(aging).toContain("LABELS");
    expect(aging).toContain("getAgingBucket");
    expect(aging).toMatch(/dataPayload\.payload[\s\S]*bucketId/);
    expect(aging).toContain("getAgingDaten");
    expect(aging).toContain("getAgingRechnungen");
    expect(aging).not.toMatch(/savePhoneNote|Telefonnotiz erfassen|handlePhone|handleSavePhoneNote/);
    expect(events).not.toMatch(/localStorage|createId|Date\.|createStatusEvent|getRecentStatusEvents/);
  });
});
