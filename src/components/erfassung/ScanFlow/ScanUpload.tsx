"use client";

import { useState } from "react";
import { UploadCloud, Camera, FileText } from "lucide-react";
import { useErfassung } from "../ErfassungProvider";

type ScanRecord = {
  id: string;
  status: string;
  extractedData?: unknown;
  detectedType?: string | null;
  detectionConfidence?: number | string | null;
  contentSha256?: string | null;
  fileSizeBytes?: number | null;
  processingAttemptCount?: number;
  lastProcessingError?: string | null;
};

type FallbackState = {
  type: "ai_failed" | "configuration_missing" | "integrity_failed" | "invalid_file" | "quota_exceeded" | "storage_unconfirmed" | "status_unknown";
  record?: ScanRecord;
  originalConfirmed: boolean;
};

const MAX_SCAN_FILE_BYTES = 14 * 1024 * 1024;
const SCAN_MIME_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);

async function sha256(file: File): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function directSignedUpload(signedUrl: string, file: File): Promise<void> {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!configuredUrl || !anonKey) throw new Error("SIGNED_UPLOAD_CONFIGURATION_MISSING");
  const target = new URL(signedUrl);
  const expected = new URL(configuredUrl);
  if (
    target.protocol !== "https:"
    || target.origin !== expected.origin
    || !target.pathname.startsWith("/storage/v1/object/upload/sign/scans/")
    || !target.searchParams.get("token")
  ) throw new Error("SIGNED_UPLOAD_TARGET_INVALID");
  const formData = new FormData();
  formData.append("cacheControl", "3600");
  formData.append("", file);
  const upload = await fetch(target, {
    method: "PUT",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "x-upsert": "false",
    },
    body: formData,
  });
  if (!upload.ok) throw new Error(`SIGNED_UPLOAD_FAILED:${upload.status}`);
}

async function readStatus(id: string): Promise<ScanRecord | null> {
  const response = await fetch(`/api/erfassung/scan-status/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  const body = await response.json() as { ok?: boolean } & Partial<ScanRecord>;
  if (!response.ok || body.ok !== true || typeof body.id !== "string" || typeof body.status !== "string") {
    throw new Error("SCAN_STATUS_UNAVAILABLE");
  }
  return body as ScanRecord;
}

function originalIsConfirmed(record: ScanRecord | null): boolean {
  return Boolean(
    record
    && ["secured", "processing", "processed", "review_required"].includes(record.status)
    && typeof record.contentSha256 === "string"
    && /^[0-9a-f]{64}$/.test(record.contentSha256)
    && Number.isSafeInteger(record.fileSizeBytes)
    && (record.fileSizeBytes ?? 0) > 0,
  );
}

export function ScanUpload() {
  const { openErfassung } = useErfassung();
  const [isUploading, setIsUploading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [fallbackState, setFallbackState] = useState<FallbackState | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!SCAN_MIME_TYPES.has(file.type) || file.size < 1 || file.size > MAX_SCAN_FILE_BYTES) {
      setFallbackState({ type: "invalid_file", originalConfirmed: false });
      return;
    }
    const requestId = crypto.randomUUID();
    setIsUploading(true);
    setFallbackState(null);
    setStatusText("Original wird sicher gespeichert …");

    let securedRecord: ScanRecord | null = null;
    try {
      const contentSha256 = await sha256(file);
      const prepareResponse = await fetch("/api/erfassung/scan-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          clientRequestId: requestId,
          contentSha256,
          fileSizeBytes: file.size,
          fileType: file.type,
        }),
      });
      const prepareBody = await prepareResponse.json() as {
        ok?: boolean;
        id?: string;
        status?: string;
        code?: string;
        contentSha256?: string;
        fileSizeBytes?: number;
        needsUpload?: boolean;
        signedUploadUrl?: string;
      };
      if (!prepareResponse.ok || prepareBody.ok !== true || prepareBody.id !== requestId) {
        if (prepareBody.code === "CONFIGURATION_MISSING") {
          setFallbackState({ type: "configuration_missing", originalConfirmed: false });
          setIsUploading(false);
          return;
        }
        if (prepareBody.code === "UPLOAD_QUOTA_EXCEEDED") {
          setFallbackState({ type: "quota_exceeded", originalConfirmed: false });
          setIsUploading(false);
          return;
        }
        if (prepareBody.status === "storage_unconfirmed" || prepareBody.status === "storage_error") {
          setFallbackState({
            type: "storage_unconfirmed",
            record: { id: requestId, status: "storage_unconfirmed" },
            originalConfirmed: false,
          });
          setIsUploading(false);
          return;
        }
        if (prepareBody.status === "integrity_error") {
          setFallbackState({
            type: "integrity_failed",
            record: { id: requestId, status: "integrity_error" },
            originalConfirmed: false,
          });
          setIsUploading(false);
          return;
        }
        throw new Error(prepareBody.code || "SCAN_UPLOAD_UNAVAILABLE");
      }

      if (prepareBody.needsUpload === true) {
        if (typeof prepareBody.signedUploadUrl !== "string") throw new Error("SIGNED_UPLOAD_RECEIPT_MISSING");
        try {
          await directSignedUpload(prepareBody.signedUploadUrl, file);
        } catch (error) {
          // Confirmation below is authoritative. A transport error can also be
          // the replay case where the immutable object already exists.
          console.error("Direct scan upload response uncertain", error);
        }
      }

      const uploadResponse = await fetch("/api/erfassung/scan-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", clientRequestId: requestId }),
      });
      const uploadBody = await uploadResponse.json() as {
        ok?: boolean;
        id?: string;
        status?: string;
        code?: string;
      };
      if (!uploadResponse.ok || uploadBody.ok !== true || uploadBody.id !== requestId) {
        if (uploadBody.status === "integrity_error") {
          setFallbackState({
            type: "integrity_failed",
            record: { id: requestId, status: "integrity_error" },
            originalConfirmed: false,
          });
          setIsUploading(false);
          return;
        }
        throw new Error(uploadBody.code || "SCAN_CONFIRMATION_UNAVAILABLE");
      }
      securedRecord = await readStatus(requestId);
      if (!originalIsConfirmed(securedRecord)) throw new Error("SECURED_RECEIPT_MISSING");
    } catch (error) {
      console.error("Scan original response uncertain", error);
      try {
        securedRecord = await readStatus(requestId);
      } catch {
        securedRecord = null;
      }
      if (!originalIsConfirmed(securedRecord)) {
        setFallbackState({
          type: "status_unknown",
          record: { id: requestId, status: securedRecord?.status || "unknown" },
          originalConfirmed: false,
        });
        setIsUploading(false);
        return;
      }
    }

    setStatusText("Original gesichert. KI-Auswertung läuft …");
    try {
      await fetch(`/api/erfassung/scan-process/${encodeURIComponent(requestId)}`, { method: "POST" });
    } catch (error) {
      console.error("Scan processing response uncertain", error);
    }

    let lastRecord = securedRecord;
    for (let attempts = 0; attempts < 20; attempts += 1) {
      try {
        const current = await readStatus(requestId);
        if (current) lastRecord = current;
        if (current?.status === "processed") {
          openErfassung({ mode: "scan", prefill: { scanResult: current } });
          setIsUploading(false);
          return;
        }
        if (current?.status === "integrity_error") {
          setFallbackState({ type: "integrity_failed", record: current, originalConfirmed: false });
          setIsUploading(false);
          return;
        }
        if (current?.status === "review_required") {
          setFallbackState({ type: "ai_failed", record: current, originalConfirmed: true });
          setIsUploading(false);
          return;
        }
        if (current?.status === "storage_unconfirmed" || current?.status === "storage_error") {
          setFallbackState({ type: "storage_unconfirmed", record: current, originalConfirmed: false });
          setIsUploading(false);
          return;
        }
        if (current?.status === "secured" && current.lastProcessingError) break;
      } catch {
        // A lost status response is uncertain, never a confirmed storage failure.
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1_500));
    }

    const confirmed = originalIsConfirmed(lastRecord);
    setFallbackState({
      type: ["secured", "review_required"].includes(lastRecord?.status || "") ? "ai_failed" : "status_unknown",
      record: lastRecord || { id: requestId, status: "unknown" },
      originalConfirmed: confirmed,
    });
    setIsUploading(false);
  };

  if (fallbackState) {
    const canRetainSource = Boolean(fallbackState.originalConfirmed && fallbackState.record?.id);
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
          <FileText className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-3 tracking-tight">Manuelle Weiterverarbeitung</h2>
        {fallbackState.type === "ai_failed" ? (
          <p className="text-gray-500 mb-3 max-w-md mx-auto">
            Das Original ist mit Hash und Bytezahl bestätigt gespeichert, aber die KI-Auswertung wurde nicht bestätigt. Die Scan-ID bleibt bei der manuellen Zuordnung erhalten.
          </p>
        ) : fallbackState.type === "status_unknown" ? (
          <p className="text-gray-500 mb-3 max-w-md mx-auto">
            Der Ausgang konnte nicht bestätigt werden. Das ist kein behaupteter Speicherfehler. Ohne bestätigten Originalbeleg wird die ID nicht als Auftragsquelle übernommen.
          </p>
        ) : fallbackState.type === "integrity_failed" ? (
          <p className="text-gray-500 mb-3 max-w-md mx-auto">
            Der gelesene Inhalt stimmt nicht mit Hash, Dateigröße oder Dateisignatur des Belegs überein. Die Recovery-ID bleibt sichtbar, darf aber nicht als Auftragsquelle dienen.
          </p>
        ) : fallbackState.type === "configuration_missing" ? (
          <p className="text-gray-500 mb-3 max-w-md mx-auto">
            Der sichere Scan-Belegpfad ist in dieser Umgebung noch nicht ausgerollt. Es wurde kein Originalbeleg angelegt; die Erfassung kann nur ausdrücklich manuell fortgesetzt werden.
          </p>
        ) : fallbackState.type === "invalid_file" ? (
          <p className="text-gray-500 mb-3 max-w-md mx-auto">
            Zulässig sind JPEG, PNG oder PDF mit höchstens 14 MB. Es wurde kein Beleg angelegt.
          </p>
        ) : fallbackState.type === "quota_exceeded" ? (
          <p className="text-gray-500 mb-3 max-w-md mx-auto">
            Das bestätigte Scan-Kontingent ist momentan ausgeschöpft. Es wurde kein weiterer Speicherbeleg angelegt; bitte später erneut versuchen.
          </p>
        ) : (
          <p className="text-gray-500 mb-3 max-w-md mx-auto">
            Der private Speicher konnte den Originalbeleg momentan nicht bestätigen. Das ist kein bewiesener Verlust; die manuelle Erfassung läuft deshalb ausdrücklich ohne Dokumentquelle weiter.
          </p>
        )}
        {fallbackState.record?.id && (
          <p className="mb-8 font-mono text-xs text-gray-500">Recovery-ID: {fallbackState.record.id}</p>
        )}

        <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
          <button
            onClick={() => openErfassung({
              mode: "order",
              source: canRetainSource ? "scan" : "manual",
              ...(canRetainSource ? { sourceRef: fallbackState.record!.id } : {}),
            })}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            Manuell weiterverarbeiten
          </button>
          <button
            onClick={() => { setFallbackState(null); setIsUploading(false); }}
            className="w-full py-3 px-4 bg-white text-gray-700 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Neue Datei wählen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10 flex flex-col items-center justify-center min-h-[60vh] text-center">
      {!isUploading ? (
        <div className="max-w-md w-full">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
            <Camera className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-semibold text-gray-900 mb-3 tracking-tight">Dokument scannen</h2>
          <p className="text-gray-500 mb-8 text-lg">
            JPEG, PNG oder PDF werden zuerst privat und mit Prüfsumme gespeichert. Erst danach darf die KI auswerten.
          </p>
          <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-blue-300 bg-blue-50/50 rounded-2xl cursor-pointer hover:bg-blue-50 transition-colors group">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <UploadCloud className="w-10 h-10 text-blue-400 group-hover:text-blue-500 mb-3 transition-colors" />
              <p className="mb-2 text-sm text-gray-700 font-medium"><span className="text-blue-600">Klicken</span> oder Drag & Drop</p>
              <p className="text-xs text-gray-500">JPEG, PNG, PDF (max. 14 MB)</p>
            </div>
            <input
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,application/pdf"
              onChange={handleFileChange}
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center animate-in zoom-in duration-300">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-gray-100 rounded-full" />
            <div className="w-20 h-20 border-4 border-blue-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0" />
            <div className="absolute inset-0 flex items-center justify-center text-blue-600">
              <FileText className="w-6 h-6 animate-pulse" />
            </div>
          </div>
          <h3 className="mt-6 text-xl font-medium text-gray-900">{statusText}</h3>
          <p className="text-gray-500 mt-2">Ein unbekannter Ausgang wird nicht als Erfolg oder Speicherfehler ausgegeben.</p>
        </div>
      )}
    </div>
  );
}
