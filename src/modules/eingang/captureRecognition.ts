export const CAPTURE_KINDS = ["ware", "anfrage", "rechnung", "dokument", "kontakt", "notiz"] as const;
export type CaptureKind = typeof CAPTURE_KINDS[number] | "unklar";

/** Presentation of the saved original and its saved suggestions; never a second stored result. */
export function captureRecognition(capture: { text: string | null; suggestions?: ReadonlyArray<{ field: string; value: unknown; status?: string }> }): { kind: CaptureKind; text: string; source?: "hand" } {
  const suggestions = (capture.suggestions ?? []).filter(value => value.status !== "verworfen");
  const documentText = suggestions.filter(value => value.field === "DOCUMENT_TEXT" && typeof value.value === "string")
    .map(value => String(value.value)).join("\n");
  const fields = new Set(suggestions.map(value => value.field));
  const text = [capture.text, documentText || suggestions.filter(value => value.field !== "art" && typeof value.value === "string").map(value => String(value.value)).join("\n")]
    .filter(Boolean).join("\n").trim();
  const chosen = suggestions.find(value => value.field === "art" && value.status === "uebernommen" && CAPTURE_KINDS.some(kind => kind === value.value));
  if (chosen) return { kind: chosen.value as typeof CAPTURE_KINDS[number], text, source: "hand" };
  if (/\brechnung\b/iu.test(text) && /rechnungsnummer|\bust\b|\biban\b/iu.test(text)) return { kind: "rechnung", text };
  if (/\b(?:DHL|DPD|UPS|GLS|Hermes|FedEx|Sendungsnummer|Absender)\b/iu.test(text)) return { kind: "ware", text };
  if (/\blieferschein\b/iu.test(text)) return { kind: "dokument", text };
  if (/\b(?:bestellung|bestellen|anfrage|angebot)\b/iu.test(text) || fields.has("ITEM_DESCRIPTION") && fields.has("QUANTITY")) return { kind: "anfrage", text };
  if (fields.has("CUSTOMER_NAME") && (fields.has("EMAIL") || fields.has("PHONE")) && !fields.has("ITEM_DESCRIPTION")) return { kind: "kontakt", text };
  return { kind: text ? "notiz" : "unklar", text };
}
