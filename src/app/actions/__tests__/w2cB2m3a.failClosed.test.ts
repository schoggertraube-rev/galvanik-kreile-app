import { existsSync } from "node:fs";
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

  it("denies service and repository writers without data or port access", async () => {
    const [{ eventsRepository }, { labelService }, { intakeService }] = await Promise.all([
      import("@/lib/repositories/eventsRepository"), import("@/lib/services/labelService"), import("@/lib/services/intakeService"),
    ]);

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
      "components/intake/IntakeCompletionSummary.tsx",
      "lib/repositories/eventsRepository.ts",
    ].map((file) => readFile(path.join(root, file), "utf8")));
    const [phoneDesktop, kommunikation, detail, intake, events] = files;

    for (const source of [phoneDesktop, kommunikation, detail, intake]) {
      expect(source).toContain("FoundationUnavailable");
      expect(source).not.toMatch(/phoneNotes\.actions|intakeService|<button|<form|useEffect/);
    }
    expect(kommunikation).not.toContain("getRecentPhoneNotes");
    expect(detail).not.toContain("updatePhoneNote");
    for (const file of [
      "components/orders/OrderActionGrid.tsx",
      "components/intake/OcrMatchResult.tsx",
      "components/orders/LabelPrintView.tsx",
      "modules/orders/legacy-ui/OrderActionGrid.tsx",
      "modules/orders/legacy-ui/LabelPrintView.tsx",
      "app/cockpit/components/AgingKachel.tsx",
      "app/cockpit/actions.ts",
    ]) expect(existsSync(path.join(root, file))).toBe(false);
    expect(events).not.toMatch(/localStorage|createId|Date\.|createStatusEvent|getRecentStatusEvents/);
  });
});
