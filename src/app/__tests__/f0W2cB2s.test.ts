import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import BetriebKvpPage from "@/app/betrieb-kvp/page";
import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

const root = process.cwd();
const source = (file: string) => readFileSync(resolve(root, file), "utf8");

const unavailablePages = [
  "src/app/performance/werkstatt-puls/page.tsx",
  "src/app/performance/umsatz-marge/page.tsx",
  "src/app/performance/kunden-markt/page.tsx",
  "src/app/performance/qualitaet-risiko/page.tsx",
  "src/app/performance/baeder-material/page.tsx",
  "src/app/today/page.tsx",
  "src/app/status/page.tsx",
  "src/app/baeder/page.tsx",
  "src/app/kontrolle/page.tsx",
  "src/app/analyse/page.tsx",
  "src/app/performance/page.tsx",
  "src/app/performance/ki-empfehlungen/page.tsx",
  "src/app/betrieb-kvp/page.tsx",
];

describe("F0 W2C-B2S page truth containment", () => {
  it.each(unavailablePages)("keeps %s a pure shared unavailable route", (file) => {
    const page = source(file);
    expect(page.match(/^import .+;$/gm)).toEqual(['import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";']);
    expect(page).toContain('export const dynamic = "force-dynamic";');
    expect(page).toContain("export const revalidate = 0;");
    expect(page).toMatch(/return <FoundationUnavailable \/>;/);
    expect(page).not.toMatch(/fetch\(|useEffect|Repository|actions|supabase|auftrag|termin|\d{4}|use client|features\/analyse|PerformanceCockpitClient|PerformanceDetailLayout|getAnalyseOverview|next\/link|useState|BetriebKvpClient|OfflineSyncBadge|FeedbackFooter|usePermissions|localStorage|IndexedDB/i);
  });

  it("renders Betrieb-KVP as the canonical shared denial without former claims", () => {
    const markup = renderToStaticMarkup(BetriebKvpPage());

    expect(markup).toBe(renderToStaticMarkup(FoundationUnavailable()));
    expect(markup).toContain("NOT_AVAILABLE");
    expect(markup).toContain("Operative Daten sind noch nicht verfügbar");
    expect(markup).toContain("Für diesen Bereich ist noch keine kanonische, quellgestützte operative Datenbasis verfügbar.");
    for (const formerClaim of [
      "Häufigste Kategorie",
      "Ordnung/Sauberkeit",
      "2 an Station",
      "Einträge",
      "Einreichen",
      "Detail-Report öffnen",
      "Gemerkt!",
      "Wieder Online",
      "Offline – Eingaben werden lokal gesichert",
    ]) expect(markup).not.toContain(formerClaim);
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
