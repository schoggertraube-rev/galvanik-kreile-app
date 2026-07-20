import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const section = (value: string, start: string, end: string) => {
  const startIndex = value.indexOf(start);
  const endIndex = value.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) throw new Error(`section not found: ${start} -> ${end}`);
  return value.slice(startIndex, endIndex);
};

describe("cockpit KPI truth", () => {
  it("derives current metrics from tenant-bound canonical ledgers", () => {
    const actionFile = source("src/app/cockpit/actions.ts");
    const actions = section(actionFile, "export async function getCockpitKpis", "export async function getTopKunden");

    expect(actions).toContain("const actor = await requireCustomerFinanceRead()");
    expect(actions).toContain("ar.tenant_id = ${actor.tenantId}");
    expect(actions).toContain("ab.tenant_id = ${actor.tenantId}");
    expect(actions).toContain("sm.tenant_id = ${actor.tenantId}");
    expect(actions).toContain("missing_monthly_net");
    expect(actions).toContain("missing_price_count");
    expect(actions).not.toContain(".from('v_aging')");
    expect(actions).not.toContain(".from('v_monatsergebnis')");
    expect(source("src/app/cockpit/page.tsx")).toContain('redirect("/performance")');
  });

  it("does not fabricate contribution scope, liquidity, source counts, or source rows", () => {
    const actions = source("src/app/cockpit/actions.ts");
    const tile = source("src/app/cockpit/components/KpiKachel.tsx");
    const provenance = source("src/components/analytics/DatenherkunftZeile.tsx");

    expect(actions).toContain("liquiditaet: null");
    expect(actions).toContain("dbScope:");
    expect(tile).toContain('value={data.liquiditaet ?? "Nicht angebunden"}');
    expect(tile).toContain("data.sourceCounts.rechnungen");
    expect(tile).not.toContain("rechnungen={62}");
    expect(tile).not.toContain("zeitbuchungen={1240}");
    expect(provenance).not.toContain(">System-Snapshot<");
    expect(provenance).not.toContain(">Heute<");
    expect(provenance).toContain("keine erfundenen Snapshot-Zeilen");
  });

  it("keeps the legacy what-if simulator fail-closed until its context is evidence-backed", () => {
    const actionFile = source("src/app/cockpit/actions.ts");
    const action = section(actionFile, "export async function getWhatIfKontext", "export async function getEngpassDetails");

    expect(action).toContain("await requireCustomerFinanceRead()");
    expect(action).toContain("throw new Error('WHAT_IF_CONTEXT_UNAVAILABLE')");
    expect(action).not.toContain("= 45");
    expect(action).not.toContain("v_auftrag_db");
    expect(action).not.toContain("v_kunde_clv");
  });
});
