import {
  parseClaimEvidenceV1,
  type ClaimEvidenceV1,
  type EvidenceRecordRefV1,
} from "@/lib/analytics/evidenceContract";

const ANALYTICS_CAPABILITY = "KI-DECISION-ANALYTICS-001";

type PeriodGrain = "day" | "week" | "month";

export type WorkshopEvidenceOrder = {
  id: string;
  orderNumber: string;
  title: string;
  createdAt: Date | string;
  intakeDate: Date | string | null;
  completedDate: Date | string | null;
  promisedDueDate: Date | string | null;
  station: string;
  active: boolean;
  completedInPeriod: boolean;
};

export type WorkshopEvidenceSnapshot = {
  tenantId: string;
  period: {
    start: Date | string;
    end: Date | string;
    grain: PeriodGrain;
  };
  calculatedAt: Date | string;
  now: Date | string;
  returnTo: string;
  rows: WorkshopEvidenceOrder[];
  totals: {
    completed: number;
    completedWithDueDate: number;
    deliveredOnTime: number;
    completedWithCycleTime: number;
    averageCycleDays: number | null;
    deliveryReliabilityPct: number | null;
    open: number;
    overdue: number;
    openWithoutDueDate: number;
  };
  stations: Array<{ station: string; count: number }>;
};

type CountClaimDefinition = {
  id: string;
  label: string;
  formulaId: string;
  formula: string;
  inputId: string;
  inputLabel: string;
  rows: WorkshopEvidenceOrder[];
  total: number;
  scopeMode: "period" | "snapshot";
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function periodScope(snapshot: WorkshopEvidenceSnapshot) {
  return {
    tenantId: snapshot.tenantId,
    from: iso(snapshot.period.start),
    to: iso(snapshot.period.end),
    timezone: "Europe/Berlin",
    grain: snapshot.period.grain,
    calculatedAt: iso(snapshot.calculatedAt),
  } as const;
}

function currentSnapshotScope(snapshot: WorkshopEvidenceSnapshot) {
  const snapshotAt = iso(snapshot.now);
  return {
    tenantId: snapshot.tenantId,
    from: snapshotAt,
    to: snapshotAt,
    timezone: "Europe/Berlin",
    grain: "snapshot",
    calculatedAt: iso(snapshot.calculatedAt),
  } as const;
}

function detailLink(row: WorkshopEvidenceOrder, returnTo: string) {
  return {
    id: `order-detail:${row.id}`,
    label: `${row.orderNumber} · ${row.title}`,
    kind: "detail" as const,
    entityType: "order",
    entityId: row.id,
    enabled: true,
    href: `/orders/${encodeURIComponent(row.id)}?returnTo=${encodeURIComponent(returnTo)}`,
  };
}

function orderRecord(
  row: WorkshopEvidenceOrder,
  returnTo: string,
  fieldRefs: string[],
  contribution: number | null,
): EvidenceRecordRefV1 {
  return {
    ref: `order:${row.id}`,
    entityType: "order",
    entityId: row.id,
    relation: "public.orders",
    fieldRefs,
    recordedAt: iso(row.completedDate ?? row.intakeDate ?? row.createdAt),
    contribution,
    detail: detailLink(row, returnTo),
  };
}

function detailLimitMissing(inputId: string, unresolved: number) {
  return [{
    inputId,
    reasonCode: "detail_receipt_limit",
    description: `${unresolved} einbezogene Auftragsdatensätze liegen außerhalb der begrenzten Detailausgabe.`,
    captureOptions: [{
      mode: "source_record" as const,
      status: "blocked" as const,
      capabilityId: ANALYTICS_CAPABILITY,
      reason: "Die Einzelbeleg-Ausgabe ist begrenzt; der Aggregatwert bleibt als partiell gekennzeichnet.",
    }],
  }];
}

function countClaim(snapshot: WorkshopEvidenceSnapshot, definition: CountClaimDefinition): ClaimEvidenceV1 {
  const records = definition.rows.map((row) => orderRecord(
    row,
    snapshot.returnTo,
    ["id", "order_number", "status", "created_at", "completed_date", "promised_due_date", "current_station_id"],
    1,
  ));
  const unresolved = Math.max(0, definition.total - records.length);
  const state = definition.total === 0 ? "confirmed_empty" : unresolved > 0 ? "partial" : "ready";

  return parseClaimEvidenceV1({
    schemaVersion: 1,
    claim: {
      id: definition.id,
      label: definition.label,
      truthClass: "B",
      state,
      value: definition.total,
      unit: "orders",
      formulaId: definition.formulaId,
      formulaVersion: 1,
      formula: definition.formula,
    },
    scope: definition.scopeMode === "snapshot" ? currentSnapshotScope(snapshot) : periodScope(snapshot),
    inputs: [{
      id: definition.inputId,
      label: definition.inputLabel,
      state,
      value: definition.total,
      unit: "orders",
      sourceRefs: records.map((record) => record.ref),
    }],
    sourceRecords: records,
    coverage: {
      included: definition.total,
      excluded: 0,
      unresolved,
      notes: unresolved > 0 ? ["Der Zähler umfasst mehr Aufträge als die begrenzte Detailausgabe."] : [],
    },
    reconciliation: { method: "count", tolerance: 0 },
    missing: unresolved > 0 ? detailLimitMissing(definition.inputId, unresolved) : [],
    linkedEntities: records.map((record) => record.detail),
  });
}

function missingMetricClaim(
  snapshot: WorkshopEvidenceSnapshot,
  definition: {
    id: string;
    label: string;
    unit: string;
    formulaId: string;
    formula: string;
    inputId: string;
    inputLabel: string;
    reasonCode: string;
    reason: string;
    captureBlockedReason: string;
    rows: WorkshopEvidenceOrder[];
    fields: string[];
  },
): ClaimEvidenceV1 {
  const records = definition.rows.map((row) => orderRecord(row, snapshot.returnTo, definition.fields, null));
  return parseClaimEvidenceV1({
    schemaVersion: 1,
    claim: {
      id: definition.id,
      label: definition.label,
      truthClass: "E",
      state: "missing_input",
      value: null,
      unit: definition.unit,
      formulaId: definition.formulaId,
      formulaVersion: 1,
      formula: definition.formula,
    },
    scope: periodScope(snapshot),
    inputs: [{
      id: definition.inputId,
      label: definition.inputLabel,
      state: "missing_input",
      value: null,
      unit: "orders",
      sourceRefs: records.map((record) => record.ref),
    }],
    sourceRecords: records,
    coverage: {
      included: 0,
      excluded: 0,
      unresolved: Math.max(1, definition.rows.length),
      notes: [definition.reason],
    },
    reconciliation: { method: "none", tolerance: 0 },
    missing: [{
      inputId: definition.inputId,
      reasonCode: definition.reasonCode,
      description: definition.reason,
      captureOptions: [{
        mode: "source_record",
        status: "blocked",
        capabilityId: ANALYTICS_CAPABILITY,
        reason: definition.captureBlockedReason,
        action: {
          id: `capture:${definition.inputId}`,
          label: "Betroffene Aufträge prüfen",
          kind: "capture",
          enabled: false,
          disabledReason: definition.captureBlockedReason,
          capabilityId: ANALYTICS_CAPABILITY,
        },
      }],
    }],
    linkedEntities: records.map((record) => record.detail),
  });
}

function ratioOrAverageClaim(
  snapshot: WorkshopEvidenceSnapshot,
  definition: {
    id: string;
    label: string;
    unit: string;
    formulaId: string;
    formula: string;
    inputId: string;
    inputLabel: string;
    value: number | null;
    denominator: number;
    excluded: number;
    rows: WorkshopEvidenceOrder[];
    fields: string[];
    contribution: (row: WorkshopEvidenceOrder) => number | null;
    missingReasonCode: string;
    missingReason: string;
    captureBlockedReason: string;
    reconciliationMethod: "ratio_percent" | "average";
  },
): ClaimEvidenceV1 {
  if (definition.denominator === 0 || definition.value === null) {
    return missingMetricClaim(snapshot, {
      ...definition,
      rows: snapshot.rows.filter((row) => row.completedInPeriod),
      reasonCode: definition.missingReasonCode,
      reason: definition.missingReason,
    });
  }

  const records = definition.rows.map((row) => orderRecord(
    row,
    snapshot.returnTo,
    definition.fields,
    definition.contribution(row),
  ));
  const unresolved = Math.max(0, definition.denominator - records.length);
  const state = unresolved > 0 ? "partial" : "ready";

  return parseClaimEvidenceV1({
    schemaVersion: 1,
    claim: {
      id: definition.id,
      label: definition.label,
      truthClass: "B",
      state,
      value: definition.value,
      unit: definition.unit,
      formulaId: definition.formulaId,
      formulaVersion: 1,
      formula: definition.formula,
    },
    scope: periodScope(snapshot),
    inputs: [{
      id: definition.inputId,
      label: definition.inputLabel,
      state,
      value: definition.denominator,
      unit: "orders",
      sourceRefs: records.map((record) => record.ref),
    }],
    sourceRecords: records,
    coverage: {
      included: definition.denominator,
      excluded: definition.excluded,
      unresolved,
      notes: unresolved > 0 ? ["Einbezogene Aufträge außerhalb der begrenzten Detailausgabe sind noch nicht einzeln ausgeliefert."] : [],
    },
    reconciliation: state === "partial"
      ? { method: "none", tolerance: 0 }
      : {
          method: definition.reconciliationMethod,
          tolerance: 1e-9,
          decimals: 1,
          denominator: definition.denominator,
        },
    missing: unresolved > 0 ? detailLimitMissing(definition.inputId, unresolved) : [],
    linkedEntities: records.map((record) => record.detail),
  });
}

export function buildWorkshopEvidence(snapshot: WorkshopEvidenceSnapshot): ClaimEvidenceV1[] {
  const completedRows = snapshot.rows.filter((row) => row.completedInPeriod);
  const activeRows = snapshot.rows.filter((row) => row.active);
  const completedWithDueDate = completedRows.filter((row) => row.promisedDueDate !== null);
  const completedWithCycleTime = completedRows.filter((row) => (
    row.intakeDate !== null
    && row.completedDate !== null
    && new Date(row.completedDate).getTime() >= new Date(row.intakeDate).getTime()
  ));
  const now = new Date(snapshot.now).getTime();
  const overdueRows = activeRows.filter((row) => row.promisedDueDate !== null && new Date(row.promisedDueDate).getTime() < now);
  const withoutDueDateRows = activeRows.filter((row) => row.promisedDueDate === null);

  const evidence: ClaimEvidenceV1[] = [
    ratioOrAverageClaim(snapshot, {
      id: "workshop.delivery_reliability",
      label: "Termintreue",
      unit: "percent",
      formulaId: "workshop.delivery_reliability.v1",
      formula: "Pünktlich abgeschlossene Aufträge geteilt durch alle im Zeitraum abgeschlossenen Aufträge mit explizitem Zusagetermin.",
      inputId: "completed_orders_with_promised_due_date",
      inputLabel: "Abschlüsse mit Zusagetermin",
      value: snapshot.totals.deliveryReliabilityPct,
      denominator: snapshot.totals.completedWithDueDate,
      excluded: Math.max(0, snapshot.totals.completed - snapshot.totals.completedWithDueDate),
      rows: completedWithDueDate,
      fields: ["id", "order_number", "completed_date", "promised_due_date"],
      contribution: (row) => row.completedDate && row.promisedDueDate
        ? (new Date(row.completedDate).getTime() <= new Date(row.promisedDueDate).getTime() ? 1 : 0)
        : null,
      missingReasonCode: "promised_due_date_missing",
      captureBlockedReason: "Kein direkt erreichbarer und berechtigungsgepruefter Zusagetermin-Editor ist im aktiven Auftragsdetail verbunden.",
      reconciliationMethod: "ratio_percent",
      missingReason: "Ohne abgeschlossene Aufträge mit explizitem Zusagetermin ist Termintreue nicht berechenbar.",
    }),
    ratioOrAverageClaim(snapshot, {
      id: "workshop.average_cycle_days",
      label: "Durchschnittliche Durchlaufzeit",
      unit: "days",
      formulaId: "workshop.average_cycle_days.v1",
      formula: "Durchschnitt der Kalendertage zwischen bestätigtem Auftragseingang und Abschluss im halboffenen Zeitraum.",
      inputId: "completed_orders_with_intake_date",
      inputLabel: "Abschlüsse mit Eingangszeit",
      value: snapshot.totals.averageCycleDays,
      denominator: snapshot.totals.completedWithCycleTime,
      excluded: Math.max(0, snapshot.totals.completed - snapshot.totals.completedWithCycleTime),
      rows: completedWithCycleTime,
      fields: ["id", "order_number", "intake_date", "completed_date"],
      contribution: (row) => row.completedDate && row.intakeDate
        ? (new Date(row.completedDate).getTime() - new Date(row.intakeDate).getTime()) / 86_400_000
        : null,
      missingReasonCode: "intake_date_missing",
      captureBlockedReason: "Fuer die bestaetigte Eingangszeit existiert noch kein auditierter Korrekturworkflow.",
      reconciliationMethod: "average",
      missingReason: "Ohne abgeschlossene Aufträge mit bestätigter Eingangszeit ist die Durchlaufzeit nicht berechenbar.",
    }),
    countClaim(snapshot, {
      id: "workshop.completed_orders",
      label: "Abgeschlossene Aufträge im Zeitraum",
      formulaId: "workshop.completed_orders.v1",
      formula: "Anzahl produktiver Aufträge mit Abschlusszeit im halboffenen Zeitraum.",
      inputId: "completed_orders",
      inputLabel: "Abgeschlossene Aufträge",
      rows: completedRows,
      total: snapshot.totals.completed,
      scopeMode: "period",
    }),
    countClaim(snapshot, {
      id: "workshop.open_orders",
      label: "Offene Aufträge",
      formulaId: "workshop.open_orders.v1",
      formula: "Anzahl produktiver, nicht abgeschlossener und nicht stornierter Aufträge zum Berechnungszeitpunkt.",
      inputId: "open_orders",
      inputLabel: "Offene Aufträge",
      rows: activeRows,
      total: snapshot.totals.open,
      scopeMode: "snapshot",
    }),
    countClaim(snapshot, {
      id: "workshop.overdue_orders",
      label: "Überfällige offene Aufträge",
      formulaId: "workshop.overdue_orders.v1",
      formula: "Anzahl offener Aufträge mit explizitem Zusagetermin vor dem Berechnungszeitpunkt.",
      inputId: "overdue_orders",
      inputLabel: "Überfällige offene Aufträge",
      rows: overdueRows,
      total: snapshot.totals.overdue,
      scopeMode: "snapshot",
    }),
    countClaim(snapshot, {
      id: "workshop.open_orders_without_due_date",
      label: "Offene Aufträge ohne Zusagetermin",
      formulaId: "workshop.open_orders_without_due_date.v1",
      formula: "Anzahl offener Aufträge ohne expliziten Kundenzusagetermin.",
      inputId: "open_orders_without_due_date",
      inputLabel: "Offene Aufträge ohne Zusagetermin",
      rows: withoutDueDateRows,
      total: snapshot.totals.openWithoutDueDate,
      scopeMode: "snapshot",
    }),
  ];

  snapshot.stations.forEach((station, index) => {
    const stationRows = activeRows.filter((row) => row.station === station.station);
    const stationKey = station.station
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unassigned";
    evidence.push(countClaim(snapshot, {
      id: `workshop.station.${index}-${stationKey}.open_orders`,
      label: `Offene Aufträge an Station ${station.station}`,
      formulaId: "workshop.station.open_orders.v1",
      formula: "Anzahl offener Aufträge mit exakt dieser gespeicherten Stationszuordnung.",
      inputId: `station_${index}-${stationKey}_open_orders`,
      inputLabel: `Offene Aufträge an ${station.station}`,
      rows: stationRows,
      total: station.count,
      scopeMode: "snapshot",
    }));
  });

  return evidence;
}

const UNAVAILABLE_CAPABILITIES: Record<string, string> = {
  umsatz_marge: "KI-ACCOUNTING-LEDGER-001",
  qualitaet_risiko: "KI-QUALITY-REWORK-001",
  baeder_material: "KI-BATH-MONITORING-001",
  kunden_markt: "KI-CUSTOMER-MEMORY-001",
  marketing_reaktivierung: "KI-MARKETING-ATTRIBUTION-001",
};

export function buildUnavailableAnalysisEvidence(input: {
  tileKey: string;
  label: string;
  description: string;
  tenantId: string;
  period: WorkshopEvidenceSnapshot["period"];
  calculatedAt: Date | string;
}): ClaimEvidenceV1 {
  const capabilityId = UNAVAILABLE_CAPABILITIES[input.tileKey] ?? ANALYTICS_CAPABILITY;
  return parseClaimEvidenceV1({
    schemaVersion: 1,
    claim: {
      id: `analysis.${input.tileKey}`,
      label: input.label,
      truthClass: "E",
      state: "not_configured",
      value: null,
      unit: "not_available",
      formulaId: `analysis.${input.tileKey}.v1`,
      formulaVersion: 1,
      formula: "Die Kennzahl wird erst nach belegbarer Anbindung der benötigten Fachdaten berechnet.",
    },
    scope: {
      tenantId: input.tenantId,
      from: iso(input.period.start),
      to: iso(input.period.end),
      timezone: "Europe/Berlin",
      grain: input.period.grain,
      calculatedAt: iso(input.calculatedAt),
    },
    inputs: [{
      id: `${input.tileKey}_source_contract`,
      label: "Belegbarer Fachdatenpfad",
      state: "not_configured",
      value: null,
      unit: "source",
      sourceRefs: [],
    }],
    sourceRecords: [],
    coverage: { included: 0, excluded: 0, unresolved: 1, notes: [input.description] },
    reconciliation: { method: "none", tolerance: 0 },
    missing: [{
      inputId: `${input.tileKey}_source_contract`,
      reasonCode: "source_contract_not_configured",
      description: input.description,
      captureOptions: [{
        mode: "connector",
        status: "not_configured",
        capabilityId,
        reason: "Der versionierte Quell- und Belegvertrag ist noch nicht aktiv.",
      }],
    }],
    linkedEntities: [],
  });
}
