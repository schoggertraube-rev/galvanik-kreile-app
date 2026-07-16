import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("communication foundation truth", () => {
  it("uses authorized server actions and polling instead of direct browser database subscriptions", () => {
    const client = source("src/app/kommunikation/KommunikationClient.tsx");
    expect(client).toContain("getRecentPhoneNotes");
    expect(client).toContain("getOrdersDb");
    expect(client).toContain("getCustomersDb");
    expect(client).toContain("setInterval(refresh, 30_000)");
    expect(client).toContain("visibilitychange");
    expect(client).not.toContain("supabase");
    expect(client).not.toContain("postgres_changes");
    expect(client).not.toContain("communication_messages");
  });

  it("preserves canonical parked/waiting statuses and checks mutation receipts", () => {
    const client = source("src/app/kommunikation/KommunikationClient.tsx");
    expect(client).toContain('status === "parked"');
    expect(client).toContain('status === "waiting_callback"');
    expect(client).toContain('status === "waiting_customer"');
    expect(client).toContain("if (!result.success)");
    expect(client).toContain("Daten nicht verfügbar");
    expect(client).not.toContain("catch(() =>");
  });

  it("does not expose fake send, attachment, payment, customer-age, or calendar actions", () => {
    const client = source("src/app/kommunikation/KommunikationClient.tsx");
    for (const fake of [
      "Alle anwenden",
      "Neue Nachricht (vorbereitet)",
      "Backend Aktion vorbereitet",
      "248 €",
      "Kunde seit 2018",
      "Slots frei",
      "frei ✓",
      "ReactivationGeneratorOverlay",
      "ContextAnalysisOverlay",
    ]) {
      expect(client).not.toContain(fake);
    }
    expect(client).toContain("noch nicht verbunden");
  });

  it("stores only the parked note id per browser session and resumes the same database row", () => {
    const context = source("src/contexts/ParkedCallContext.tsx");
    const desktop = source("src/components/telefonnotiz/TelefonnotizDesktop.tsx");
    expect(context).toContain("sessionStorage");
    expect(context).not.toContain("localStorage");
    expect(context).not.toContain("rawText");
    expect(context).not.toContain("matchedCustomerName");
    expect(desktop).toContain("getPhoneNoteById(resumeId)");
    expect(desktop).toContain("await updatePhoneNote(savedNoteId, noteData)");
    expect(desktop.match(/createPhoneNote\(/g)).toHaveLength(1);
  });
});
