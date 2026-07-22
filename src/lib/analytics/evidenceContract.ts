import { z } from "zod";

export const EVIDENCE_STATES = [
  "ready",
  "confirmed_empty",
  "partial",
  "missing_input",
  "not_configured",
  "review_required",
  "degraded",
  "unavailable",
  "protected_later",
] as const;

export const evidenceStateSchema = z.enum(EVIDENCE_STATES);

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/, "Ungültige Evidence-ID.");

const labelSchema = z.string().trim().min(1).max(300);
const explanationSchema = z.string().trim().min(1).max(2_000);
const capabilityIdSchema = z
  .string()
  .trim()
  .regex(/^KI-[A-Z0-9-]+-\d{3}$/, "Ungültige Capability-ID.");
const isoDateTimeSchema = z.iso.datetime({ offset: true });
const internalHrefSchema = z
  .string()
  .trim()
  .max(2_000)
  .refine(
    (value) => value.startsWith("/") && !value.startsWith("//") && value !== "#" && !value.startsWith("/#"),
    "Evidence-Links müssen echte interne Ziele besitzen.",
  );

const evidenceLinkSchema = z
  .object({
    id: identifierSchema,
    label: labelSchema,
    kind: z.enum(["detail", "capture", "connector", "related", "action"]),
    entityType: identifierSchema.optional(),
    entityId: identifierSchema.optional(),
    enabled: z.boolean(),
    href: internalHrefSchema.optional(),
    capabilityId: capabilityIdSchema.optional(),
    disabledReason: explanationSchema.optional(),
  })
  .strict()
  .superRefine((link, context) => {
    if (link.enabled && !link.href) {
      context.addIssue({ code: "custom", path: ["href"], message: "Aktive Evidence-Links benötigen ein echtes Ziel." });
    }
    if (!link.enabled && link.href) {
      context.addIssue({ code: "custom", path: ["href"], message: "Gesperrte Evidence-Links dürfen kein scheinaktives Ziel besitzen." });
    }
    if (!link.enabled && !link.disabledReason) {
      context.addIssue({ code: "custom", path: ["disabledReason"], message: "Gesperrte Evidence-Links benötigen einen Grund." });
    }
  });

const coverageSchema = z
  .object({
    included: z.number().int().nonnegative(),
    excluded: z.number().int().nonnegative(),
    unresolved: z.number().int().nonnegative(),
    notes: z.array(explanationSchema).max(50),
  })
  .strict();

const reconciliationSchema = z
  .object({
    method: z.enum(["count", "sum", "none"]),
    tolerance: z.number().finite().nonnegative(),
  })
  .strict();

const evidenceRecordRefSchema = z
  .object({
    ref: identifierSchema,
    entityType: z.enum([
      "order",
      "customer",
      "item",
      "invoice",
      "receipt",
      "payment",
      "communication",
      "touchpoint",
      "measurement",
      "inventory_movement",
      "time_booking",
      "audit_event",
    ]),
    entityId: identifierSchema,
    relation: identifierSchema,
    fieldRefs: z.array(identifierSchema).min(1).max(50),
    recordedAt: isoDateTimeSchema,
    contribution: z.number().finite().nullable(),
    detail: evidenceLinkSchema,
  })
  .strict()
  .superRefine((record, context) => {
    if (!record.detail.enabled) {
      context.addIssue({
        code: "custom",
        path: ["detail"],
        message: "Ein als Einzelquelle ausgelieferter Datensatz benötigt einen erreichbaren, berechtigten Detailpfad.",
      });
    }
  });

const evidenceInputSchema = z
  .object({
    id: identifierSchema,
    label: labelSchema,
    state: evidenceStateSchema,
    value: z.number().finite().nullable(),
    unit: labelSchema,
    sourceRefs: z.array(identifierSchema).max(10_000),
  })
  .strict()
  .superRefine((input, context) => {
    if ((input.state === "ready" || input.state === "confirmed_empty" || input.state === "partial") && input.value === null) {
      context.addIssue({ code: "custom", path: ["value"], message: "Belegte und partielle Eingänge benötigen einen numerischen Wert." });
    }
    if (!(["ready", "confirmed_empty", "partial"] as const).includes(input.state as "ready") && input.value !== null) {
      context.addIssue({ code: "custom", path: ["value"], message: "Fehlende Eingänge müssen null bleiben." });
    }
    if (input.state === "confirmed_empty" && input.value !== 0) {
      context.addIssue({ code: "custom", path: ["value"], message: "confirmed_empty entspricht einem bestätigten Nullwert." });
    }
  });

const captureOptionSchema = z
  .object({
    mode: z.enum(["manual_entry", "source_record", "connector"]),
    status: z.enum(["available", "blocked", "not_configured"]),
    capabilityId: capabilityIdSchema,
    reason: explanationSchema.optional(),
    action: evidenceLinkSchema.optional(),
  })
  .strict()
  .superRefine((option, context) => {
    if (option.status === "available" && (!option.action || !option.action.enabled)) {
      context.addIssue({ code: "custom", path: ["action"], message: "Ein verfügbarer Erfassungspfad benötigt eine echte Aktion." });
    }
    if (option.status !== "available" && !option.reason) {
      context.addIssue({ code: "custom", path: ["reason"], message: "Nicht verfügbare Erfassungspfade benötigen einen Grund." });
    }
    if (option.status !== "available" && option.action?.enabled) {
      context.addIssue({ code: "custom", path: ["action"], message: "Ein blockierter Erfassungspfad darf nicht aktiv erscheinen." });
    }
  });

const missingEvidenceSchema = z
  .object({
    inputId: identifierSchema,
    reasonCode: identifierSchema,
    description: explanationSchema,
    captureOptions: z.array(captureOptionSchema).min(1).max(3),
  })
  .strict();

const evidenceScopeSchema = z
  .object({
    tenantId: identifierSchema,
    from: isoDateTimeSchema,
    to: isoDateTimeSchema,
    timezone: labelSchema,
    grain: z.enum(["snapshot", "day", "week", "month", "quarter"]),
    calculatedAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((scope, context) => {
    const from = Date.parse(scope.from);
    const to = Date.parse(scope.to);
    if (scope.grain === "snapshot" ? from !== to : from >= to) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: scope.grain === "snapshot"
          ? "Snapshot-Grenzen müssen denselben Zeitpunkt bezeichnen."
          : "Der Evidence-Zeitraum muss ein halboffenes, positives Intervall sein.",
      });
    }
  });

const comparisonSchema = z
  .object({
    mode: z.enum(["previous_period", "previous_year", "baseline", "target"]),
    state: evidenceStateSchema,
    value: z.number().finite().nullable(),
    unit: labelSchema,
    scope: evidenceScopeSchema,
    sourceRecords: z.array(evidenceRecordRefSchema).max(10_000),
    coverage: coverageSchema,
    reconciliation: reconciliationSchema,
    missingReason: explanationSchema.optional(),
  })
  .strict()
  .superRefine((comparison, context) => {
    const sourceIds = comparison.sourceRecords.map((record) => record.ref);
    if (new Set(sourceIds).size !== sourceIds.length) {
      context.addIssue({ code: "custom", path: ["sourceRecords"], message: "Vergleichsquellen müssen eindeutig sein." });
    }
    if ((comparison.state === "ready" || comparison.state === "confirmed_empty") && comparison.value === null) {
      context.addIssue({ code: "custom", path: ["value"], message: "Ein belegter Vergleich benötigt einen Wert." });
    }
    if (comparison.state === "ready" && comparison.sourceRecords.length === 0) {
      context.addIssue({ code: "custom", path: ["sourceRecords"], message: "Ein belegter Vergleich benötigt eigene Quellen." });
    }
    if (comparison.state === "confirmed_empty" && comparison.value !== 0) {
      context.addIssue({ code: "custom", path: ["value"], message: "Ein bestätigter leerer Vergleich hat den Wert 0." });
    }
    if (!(["ready", "confirmed_empty", "partial"] as const).includes(comparison.state as "ready") && comparison.value !== null) {
      context.addIssue({ code: "custom", path: ["value"], message: "Ein fehlender Vergleich darf keinen geschätzten Wert enthalten." });
    }
    if (!(["ready", "confirmed_empty"] as const).includes(comparison.state as "ready") && !comparison.missingReason) {
      context.addIssue({ code: "custom", path: ["missingReason"], message: "Ein nicht vollständiger Vergleich benötigt einen Grund." });
    }
    if (comparison.state === "ready" && comparison.coverage.unresolved !== 0) {
      context.addIssue({ code: "custom", path: ["coverage", "unresolved"], message: "Ein fertiger Vergleich darf keine ungelöste Abdeckung enthalten." });
    }
    if (comparison.state === "confirmed_empty" && (comparison.coverage.included !== 0 || comparison.coverage.unresolved !== 0)) {
      context.addIssue({ code: "custom", path: ["coverage"], message: "Ein leerer Vergleich muss einen vollständig geprüften leeren Scope belegen." });
    }
    if (comparison.state === "partial" && comparison.coverage.unresolved === 0) {
      context.addIssue({ code: "custom", path: ["coverage", "unresolved"], message: "Ein partieller Vergleich muss seine ungelöste Abdeckung ausweisen." });
    }
    if (comparison.value !== null && comparison.reconciliation.method === "count") {
      if (!Number.isInteger(comparison.value)
        || comparison.sourceRecords.some((record) => record.contribution !== 1)
        || comparison.coverage.included !== comparison.value
        || comparison.sourceRecords.length + comparison.coverage.unresolved !== comparison.value) {
        context.addIssue({ code: "custom", path: ["reconciliation"], message: "Vergleichswert und Count-Quellen reconciliieren nicht." });
      }
    }
    if (comparison.value !== null && comparison.reconciliation.method === "sum" && comparison.state !== "partial") {
      const contributions = comparison.sourceRecords.map((record) => record.contribution);
      const sum = contributions.every((contribution) => contribution !== null)
        ? (contributions as number[]).reduce((total, contribution) => total + contribution, 0)
        : Number.NaN;
      if (!Number.isFinite(sum) || Math.abs(sum - comparison.value) > comparison.reconciliation.tolerance) {
        context.addIssue({ code: "custom", path: ["reconciliation"], message: "Vergleichswert und Einzelbeiträge reconciliieren nicht." });
      }
    }
  });

const observationSchema = z
  .object({
    id: identifierSchema,
    text: explanationSchema,
    sourceRefs: z.array(identifierSchema).min(1).max(10_000),
  })
  .strict();

const hypothesisSchema = z
  .object({
    id: identifierSchema,
    text: explanationSchema,
    sourceRefs: z.array(identifierSchema).min(1).max(10_000),
    assumptions: z.array(explanationSchema).min(1).max(50),
    confidence: z.number().finite().min(0).max(1),
  })
  .strict();

const recommendationSchema = z
  .object({
    id: identifierSchema,
    text: explanationSchema,
    sourceRefs: z.array(identifierSchema).min(1).max(10_000),
    state: z.enum(["pending_review", "approved", "executed", "dismissed"]),
    action: evidenceLinkSchema.optional(),
    actionReceiptId: identifierSchema.optional(),
  })
  .strict()
  .superRefine((recommendation, context) => {
    if (recommendation.state === "pending_review" && recommendation.actionReceiptId) {
      context.addIssue({ code: "custom", path: ["actionReceiptId"], message: "Eine ungeprüfte Empfehlung darf noch keinen Ausführungsbeleg besitzen." });
    }
    if (recommendation.state !== "pending_review" && !recommendation.actionReceiptId) {
      context.addIssue({ code: "custom", path: ["actionReceiptId"], message: "Jeder Status nach pending_review benötigt einen dauerhaften Aktionsbeleg." });
    }
  });

const evidenceInsightSchema = z
  .object({
    engine: z
      .object({
        kind: z.enum(["rules", "ai"]),
        name: identifierSchema,
        version: identifierSchema,
        model: identifierSchema.optional(),
        usageReceiptId: identifierSchema.optional(),
      })
      .strict(),
    observations: z.array(observationSchema).max(100),
    hypotheses: z.array(hypothesisSchema).max(100),
    recommendations: z.array(recommendationSchema).max(100),
  })
  .strict()
  .superRefine((insight, context) => {
    if (insight.engine.kind === "ai" && (!insight.engine.model || !insight.engine.usageReceiptId)) {
      context.addIssue({
        code: "custom",
        path: ["engine"],
        message: "KI-Insights benötigen Modellversion und AI-Usage-Receipt.",
      });
    }
    if (insight.engine.kind === "rules" && (insight.engine.model || insight.engine.usageReceiptId)) {
      context.addIssue({
        code: "custom",
        path: ["engine"],
        message: "Regelbasierte Insights dürfen nicht als KI-Ausgabe erscheinen.",
      });
    }
  });

export const claimEvidenceV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    claim: z
      .object({
        id: identifierSchema,
        label: labelSchema,
        truthClass: z.enum(["A", "B", "C", "D", "E"]),
        state: evidenceStateSchema,
        value: z.number().finite().nullable(),
        unit: labelSchema,
        formulaId: identifierSchema,
        formulaVersion: z.number().int().positive(),
        formula: explanationSchema,
      })
      .strict(),
    scope: evidenceScopeSchema,
    inputs: z.array(evidenceInputSchema).min(1).max(100),
    sourceRecords: z.array(evidenceRecordRefSchema).max(10_000),
    coverage: coverageSchema,
    reconciliation: reconciliationSchema,
    missing: z.array(missingEvidenceSchema).max(100),
    linkedEntities: z.array(evidenceLinkSchema).max(10_000),
    comparison: comparisonSchema.optional(),
    insight: evidenceInsightSchema.optional(),
  })
  .strict()
  .superRefine((evidence, context) => {
    const sourceIds = evidence.sourceRecords.map((record) => record.ref);
    const sourceIdSet = new Set(sourceIds);
    if (sourceIdSet.size !== sourceIds.length) {
      context.addIssue({ code: "custom", path: ["sourceRecords"], message: "Source-Refs müssen innerhalb eines Claims eindeutig sein." });
    }

    const inputIds = evidence.inputs.map((input) => input.id);
    const inputIdSet = new Set(inputIds);
    if (inputIdSet.size !== inputIds.length) {
      context.addIssue({ code: "custom", path: ["inputs"], message: "Input-IDs müssen innerhalb eines Claims eindeutig sein." });
    }

    const assertKnownSources = (refs: readonly string[], path: (string | number)[]) => {
      refs.forEach((ref, index) => {
        if (!sourceIdSet.has(ref)) {
          context.addIssue({ code: "custom", path: [...path, index], message: `Unbekannte Source-Ref: ${ref}` });
        }
      });
    };

    evidence.inputs.forEach((input, index) => assertKnownSources(input.sourceRefs, ["inputs", index, "sourceRefs"]));
    evidence.insight?.observations.forEach((item, index) => assertKnownSources(item.sourceRefs, ["insight", "observations", index, "sourceRefs"]));
    evidence.insight?.hypotheses.forEach((item, index) => assertKnownSources(item.sourceRefs, ["insight", "hypotheses", index, "sourceRefs"]));
    evidence.insight?.recommendations.forEach((item, index) => assertKnownSources(item.sourceRefs, ["insight", "recommendations", index, "sourceRefs"]));

    const claimState = evidence.claim.state;
    if ((claimState === "ready" || claimState === "confirmed_empty" || claimState === "partial") && evidence.claim.value === null) {
      context.addIssue({ code: "custom", path: ["claim", "value"], message: "Belegte und partielle Claims benötigen einen numerischen Wert." });
    }
    if (!(["ready", "confirmed_empty", "partial"] as const).includes(claimState as "ready") && evidence.claim.value !== null) {
      context.addIssue({ code: "custom", path: ["claim", "value"], message: "Fehlende Claims müssen null bleiben; Schätzwerte sind nicht erlaubt." });
    }
    if (claimState === "ready") {
      if (evidence.sourceRecords.length === 0) {
        context.addIssue({ code: "custom", path: ["sourceRecords"], message: "Ein fertiger Claim benötigt mindestens eine rückverfolgbare Einzelquelle." });
      }
      if (evidence.coverage.unresolved !== 0 || evidence.missing.length !== 0) {
        context.addIssue({ code: "custom", path: ["coverage"], message: "Ein fertiger Claim darf keine ungelöste Abdeckung oder fehlende Eingabe enthalten." });
      }
    }
    if (claimState === "confirmed_empty") {
      if (evidence.claim.value !== 0 || evidence.coverage.included !== 0 || evidence.coverage.unresolved !== 0) {
        context.addIssue({ code: "custom", path: ["claim", "value"], message: "confirmed_empty beweist einen leeren, vollständig geprüften Scope." });
      }
    }
    if (claimState === "partial" && evidence.coverage.unresolved === 0) {
      context.addIssue({ code: "custom", path: ["coverage", "unresolved"], message: "Ein partieller Claim muss seine ungelöste Abdeckung ausweisen." });
    }
    if (!(["ready", "confirmed_empty"] as const).includes(claimState as "ready") && evidence.missing.length === 0) {
      context.addIssue({ code: "custom", path: ["missing"], message: "Nicht vollständige Claims benötigen einen konkreten Fehlgrund und Erfassungspfad." });
    }

    const missingInputs = new Set(evidence.missing.map((missing) => missing.inputId));
    evidence.missing.forEach((missing, index) => {
      const input = evidence.inputs.find((candidate) => candidate.id === missing.inputId);
      if (!input) {
        context.addIssue({ code: "custom", path: ["missing", index, "inputId"], message: "Fehlgrund verweist auf keinen Claim-Input." });
      } else if (input.state === "ready" || input.state === "confirmed_empty") {
        context.addIssue({ code: "custom", path: ["missing", index, "inputId"], message: "Ein belegter Input darf nicht zugleich als fehlend markiert sein." });
      }
    });
    evidence.inputs.forEach((input, index) => {
      if (!(["ready", "confirmed_empty"] as const).includes(input.state as "ready") && !missingInputs.has(input.id)) {
        context.addIssue({ code: "custom", path: ["inputs", index], message: "Jeder nicht vollständige Input benötigt einen zugeordneten Fehlgrund." });
      }
    });

    const value = evidence.claim.value;
    if (value !== null && evidence.reconciliation.method === "count") {
      if (!Number.isInteger(value)) {
        context.addIssue({ code: "custom", path: ["claim", "value"], message: "Count-Claims müssen ganzzahlig sein." });
      }
      if (evidence.sourceRecords.some((record) => record.contribution !== 1)) {
        context.addIssue({ code: "custom", path: ["sourceRecords"], message: "Jede Einzelquelle eines Count-Claims muss genau eins beitragen." });
      }
      if (evidence.coverage.included !== value || evidence.sourceRecords.length + evidence.coverage.unresolved !== value) {
        context.addIssue({ code: "custom", path: ["coverage"], message: "Count-Claim, Einzelquellen und Abdeckung stimmen nicht überein." });
      }
    }
    if (value !== null && evidence.reconciliation.method === "sum" && claimState !== "partial") {
      const contributions = evidence.sourceRecords.map((record) => record.contribution);
      if (contributions.some((contribution) => contribution === null)) {
        context.addIssue({ code: "custom", path: ["sourceRecords"], message: "Summen-Claims benötigen den Einzelbeitrag jeder Quelle." });
      } else {
        const sum = (contributions as number[]).reduce((total, contribution) => total + contribution, 0);
        if (Math.abs(sum - value) > evidence.reconciliation.tolerance) {
          context.addIssue({ code: "custom", path: ["reconciliation"], message: "Einzelbeiträge reconciliieren nicht zum Claim-Wert." });
        }
      }
    }
  });

export type EvidenceState = z.infer<typeof evidenceStateSchema>;
export type EvidenceLinkV1 = z.infer<typeof evidenceLinkSchema>;
export type EvidenceRecordRefV1 = z.infer<typeof evidenceRecordRefSchema>;
export type EvidenceInputV1 = z.infer<typeof evidenceInputSchema>;
export type MissingEvidenceV1 = z.infer<typeof missingEvidenceSchema>;
export type EvidenceInsightV1 = z.infer<typeof evidenceInsightSchema>;
export type ClaimEvidenceV1 = z.infer<typeof claimEvidenceV1Schema>;

export function parseClaimEvidenceV1(input: unknown): ClaimEvidenceV1 {
  return claimEvidenceV1Schema.parse(input);
}
