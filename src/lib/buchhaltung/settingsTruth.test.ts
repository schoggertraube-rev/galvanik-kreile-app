import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFinanceSettingsInput, resolveOcrRuntimeStatus } from "./settingsContract";

const root = process.cwd();

describe("finance settings truth contract", () => {
  it("accepts the complete bounded settings payload", () => {
    expect(parseFinanceSettingsInput({
      standardKontenrahmen: "SKR04",
      ocrConfidenceSchwelle: 91,
      beraterNr: " 1234567 ",
      mandantenNr: "10001",
    })).toEqual({
      standardKontenrahmen: "SKR04",
      ocrConfidenceSchwelle: 91,
      beraterNr: "1234567",
      mandantenNr: "10001",
    });
  });

  it.each([
    null,
    {},
    { standardKontenrahmen: "SKR02", ocrConfidenceSchwelle: 85, beraterNr: null, mandantenNr: null },
    { standardKontenrahmen: "SKR03", ocrConfidenceSchwelle: 49, beraterNr: null, mandantenNr: null },
    { standardKontenrahmen: "SKR03", ocrConfidenceSchwelle: 85.5, beraterNr: null, mandantenNr: null },
    { standardKontenrahmen: "SKR03", ocrConfidenceSchwelle: 85, beraterNr: "12-A", mandantenNr: null },
    { standardKontenrahmen: "SKR03", ocrConfidenceSchwelle: 85, beraterNr: null, mandantenNr: null, hidden: true },
  ])("rejects malformed or over-posted input %#", (input) => {
    expect(() => parseFinanceSettingsInput(input)).toThrow("INVALID_FINANCE_SETTINGS");
  });

  it("reports OCR as ready only when provider and protected storage are configured", () => {
    expect(resolveOcrRuntimeStatus({
      KLIPPA_API_KEY: "secret",
      SUPABASE_URL: "https://example.test",
      SUPABASE_SERVICE_ROLE_KEY: "secret",
    })).toEqual({
      status: "configured",
      provider: "Klippa",
      storageConfigured: true,
      usageAccountingConfigured: false,
    });

    expect(resolveOcrRuntimeStatus({ GEMINI_API_KEY: "secret" })).toEqual({
      status: "not_configured",
      provider: "Gemini",
      storageConfigured: false,
      usageAccountingConfigured: false,
    });
  });

  it("persists profile and processing settings atomically with an audit receipt", () => {
    const action = readFileSync(join(root, "src/app/buchhaltung/einstellungen/actions.ts"), "utf8");
    expect(action).toContain("requireFinanceAdmin");
    expect(action).toContain("db.transaction");
    expect(action).toContain(".for(\"update\")");
    expect(action).toContain(".onConflictDoUpdate");
    expect(action).toContain(".insert(bhAuditLog)");
    expect(action).toContain("AUDIT_RECEIPT_MISSING");
  });

  it("does not expose a fake provider selector or claim unavailable integrations", () => {
    const client = readFileSync(join(root, "src/app/buchhaltung/einstellungen/EinstellungenClient.tsx"), "utf8");
    expect(client).not.toContain("Demo (Mock)");
    expect(client).not.toContain("wird vorbereitet");
    expect(client).toContain("Nicht angebunden");
    expect(client).toContain("updateFinanceSettingsAction");
    expect(client).toContain("Audit-ID");
  });
});
