import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

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
];

describe("F0 W2C-B2S page truth containment", () => {
  it.each(unavailablePages)("keeps %s a pure shared unavailable route", (file) => {
    const page = source(file);
    expect(page.match(/^import .+;$/gm)).toEqual(['import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";']);
    expect(page).toContain('export const dynamic = "force-dynamic";');
    expect(page).toContain("export const revalidate = 0;");
    expect(page).toMatch(/return <FoundationUnavailable \/>;/);
    expect(page).not.toMatch(/fetch\(|useEffect|Repository|actions|supabase|auftrag|termin|\d{4}/i);
  });

  it("keeps the root on its view-backed overview path without fabricated decorations", () => {
    expect(source("src/app/performance/page.tsx")).toContain("getAnalyseOverview");
    expect(source("src/features/analyse/analyse.actions.ts")).toContain("v_analyse");
    const rootClient = source("src/app/performance/PerformanceCockpitClient.tsx");
    expect(rootClient).toContain("NOT_AVAILABLE");
    expect(rootClient).toContain("DEMO");
    expect(rootClient).not.toMatch(/Mai 2026|09:14|22 Werktage|5 MA|6 TIPPS/);
    expect(source("src/app/performance/components/UmsatzMargeKachel.tsx")).not.toContain("M0,22 L16,19");
    expect(source("src/app/performance/components/KundenMarktKachel.tsx")).not.toMatch(/82% Abholung|18% Versand|3 Länder/);
  });

  it("keeps the drill period equal to the root overview period without period or comparison controls", () => {
    const rootPage = source("src/app/performance/page.tsx");
    const rootClient = source("src/app/performance/PerformanceCockpitClient.tsx");
    const rootPeriod = rootPage.match(/getAnalyseOverview\("([^"]+)"\)/)?.[1];
    const drillPeriod = rootClient.match(/<AnalyseDrillOverlay[\s\S]*?period="([^"]+)"/)?.[1];

    expect(rootPeriod).toBe("Monat");
    expect(drillPeriod).toBe(rootPeriod);
    expect(drillPeriod).not.toBe("NOT_AVAILABLE");
    expect(rootClient).not.toContain('period="NOT_AVAILABLE"');
    expect(rootClient).not.toMatch(/\b(?:tab|cmpOn|cmpPer|setTab|setCmpOn|setCmpPer)\b/);
    expect(rootClient).not.toMatch(/(?:className=\{`(?:tabb|cmp-btn|cmp-opt)|Woche|Quartal|Jahr|vorwoche|vormonat|vorquartal|vorjahr|Vergleich:|Zeig mir die Veränderungen zu)/i);
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

const quarantined = ["customer-enrich", "email-send", "freetext-extract", "inquiry-extract", "item-photo-analyze", "kpi-insight", "mollie-create-payment", "notes-extract", "payments-intent", "scan-analyze"];
const webhookCandidates = ["email-webhook", "mollie-webhook", "payments-webhook-mollie"];

describe("F0 W2C-B2S Edge source containment", () => {
  it("keeps the exact local inventory and quarantines only the ten named entrypoints", () => {
    expect(readdirSync(resolve(root, "supabase/functions"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()).toEqual(["_shared", ...quarantined, ...webhookCandidates].sort());
    for (const name of quarantined) {
      const entry = source(`supabase/functions/${name}/index.ts`);
      expect(entry).toBe('import { serve } from "https://deno.land/std@0.224.0/http/server.ts";\nimport { notAvailableResponse } from "../_shared/notAvailable.ts";\n\nserve(() => notAvailableResponse());\n');
      expect(entry).not.toMatch(/req\.|\.json\(|\.text\(|Deno\.env|createClient|fetch\(|Access-Control-Allow-Origin|\*/);
    }
  });

  it("defines the exact non-cacheable 503 JSON helper and leaves webhook candidates byte-unchanged", () => {
    const helper = source("supabase/functions/_shared/notAvailable.ts");
    expect(helper).toContain('JSON.stringify({ error: "NOT_AVAILABLE" })');
    expect(helper).toContain("status: 503");
    expect(helper).toContain('"Content-Type": "application/json"');
    expect(helper).toContain('"Cache-Control": "no-store"');
    for (const name of webhookCandidates) {
      expect(() => execFileSync("git", ["diff", "--quiet", "HEAD", "--", `supabase/functions/${name}/index.ts`], { cwd: root, stdio: "ignore" })).not.toThrow();
    }
  });
});
