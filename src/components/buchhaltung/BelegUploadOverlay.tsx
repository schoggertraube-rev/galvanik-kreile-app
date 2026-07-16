"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Camera, Loader2, Upload, X } from "lucide-react";

interface BelegUploadOverlayProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (file: File) => Promise<void>;
  mode: "foto" | "upload";
}

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export function BelegUploadOverlay({ open, onClose, onSubmit, mode }: BelegUploadOverlayProps) {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function resetAndClose() {
    if (processing) return;
    setFile(null);
    setError(null);
    onClose();
  }

  function selectFile(selected: File | undefined) {
    setError(null);
    if (!selected) return;
    if (!ALLOWED_TYPES.has(selected.type) || selected.size <= 0 || selected.size > MAX_RECEIPT_BYTES) {
      setFile(null);
      setError("Erlaubt sind PDF, JPG, PNG oder WebP bis 10 MB.");
      return;
    }
    setFile(selected);
  }

  async function upload() {
    if (!file || processing) return;
    setProcessing(true);
    setError(null);
    try {
      await onSubmit(file);
      setFile(null);
      onClose();
    } catch {
      setError("Der Beleg wurde nicht gespeichert. Es wurde kein lokaler Scheinbeleg angelegt; bitte erneut versuchen.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={resetAndClose} />
      <div className="relative z-10 w-full h-full sm:h-auto sm:max-w-xl bg-white sm:rounded-3xl sm:shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            {mode === "foto" ? <Camera className="w-5 h-5 text-rose-500" /> : <Upload className="w-5 h-5 text-blue-500" />}
            <h2 className="text-lg font-extrabold text-[#1e1b18]">{mode === "foto" ? "Beleg fotografieren" : "Beleg hochladen"}</h2>
          </div>
          <button onClick={resetAndClose} disabled={processing} className="w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center" aria-label="Beleg-Upload schließen">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center py-12">
          <div className="w-24 h-24 rounded-3xl bg-neutral-50 border-2 border-dashed border-neutral-300 flex items-center justify-center mb-6">
            {processing ? <Loader2 className="w-10 h-10 text-blue-500 animate-spin" /> : mode === "foto" ? <Camera className="w-10 h-10 text-neutral-400" /> : <Upload className="w-10 h-10 text-neutral-400" />}
          </div>
          <p className="text-sm text-neutral-600 mb-2 text-center">
            Die Datei wird erst serverseitig gespeichert und anschließend über den echten OCR-Pfad ausgewertet.
          </p>
          <p className="text-xs text-neutral-400 mb-6 text-center">Ohne bestätigte Speicherung erscheint kein Beleg in der Liste.</p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            capture={mode === "foto" ? "environment" : undefined}
            className="hidden"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={processing}
            className="px-6 py-3 bg-[#1e1b18] text-white rounded-xl font-bold text-sm disabled:opacity-50"
          >
            {mode === "foto" ? "Kamera oder Foto auswählen" : "Datei auswählen"}
          </button>

          {file && <div className="mt-5 text-sm font-semibold text-[#1e1b18]">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</div>}
          {error && (
            <div className="mt-5 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="border-t border-neutral-100 p-4 sm:p-6 flex justify-end gap-3">
          <button onClick={resetAndClose} disabled={processing} className="px-5 py-3 text-sm font-bold text-neutral-500">Abbrechen</button>
          <button
            onClick={() => void upload()}
            disabled={!file || processing}
            className="px-5 py-3 text-sm font-bold text-white bg-[#1e1b18] rounded-xl disabled:opacity-50"
          >
            {processing ? "Speichern und analysieren …" : "Verbindlich hochladen"}
          </button>
        </div>
      </div>
    </div>
  );
}
