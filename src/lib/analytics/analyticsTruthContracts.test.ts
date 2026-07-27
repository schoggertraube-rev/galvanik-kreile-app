import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");
const section = (value: string, start: string, end: string) => {
  const startIndex = value.indexOf(start);
  const endIndex = value.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`section not found: ${start} -> ${end}`);
  }
  return value.slice(startIndex, endIndex);
};

describe("analytics truth contracts", () => {
  it("preserves view prefixes, appends tenant identity, and disables invented forecasts", () => {
    const migration = source(
      "supabase/migrations/20260715001660_analytics_truth_contracts_prepared_unapplied.sql",
    );
    const pipeline = section(
      migration,
      "CREATE OR REPLACE VIEW public.v_pipeline_forecast",
      "CREATE OR REPLACE VIEW public.v_periodenabschluss_status",
    );

    expect(migration).toContain("customer.tenant_id AS tenant_id");
    expect(migration).toContain("period.tenant_id AS tenant_id");
    expect(migration).toContain("END AS puenklichkeit_pct");
    expect(migration).toContain("bezahlt_betrag_eur");
    expect(migration).toContain("greatest(brutto - coalesce(bezahlt_betrag_eur, 0), 0)");
    expect(pipeline).toContain("NULL::date AS erwarteter_monat");
    expect(pipeline).toContain("NULL::text AS tenant_id");
    expect(pipeline).toContain("WHERE false");
    expect(pipeline).not.toMatch(/0\.80|0\.60|0\.30|0\.10/);
    expect(migration).not.toMatch(
      /GRANT SELECT ON TABLE[\s\S]*public\.v_pipeline_forecast[\s\S]*TO service_role/,
    );
    expect(migration).toContain(
      "REVOKE ALL PRIVILEGES ON FUNCTION public.fn_compute_warnings(text)",
    );
  });

  it("uses authorized tenant-bound SQL readers and fails closed for missing capabilities", () => {
    const cockpit = source("src/app/cockpit/actions.ts");
    const topCustomers = section(
      cockpit,
      "export async function getTopKunden",
      "export async function getInaktiveKunden",
    );
    const inactiveCustomers = section(
      cockpit,
      "export async function getInaktiveKunden",
      "export async function getEngpassDaten",
    );
    const forecast = section(
      cockpit,
      "export async function getForecastDaten",
      "export async function getKundenDetails",
    );
    const details = section(
      cockpit,
      "export async function getKundenDetails",
      "export async function getAgingRechnungen",
    );
    const warnings = section(
      cockpit,
      "export async function refreshWarnungen",
      "export async function getAktiverJahresplan",
    );

    for (const reader of [topCustomers, inactiveCustomers, details]) {
      expect(reader).toContain("tenant_id = ${actor.tenantId}");
      expect(reader).not.toContain(".from('v_kunde_clv')");
      expect(reader).not.toContain("select *");
    }
    expect(topCustomers).toContain("order by db_gesamt desc nulls last, customer_id");
    expect(forecast).toContain("await requireCustomerFinanceRead()");
    expect(forecast).toContain("FORECAST_NOT_CONFIGURED");
    expect(forecast).toContain("Promise<ForecastResult>");
    expect(forecast).toContain("status: 'not_configured'");
    expect(warnings).toContain("await requireCustomerFinanceRead()");
    expect(warnings).toContain("WARNING_RECOMPUTE_NOT_CONFIGURED");
    expect(warnings).not.toContain(".rpc(");
  });

  it("renders unavailable forecast and savings as explicit missing states", () => {
    const forecastTile = source("src/app/cockpit/components/ForecastKachel.tsx");
    const roiTile = source("src/app/buchhaltung/components/RoiKachel.tsx");
    const financeAnalysis = source("src/app/buchhaltung/analysis.actions.ts");
    const overlay = source("src/components/ui/AnalysisOverlay.tsx");
    const hero = source("src/app/buchhaltung/components/HeroBand.tsx");

    expect(forecastTile).toContain("useState<ForecastData | null>");
    expect(forecastTile).toContain('res.status === "not_configured"');
    expect(forecastTile).toContain("Forecast nicht konfiguriert");
    expect(forecastTile).toContain("Forecast nicht geladen");
    expect(forecastTile).not.toMatch(/80%|60%|30%|10%/);
    expect(forecastTile).not.toMatch(/data\.plan\[[^\]]+\]\s*\|\|\s*0/);
    expect(forecastTile).not.toContain("umsatz: 0,");
    expect(roiTile).toContain("OCR-Confidence allein ist kein Nachweis");
    expect(roiTile).toContain("isEmpty");
    expect(roiTile).not.toContain("datenherkunft=");
    expect(roiTile).not.toContain("ersparnisBetrag");
    expect(financeAnalysis).toContain("Promise<FinanceSavingsAnalysisResult>");
    expect(financeAnalysis).toContain("state: 'not_evidenced'");
    expect(financeAnalysis).toContain("FINANCE_SAVINGS_NOT_EVIDENCED");
    expect(financeAnalysis).not.toContain("normalizeOcrConfidencePercent");
    expect(overlay).toContain("isEmpty && emptyState");
    expect(overlay).toContain("!isEmpty && hero");
    expect(hero).toContain("Zeitersparnis nicht durch gespeicherte Arbeitszeitbelege");
    expect(hero).not.toContain("provider.getErsparnis");
    expect(hero).not.toContain("Modellierter Zeitwert");
  });

  it("uses remaining receivables and rejects fabricated finance provenance", () => {
    const analytics = source("src/lib/analytics/analyticsDataService.ts");
    const openReceivables = section(
      analytics,
      "async function assembleOffenePosten",
      "async function assembleTermintreue",
    );
    const financeActions = source("src/app/buchhaltung/actions.ts");
    const l7 = financeActions.slice(financeActions.indexOf("export async function getL7Daten"));

    expect(openReceivables).toContain("p.offenerBetrag");
    expect(openReceivables).not.toContain("p.brutto");
    expect(l7).toContain("await requireFinanceRead()");
    expect(l7).toContain("FINANCE_PROVENANCE_NOT_CONFIGURED");
    expect(l7).not.toContain("v_periodenabschluss_status");
    expect(l7).not.toContain("Aktueller Monat (offen)");
  });
});
