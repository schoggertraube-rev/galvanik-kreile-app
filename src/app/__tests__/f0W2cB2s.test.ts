import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const root = process.cwd();
const source = (file: string) => readFileSync(resolve(root, file), "utf8");

const retiredPageEntrypoints = [
  "src/app/analyse/page.tsx",
  "src/app/archive/page.tsx",
  "src/app/baeder/page.tsx",
  "src/app/betrieb-kvp/page.tsx",
  "src/app/betrieb/page.tsx",
  "src/app/buchhaltung/ausgaben/page.tsx",
  "src/app/buchhaltung/belege/[id]/page.tsx",
  "src/app/buchhaltung/belege/neu/page.tsx",
  "src/app/buchhaltung/belege/page.tsx",
  "src/app/buchhaltung/bwa/page.tsx",
  "src/app/buchhaltung/einstellungen/page.tsx",
  "src/app/buchhaltung/export/page.tsx",
  "src/app/buchhaltung/fristen/page.tsx",
  "src/app/buchhaltung/kosten/[id]/page.tsx",
  "src/app/buchhaltung/kosten/neu/page.tsx",
  "src/app/buchhaltung/kosten/page.tsx",
  "src/app/buchhaltung/kraftstoff/page.tsx",
  "src/app/buchhaltung/periodenabschluss/page.tsx",
  "src/app/buchhaltung/rechnungen/[id]/page.tsx",
  "src/app/buchhaltung/rechnungen/neu/page.tsx",
  "src/app/buchhaltung/steuerprofil/page.tsx",
  "src/app/cockpit/jahresplan/page.tsx",
  "src/app/cockpit/page.tsx",
  "src/app/feedback/[token]/page.tsx",
  "src/app/finanzen/page.tsx",
  "src/app/items/page.tsx",
  "src/app/kalender/page.tsx",
  "src/app/kommunikation/page.tsx",
  "src/app/kontrolle/page.tsx",
  "src/app/kunden-auftraege/page.tsx",
  "src/app/kvp/page.tsx",
  "src/app/lager/page.tsx",
  "src/app/lieferanten/[id]/page.tsx",
  "src/app/lieferanten/page.tsx",
  "src/app/marketing/aktion/neu/page.tsx",
  "src/app/marketing/aktion/page.tsx",
  "src/app/marketing/attribution/page.tsx",
  "src/app/marketing/einwilligungen/page.tsx",
  "src/app/marketing/kanaele/page.tsx",
  "src/app/marketing/page.tsx",
  "src/app/marketing/segmente/[id]/page.tsx",
  "src/app/marketing/segmente/neu/page.tsx",
  "src/app/marketing/segmente/page.tsx",
  "src/app/performance/baeder-material/page.tsx",
  "src/app/performance/ki-empfehlungen/page.tsx",
  "src/app/performance/kunden-markt/page.tsx",
  "src/app/performance/page.tsx",
  "src/app/performance/qualitaet-risiko/page.tsx",
  "src/app/performance/umsatz-marge/page.tsx",
  "src/app/performance/werkstatt-puls/page.tsx",
  "src/app/print-queue/page.tsx",
  "src/app/scan/page.tsx",
  "src/app/status/page.tsx",
  "src/app/telefonnotiz/page.tsx",
  "src/app/today/page.tsx",
] as const;

describe("F0 W2C-B2S page truth containment", () => {
  it("keeps the complete canonical retired/quarantined route matrix sorted and unique", () => {
    expect(retiredPageEntrypoints).toEqual([...retiredPageEntrypoints].sort());
    expect(new Set(retiredPageEntrypoints).size).toBe(retiredPageEntrypoints.length);
    expect(retiredPageEntrypoints).toHaveLength(55);
  });

  it.each(retiredPageEntrypoints)("keeps %s physically absent so direct URLs resolve to Next 404", (file) => {
    expect(existsSync(resolve(root, file))).toBe(false);
  });
});

describe("F0 W2C-B2S local provider denials", () => {
  it("denies risk orders before database and revalidation effects", async () => {
    const select = vi.fn();
    const revalidatePath = vi.fn();
    vi.doMock("@/db", () => ({ db: { select } }));
    vi.doMock("next/cache", () => ({ revalidatePath }));
    const { getRiskOrders } = await import("@/app/actions/orders.actions");
    await expect(getRiskOrders()).resolves.toMatchObject({ ok: false, error: "NOT_AVAILABLE" });
    expect(select).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps KI and browser provider adapters locally denied with no callable provider port", async () => {
    const [ki, mollie, resend] = [
      source("src/features/analyse/hooks/useKiInsight.ts"),
      source("src/lib/payments/mollieAdapter.ts"),
      source("src/lib/email/resendAdapter.ts"),
    ];
    for (const file of [ki, mollie, resend]) expect(file).not.toMatch(/functions\.invoke|fetch\(|supabase\/client/);
    const { MollieAdapter } = await import("@/lib/payments/mollieAdapter");
    const { ResendAdapter } = await import("@/lib/email/resendAdapter");
    await expect(new MollieAdapter().createPaymentIntent({ amount: 1, currency: "EUR", description: "test" } as never)).resolves.toMatchObject({ success: false, error: expect.stringContaining("NOT_AVAILABLE") });
    await expect(new ResendAdapter().send({ to: "test@example.invalid", subject: "test", html: "test" } as never)).resolves.toMatchObject({ success: false, error: expect.stringContaining("NOT_AVAILABLE") });
    expect(ki).toContain("isLoading: false");
    expect(ki).toContain("NOT_AVAILABLE");
  });
});

const quarantined = ["customer-enrich", "email-send", "email-webhook", "freetext-extract", "inquiry-extract", "item-photo-analyze", "kpi-insight", "mollie-create-payment", "mollie-webhook", "notes-extract", "payments-intent", "payments-webhook-mollie", "scan-analyze"];
const exactQuarantinedSource = 'import { serve } from "https://deno.land/std@0.224.0/http/server.ts";\nimport { notAvailableResponse } from "../_shared/notAvailable.ts";\n\nserve(() => notAvailableResponse());\n';
const sideEffectTokens = [
  "request",
  "req",
  "body",
  "secret",
  "key-secret",
  "key_secret",
  "deno.env",
  "client",
  "createclient",
  "provider",
  "supabase",
  ".from(",
  "db.",
  "drizzle",
  "fetch(",
  "invoke(",
  ".json(",
  ".text(",
  ".formdata(",
  ".insert(",
  ".update(",
  ".upsert(",
  ".delete(",
  ".rpc(",
  ".mutate(",
  "access-control-allow-origin",
  "cors",
];

describe("F0 W2C-B2S Edge source containment", () => {
  it("keeps the exact local inventory and quarantines all thirteen named entrypoints", () => {
    expect(readdirSync(resolve(root, "supabase/functions"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()).toEqual(["_shared", ...quarantined].sort());
    for (const name of quarantined) {
      const entry = source(`supabase/functions/${name}/index.ts`).replace(/\r\n/g, "\n");
      expect(entry).toBe(exactQuarantinedSource);
      const normalizedEntry = entry.toLowerCase();
      for (const token of sideEffectTokens) expect(normalizedEntry).not.toContain(token);
    }
  });

  it("defines the exact non-cacheable 503 JSON helper", () => {
    const helper = source("supabase/functions/_shared/notAvailable.ts");
    expect(helper).toContain('JSON.stringify({ error: "NOT_AVAILABLE" })');
    expect(helper).toContain("status: 503");
    expect(helper).toContain('"Content-Type": "application/json"');
    expect(helper).toContain('"Cache-Control": "no-store"');
  });
});
