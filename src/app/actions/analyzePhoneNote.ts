"use server";

import { resolveAuthorization } from "@/lib/server/authorization";
import {
  parseNotesInput,
  parsePhoneNoteAnalysisResult,
  type PhoneNoteAnalysisResult,
  type PhoneNoteCategory,
} from "@/lib/server/aiInputs";
import { proxyMeteredAiRequest } from "@/lib/server/aiUsage";

export type { PhoneNoteAnalysisResult, PhoneNoteCategory };

export type PhoneNoteAiActionResult =
  | { ok: true; data: PhoneNoteAnalysisResult }
  | { ok: false; error: string };

export async function analyzePhoneNoteWithAI(input: unknown): Promise<PhoneNoteAiActionResult> {
  const authorization = await resolveAuthorization();
  if (
    !authorization.ok
    || authorization.data.tenantId !== "galvanik-kreile"
    || !authorization.data.permissions.includes("perm_data_orders")
  ) {
    return { ok: false, error: "Keine Berechtigung für die KI-Telefonanalyse." };
  }

  let payload;
  try {
    payload = parseNotesInput(input);
  } catch {
    return { ok: false, error: "Telefonnotiz fehlt oder ist zu lang." };
  }

  const response = await proxyMeteredAiRequest({
    request: new Request("https://kreile.invalid/internal/phone-note-analysis", { method: "POST" }),
    identity: authorization.data,
    feature: "notes-extract",
    payload,
    maxOutputTokens: 1_024,
    parseResult: parsePhoneNoteAnalysisResult,
  });

  if (!response.ok) {
    return {
      ok: false,
      error: response.status === 429
        ? "KI-Nutzungslimit erreicht. Die lokale Auswertung bleibt verfügbar."
        : "KI-Analyse ist derzeit nicht verfügbar. Die lokale Auswertung bleibt verfügbar.",
    };
  }
  try {
    return { ok: true, data: parsePhoneNoteAnalysisResult(await response.json()) };
  } catch {
    return { ok: false, error: "Die KI-Antwort hatte kein gültiges Datenformat." };
  }
}
