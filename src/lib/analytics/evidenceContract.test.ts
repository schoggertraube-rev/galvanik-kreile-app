import { describe, expect, it } from "vitest";
import { claimEvidenceV1Schema, parseClaimEvidenceV1 } from "./evidenceContract";
import type { ClaimEvidenceV1, EvidenceRecordRefV1 } from "./evidenceContract";

const NOW = "2026-07-22T12:00:00.000Z";

function sourceRecord(overrides: Partial<EvidenceRecordRefV1> = {}): EvidenceRecordRefV1 {
  return {
    ref: "invoice:invoice-1",
    entityType: "invoice",
    entityId: "invoice-1",
    relation: "public.ausgangsrechnung",
    fieldRefs: ["id", "brutto", "datum"],
    recordedAt: "2026-07-15T09:00:00.000Z",
    contribution: 100,
    detail: {
      id: "invoice-detail:invoice-1",
      label: "Rechnung RE-1 öffnen",
      kind: "detail",
      entityType: "invoice",
      entityId: "invoice-1",
      enabled: true,
      href: "/buchhaltung/ausgangsrechnungen/invoice-1",
    },
    ...overrides,
  };
}

function readyEvidence(): ClaimEvidenceV1 {
  return {
    schemaVersion: 1,
    claim: {
      id: "accounting.revenue.net",
      label: "Umsatz netto",
      truthClass: "A",
      state: "ready",
      value: 100,
      unit: "EUR",
      formulaId: "accounting.revenue.net.v1",
      formulaVersion: 1,
      formula: "Summe der freigegebenen Ausgangsrechnungen im halboffenen Zeitraum.",
    },
    scope: {
      tenantId: "galvanik-kreile",
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-08-01T00:00:00.000Z",
      timezone: "Europe/Berlin",
      grain: "month",
      calculatedAt: NOW,
    },
    inputs: [{
      id: "released_invoices",
      label: "Freigegebene Ausgangsrechnungen",
      state: "ready",
      value: 100,
      unit: "EUR",
      sourceRefs: ["invoice:invoice-1"],
    }],
    sourceRecords: [sourceRecord()],
    coverage: { included: 1, excluded: 0, unresolved: 0, notes: [] },
    reconciliation: { method: "sum", tolerance: 0.01 },
    missing: [],
    linkedEntities: [{
      id: "invoice-link:invoice-1",
      label: "Rechnung RE-1",
      kind: "related",
      entityType: "invoice",
      entityId: "invoice-1",
      enabled: true,
      href: "/buchhaltung/ausgangsrechnungen/invoice-1",
    }],
  };
}

function missingEvidence(): ClaimEvidenceV1 {
  return {
    schemaVersion: 1,
    claim: {
      id: "energy.cost_per_kwh",
      label: "Energiekosten je kWh",
      truthClass: "E",
      state: "missing_input",
      value: null,
      unit: "EUR/kWh",
      formulaId: "energy.cost_per_kwh.v1",
      formulaVersion: 1,
      formula: "Energiekosten geteilt durch den bestätigten Verbrauch in kWh.",
    },
    scope: {
      tenantId: "galvanik-kreile",
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-08-01T00:00:00.000Z",
      timezone: "Europe/Berlin",
      grain: "month",
      calculatedAt: NOW,
    },
    inputs: [{
      id: "energy_kwh",
      label: "Verbrauch in kWh",
      state: "missing_input",
      value: null,
      unit: "kWh",
      sourceRefs: [],
    }],
    sourceRecords: [],
    coverage: { included: 0, excluded: 0, unresolved: 1, notes: ["kWh-Wert fehlt."] },
    reconciliation: { method: "none", tolerance: 0 },
    missing: [{
      inputId: "energy_kwh",
      reasonCode: "source_value_missing",
      description: "Auf der Stromrechnung ist noch kein bestätigter kWh-Wert zugeordnet.",
      captureOptions: [{
        mode: "manual_entry",
        status: "available",
        capabilityId: "KI-ENERGY-RESOURCE-001",
        action: {
          id: "capture-energy-kwh",
          label: "kWh erfassen",
          kind: "capture",
          enabled: true,
          href: "/buchhaltung/erfassung?field=energy_kwh",
          capabilityId: "KI-ENERGY-RESOURCE-001",
        },
      }],
    }],
    linkedEntities: [],
  };
}

describe("ClaimEvidenceV1", () => {
  it("preserves a measured zero as ready evidence", () => {
    const evidence = readyEvidence();
    evidence.claim.value = 0;
    evidence.inputs[0].value = 0;
    evidence.sourceRecords[0].contribution = 0;

    expect(parseClaimEvidenceV1(evidence).claim).toMatchObject({ state: "ready", value: 0 });
  });

  it("keeps missing values null and exposes a real capture path", () => {
    const parsed = parseClaimEvidenceV1(missingEvidence());

    expect(parsed.claim.value).toBeNull();
    expect(parsed.missing[0].captureOptions[0]).toMatchObject({ status: "available" });
    expect(parsed.missing[0].captureOptions[0].action?.href).toContain("energy_kwh");
  });

  it("rejects ready claims without formula, source, or a valid period", () => {
    const noFormula = readyEvidence();
    noFormula.claim.formula = "";
    expect(claimEvidenceV1Schema.safeParse(noFormula).success).toBe(false);

    const noSource = readyEvidence();
    noSource.sourceRecords = [];
    noSource.inputs[0].sourceRefs = [];
    expect(claimEvidenceV1Schema.safeParse(noSource).success).toBe(false);

    const invalidPeriod = readyEvidence();
    invalidPeriod.scope.to = invalidPeriod.scope.from;
    expect(claimEvidenceV1Schema.safeParse(invalidPeriod).success).toBe(false);
  });

  it("rejects aggregates that do not reconcile to their individual sources", () => {
    const evidence = readyEvidence();
    evidence.sourceRecords[0].contribution = 99;

    expect(claimEvidenceV1Schema.safeParse(evidence).success).toBe(false);
  });

  it("requires a comparison to carry its own period and evidence", () => {
    const evidence = readyEvidence();
    evidence.comparison = {
        mode: "previous_period",
        state: "ready",
        value: 80,
        unit: "EUR",
        scope: {
          tenantId: "galvanik-kreile",
          from: "2026-06-01T00:00:00.000Z",
          to: "2026-07-01T00:00:00.000Z",
          timezone: "Europe/Berlin",
          grain: "month",
          calculatedAt: NOW,
        },
        sourceRecords: [],
        coverage: { included: 1, excluded: 0, unresolved: 0, notes: [] },
        reconciliation: { method: "sum", tolerance: 0.01 },
      };

    expect(claimEvidenceV1Schema.safeParse(evidence).success).toBe(false);
  });

  it("does not allow hash links or clickable white-wall actions", () => {
    const hashLink = readyEvidence();
    hashLink.linkedEntities[0].href = "#";
    expect(claimEvidenceV1Schema.safeParse(hashLink).success).toBe(false);

    const fakeCapture = missingEvidence();
    fakeCapture.missing[0].captureOptions[0].status = "blocked";
    fakeCapture.missing[0].captureOptions[0].reason = "Der Connector ist noch nicht konfiguriert.";
    expect(claimEvidenceV1Schema.safeParse(fakeCapture).success).toBe(false);
  });

  it("requires hypotheses to disclose sources, assumptions, and confidence", () => {
    const evidence = readyEvidence();
    evidence.insight = {
        engine: { kind: "rules", name: "energy-rules", version: "1" },
        observations: [],
        hypotheses: [{
          id: "hypothesis.energy-price",
          text: "Der Preis könnte den Anstieg erklären.",
          sourceRefs: ["invoice:invoice-1"],
          assumptions: [],
          confidence: 0.5,
        }],
        recommendations: [],
      };

    expect(claimEvidenceV1Schema.safeParse(evidence).success).toBe(false);
  });

  it("requires AI model identity and an AI usage receipt", () => {
    const evidence = readyEvidence();
    evidence.insight = {
        engine: { kind: "ai", name: "decision-assistant", version: "1", model: "gpt-5" },
        observations: [{ id: "observation.1", text: "Umsatz ist belegt.", sourceRefs: ["invoice:invoice-1"] }],
        hypotheses: [],
        recommendations: [],
      };

    expect(claimEvidenceV1Schema.safeParse(evidence).success).toBe(false);
  });

  it("keeps recommendations pending until a durable action receipt exists", () => {
    const pending = readyEvidence();
    pending.insight = {
        engine: { kind: "rules", name: "finance-rules", version: "1" },
        observations: [{ id: "observation.1", text: "Eine Rechnung ist belegt.", sourceRefs: ["invoice:invoice-1"] }],
        hypotheses: [],
        recommendations: [{
          id: "recommendation.review",
          text: "Rechnung fachlich prüfen.",
          sourceRefs: ["invoice:invoice-1"],
          state: "pending_review",
          action: {
            id: "review-invoice",
            label: "Rechnung prüfen",
            kind: "action",
            enabled: true,
            href: "/buchhaltung/ausgangsrechnungen/invoice-1",
          },
        }],
      };
    expect(claimEvidenceV1Schema.safeParse(pending).success).toBe(true);

    const falselyExecuted = structuredClone(pending);
    falselyExecuted.insight!.recommendations[0].state = "executed";
    expect(claimEvidenceV1Schema.safeParse(falselyExecuted).success).toBe(false);
  });

  it("validates neighboring claims independently when one cross-KPI is missing", () => {
    const available = claimEvidenceV1Schema.safeParse(readyEvidence());
    const missing = claimEvidenceV1Schema.safeParse(missingEvidence());

    expect(available.success).toBe(true);
    expect(missing.success).toBe(true);
    if (available.success && missing.success) {
      expect(available.data.claim.value).toBe(100);
      expect(missing.data.claim.value).toBeNull();
    }
  });

  it("can expose a partial count without pretending all source rows were returned", () => {
    const evidence = readyEvidence();
    evidence.claim = {
      ...evidence.claim,
      id: "workshop.overdue_orders",
      label: "Überfällige offene Aufträge",
      state: "partial",
      value: 3,
      unit: "orders",
      formulaId: "workshop.overdue_orders.v1",
      formula: "Anzahl offener Aufträge mit überschrittenem bestätigtem Zusagetermin.",
    };
    evidence.inputs = [{
      id: "overdue_orders",
      label: "Überfällige Aufträge",
      state: "partial",
      value: 3,
      unit: "orders",
      sourceRefs: ["invoice:invoice-1"],
    }];
    evidence.sourceRecords = [sourceRecord({ contribution: 1 })];
    evidence.coverage = { included: 3, excluded: 0, unresolved: 2, notes: ["Detailausgabe ist begrenzt."] };
    evidence.reconciliation = { method: "count", tolerance: 0 };
    evidence.missing = [{
      inputId: "overdue_orders",
      reasonCode: "detail_limit",
      description: "Zwei Datensätze sind im Zähler enthalten, aber noch nicht als Einzelquelle ausgeliefert.",
      captureOptions: [{
        mode: "source_record",
        status: "blocked",
        capabilityId: "KI-DECISION-ANALYTICS-001",
        reason: "Die Detailabfrage ist auf eine Quelle begrenzt.",
      }],
    }];

    expect(claimEvidenceV1Schema.safeParse(evidence).success).toBe(true);
  });
});
