import type { IntakeSelectableConcern } from "./intakeLifecycleContract";

export const CAPTURE_KINDS = ["ware", "anfrage", "rechnung", "dokument", "kontakt", "notiz"] as const;
export type CaptureKind = typeof CAPTURE_KINDS[number] | "unklar";

const concernByKind = {
  anfrage: "kv_anfrage", kontakt: "kontakt", lieferschein: "lieferschein",
  quittung: "quittung", rechnung: "rechnung", ware: "ware",
} as const satisfies Record<string, IntakeSelectableConcern>;

type DocumentCaptureKind = CaptureKind | keyof typeof concernByKind;
type CaptureEvidence = {
  text: string | null;
  concerns?: readonly string[];
  suggestions?: ReadonlyArray<{ field: string; value: unknown; status?: string }>;
  documentTexts?: readonly string[];
};

export function concernForCaptureKind(kind: DocumentCaptureKind): IntakeSelectableConcern | null {
  return Object.hasOwn(concernByKind, kind) ? concernByKind[kind as keyof typeof concernByKind] : null;
}

export function recognizeCaptureDocument(capture: CaptureEvidence): { kind: DocumentCaptureKind; text: string; source?: "hand" } {
  const suggestions = (capture.suggestions ?? []).filter(value => value.status !== "verworfen");
  const legacyTexts = suggestions.filter(value => value.field === "DOCUMENT_TEXT" && typeof value.value === "string")
    .map(value => String(value.value));
  const documentText = [...(capture.documentTexts ?? []), ...legacyTexts].join("\n");
  const fields = new Set(suggestions.map(value => value.field));
  const text = [capture.text, documentText || suggestions.filter(value => value.field !== "art" && typeof value.value === "string").map(value => String(value.value)).join("\n")]
    .filter(Boolean).join("\n").trim();
  const chosen = suggestions.find(value => value.field === "art" && value.status === "uebernommen" && CAPTURE_KINDS.some(kind => kind === value.value));
  if (capture.concerns?.includes("rechnung") || fields.has("rechnung.nummer")) return { kind: "rechnung", text, ...(chosen?.value === "rechnung" ? { source: "hand" as const } : {}) };
  if (chosen) return { kind: chosen.value as typeof CAPTURE_KINDS[number], text, source: "hand" };
  if (/\brechnung\b/iu.test(text) && /rechnungsnummer|\bust\b|\biban\b/iu.test(text)) return { kind: "rechnung", text };
  // A document heading qualifies the new concern. A mention in free text does not.
  const deliveryNote = /^[ \t]*lieferschein(?:[ \t:#]|$)/imu.test(text);
  const receipt = /^[ \t]*(?:quittung|kassenbon)(?:[ \t:#]|$)/imu.test(text);
  if (deliveryNote && receipt) return { kind: "dokument", text };
  if (deliveryNote) return { kind: "lieferschein", text };
  if (receipt) return { kind: "quittung", text };
  if (/\b(?:DHL|DPD|UPS|GLS|Hermes|FedEx|Sendungsnummer|Absender)\b/iu.test(text)) return { kind: "ware", text };
  if (/\blieferschein\b/iu.test(text)) return { kind: "dokument", text };
  if (/\b(?:bestellung|bestellen|anfrage|angebot)\b/iu.test(text) || fields.has("ITEM_DESCRIPTION") && fields.has("QUANTITY")) return { kind: "anfrage", text };
  if (fields.has("CUSTOMER_NAME") && (fields.has("EMAIL") || fields.has("PHONE")) && !fields.has("ITEM_DESCRIPTION")) return { kind: "kontakt", text };
  return { kind: text ? "notiz" : "unklar", text };
}

/** The existing presentation keeps its labels until the S23 interface is in place. */
export function captureRecognition(capture: CaptureEvidence): { kind: CaptureKind; text: string; source?: "hand" } {
  const { kind, ...result } = recognizeCaptureDocument(capture);
  return { ...result, kind: kind === "lieferschein" || kind === "quittung" ? "dokument" : kind };
}
