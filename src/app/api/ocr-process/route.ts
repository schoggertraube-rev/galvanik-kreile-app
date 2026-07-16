import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { beleg, bhAuditLog, lieferant } from "@/db/schema_buchhaltung";
import { GeminiProvider } from "@/lib/ocr/GeminiProvider";
import { KlippaProvider } from "@/lib/ocr/KlippaProvider";
import {
  normalizeSupplierName,
  ocrResultForLedger,
  parseOcrResult,
} from "@/lib/ocr/resultContract";
import type { OcrErgebnis, OcrProvider } from "@/lib/ocr/types";
import { resolveAuthorization } from "@/lib/server/authorization";
import {
  claimDirectAiUsage,
  reserveDirectAiUsage,
  settleDirectAiUsage,
  type AiUsageAdmission,
} from "@/lib/server/aiUsage";
import { eq } from "drizzle-orm";

const RECEIPT_BUCKET = "buchhaltung-belege";
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const RECEIPT_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function hasExpectedReceiptSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "application/pdf") {
    return bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  }
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((value, index) => bytes[index] === value);
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

function storageConfiguration(): { url: string; serviceRoleKey: string } {
  const value = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value || !serviceRoleKey) throw new Error("OCR_STORAGE_NOT_CONFIGURED");
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("OCR_STORAGE_NOT_CONFIGURED");
  return { url: url.toString().replace(/\/$/, ""), serviceRoleKey };
}

function providerConfiguration(): { name: "klippa" | "gemini"; provider: OcrProvider } {
  if (process.env.KLIPPA_API_KEY) return { name: "klippa", provider: new KlippaProvider() };
  if (process.env.GEMINI_API_KEY) return { name: "gemini", provider: new GeminiProvider() };
  throw new Error("OCR_PROVIDER_NOT_CONFIGURED");
}

async function reserveGeminiUsage(input: {
  tenantId: string;
  userId: string;
  digest: string;
  mimeType: string;
  byteLength: number;
}): Promise<AiUsageAdmission> {
  return reserveDirectAiUsage({
    identity: { tenantId: input.tenantId, userId: input.userId },
    feature: "receipt-ocr",
    payload: { digest: input.digest, mimeType: input.mimeType, byteLength: input.byteLength },
    maxOutputTokens: 4_096,
  });
}

async function extractWithMeter(input: {
  admission: AiUsageAdmission;
  identity: { tenantId: string; userId: string };
  provider: OcrProvider;
  signedUrl: string;
}): Promise<OcrErgebnis> {
  if (input.admission.kind === "replay") return parseOcrResult(input.admission.result);
  if (input.admission.kind === "rejected") throw new Error(`AI_LIMIT:${input.admission.retryAfterSeconds}`);

  await claimDirectAiUsage({
    reservationId: input.admission.reservationId,
    identity: input.identity,
    feature: "receipt-ocr",
  });
  try {
    const result = parseOcrResult(await input.provider.extractBeleg(input.signedUrl));
    await settleDirectAiUsage({
      reservationId: input.admission.reservationId,
      identity: input.identity,
      feature: "receipt-ocr",
      outcome: "succeeded",
      actualUnits: result.actualUnits ?? null,
      providerStatus: result.providerStatus || "gemini",
      result: ocrResultForLedger(result),
    });
    return result;
  } catch (error) {
    try {
      await settleDirectAiUsage({
        reservationId: input.admission.reservationId,
        identity: input.identity,
        feature: "receipt-ocr",
        outcome: "uncertain",
        actualUnits: null,
        providerStatus: "gemini-error",
      });
    } catch {
      // Fail closed below even when the usage settlement is unavailable.
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const auth = await resolveAuthorization();
  if (!auth.ok) {
    return NextResponse.json({ error: "Sitzung abgelaufen oder nicht angemeldet" }, { status: 401 });
  }
  if (
    auth.data.tenantId !== "galvanik-kreile"
    || !auth.data.permissions.includes("perm_view_prices")
    || !["admin", "developer", "buero"].includes(auth.data.role)
  ) {
    return NextResponse.json({ error: "Zugriff verweigert" }, { status: 403 });
  }

  let uploadStarted = false;
  try {
    const formData = await request.formData();
    const keys = [...formData.keys()];
    const file = formData.get("file");
    if (keys.length !== 1 || keys[0] !== "file" || !(file instanceof File) || file.size < 1 || file.size > MAX_RECEIPT_BYTES) {
      return NextResponse.json({ error: "Ungültige Belegdatei" }, { status: 400 });
    }
    const extension = RECEIPT_EXTENSIONS[file.type];
    if (!extension) return NextResponse.json({ error: "Nicht unterstütztes Belegformat" }, { status: 415 });
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    if (fileBytes.byteLength !== file.size || !hasExpectedReceiptSignature(fileBytes, file.type)) {
      return NextResponse.json({ error: "Dateiinhalt passt nicht zum Belegformat" }, { status: 415 });
    }

    const provider = providerConfiguration();
    const storage = storageConfiguration();
    const digest = createHash("sha256").update(fileBytes).digest("hex");
    const identity = { tenantId: auth.data.tenantId, userId: auth.data.userId };
    const admission = provider.name === "gemini"
      ? await reserveGeminiUsage({ ...identity, digest, mimeType: file.type, byteLength: fileBytes.byteLength })
      : null;
    if (admission?.kind === "rejected") {
      return NextResponse.json({ error: "OCR-Nutzungslimit erreicht" }, {
        status: 429,
        headers: { "Retry-After": String(admission.retryAfterSeconds), "Cache-Control": "no-store" },
      });
    }

    const storagePath = `${identity.tenantId}/${identity.userId}/${randomUUID()}.${extension}`;
    const supabase = createSupabaseClient(storage.url, storage.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const bucket = supabase.storage.from(RECEIPT_BUCKET);
    uploadStarted = true;
    const upload = await bucket.upload(storagePath, fileBytes, { contentType: file.type, upsert: false });
    if (upload.error) throw new Error("RECEIPT_UPLOAD_FAILED");
    const signed = await bucket.createSignedUrl(storagePath, 5 * 60);
    if (signed.error || !signed.data?.signedUrl) throw new Error("RECEIPT_SIGNING_FAILED");

    const extracted = provider.name === "gemini"
      ? await extractWithMeter({ admission: admission!, identity, provider: provider.provider, signedUrl: signed.data.signedUrl })
      : parseOcrResult(await provider.provider.extractBeleg(signed.data.signedUrl));
    const supplierName = extracted.lieferant ? normalizeSupplierName(extracted.lieferant) : null;
    const supplierRows = supplierName
      ? await db.select({ id: lieferant.id, standardKategorieId: lieferant.standardKategorieId })
        .from(lieferant)
        .where(eq(lieferant.nameNormalisiert, supplierName))
        .limit(2)
      : [];
    const supplier = supplierRows.length === 1 ? supplierRows[0] : null;

    const receipt = await db.transaction(async (tx) => {
      const [created] = await tx.insert(beleg).values({
        originalDatei: storagePath,
        originalFormat: file.type,
        belegdatum: extracted.datum,
        lieferantId: supplier?.id ?? null,
        lieferantText: extracted.lieferant,
        brutto: extracted.brutto === null ? null : String(extracted.brutto),
        netto: extracted.netto === null ? null : String(extracted.netto),
        ustSatz: extracted.ustSatz === null ? null : String(extracted.ustSatz),
        ustBetrag: extracted.ustBetrag === null ? null : String(extracted.ustBetrag),
        vorsteuerAbzug: false,
        absetzbarProzent: "0",
        kategorieId: supplier?.standardKategorieId ?? null,
        belegart: extracted.belegart,
        zahlungsart: extracted.zahlungsart,
        rechnungsnummerExtern: extracted.rechnungsnummer,
        ocrConfidence: String(extracted.confidence),
        ocrRohtext: extracted.rohtext,
        ocrPositionen: extracted.positionen,
        ocrProvider: provider.name,
        status: "pruefen",
        erstelltVon: identity.userId,
      }).returning({ id: beleg.id });
      if (!created) throw new Error("WRITE_RECEIPT_MISSING");
      const [audit] = await tx.insert(bhAuditLog).values({
        benutzer: identity.userId,
        entitaet: "beleg",
        entitaetId: created.id,
        aktion: "ocr_draft_created",
        nachher: {
          status: "pruefen",
          provider: provider.name,
          confidence: extracted.confidence,
          supplierMatched: Boolean(supplier),
          categorySuggested: Boolean(supplier?.standardKategorieId),
          storagePath,
        },
      }).returning({ id: bhAuditLog.id });
      if (!audit) throw new Error("AUDIT_RECEIPT_MISSING");
      return { id: created.id, auditId: audit.id };
    });

    return NextResponse.json({
      ok: true,
      belegId: receipt.id,
      status: "pruefen",
      requiresReview: true,
      confidence: extracted.confidence,
      auditId: receipt.auditId,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : "OCR_ERROR";
    if (code === "OCR_PROVIDER_NOT_CONFIGURED" || code === "OCR_STORAGE_NOT_CONFIGURED") {
      return NextResponse.json({ error: "OCR ist nicht vollständig konfiguriert" }, { status: 503 });
    }
    if (code.startsWith("AI_LIMIT:")) {
      const retryAfter = Number(code.substring("AI_LIMIT:".length));
      return NextResponse.json({ error: "OCR-Nutzungslimit erreicht" }, {
        status: 429,
        headers: { "Retry-After": String(Number.isSafeInteger(retryAfter) ? retryAfter : 60) },
      });
    }
    console.error("OCR processing failed", { code, uploadStarted });
    return NextResponse.json({ error: "OCR-Verarbeitung fehlgeschlagen" }, { status: 500 });
  }
}
