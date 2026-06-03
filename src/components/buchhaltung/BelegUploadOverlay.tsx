"use client";

import { useState, useRef } from "react";
import { X, Upload, Camera, CheckCircle2, AlertTriangle, Loader2, FileText } from "lucide-react";
import { MockOcrProvider } from "@/lib/buchhaltung/ocr/MockOcrProvider";
import type { OcrResult } from "@/lib/buchhaltung/types";

interface BelegUploadOverlayProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (result: OcrResult, filename: string, mode: "erfasst" | "entwurf", rawFile?: File) => void;
  mode: "foto" | "upload";
}

type Phase = "idle" | "processing" | "result";

const CATEGORY_MAP: Record<string, { id: string; label: string; skr: string }> = {
  tankbeleg: { id: "kraftstoff", label: "Kraftstoff", skr: "4530" },
  bewirtung: { id: "bewirtung", label: "Bewirtung", skr: "4650" },
  rechnung: { id: "material", label: "Material & Chemie", skr: "3400" },
  abo: { id: "buero", label: "Büro & Software", skr: "4930" },
  kassenbon: { id: "buero", label: "Büro & Software", skr: "4930" },
};

export function BelegUploadOverlay({ open, onClose, onSubmit, mode }: BelegUploadOverlayProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [filename, setFilename] = useState("");
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrProvider = useRef(new MockOcrProvider());

  if (!open) return null;

  const handleFileSelect = async (selectedFilename: string) => {
    setFilename(selectedFilename);
    setPhase("processing");

    try {
      const result = await ocrProvider.current.extract({
        data: "mock-data",
        filename: selectedFilename,
        mimeType: selectedFilename.endsWith(".pdf") ? "application/pdf" : "image/jpeg",
      });
      setOcrResult(result);
      setPhase("result");
    } catch {
      setPhase("idle");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRawFile(file);
      handleFileSelect(file.name);
    }
  };

  const handleSimulateCapture = () => {
    const demoFiles = ["shell_tankbeleg.jpg", "gasthaus_adler_beleg.jpg", "riedel_rechnung.pdf", "microsoft_abo.pdf", "aral_tankbeleg.jpg"];
    const randomFile = demoFiles[Math.floor(Math.random() * demoFiles.length)];
    handleFileSelect(randomFile);
  };

  const handleClose = () => {
    setPhase("idle");
    setFilename("");
    setOcrResult(null);
    setRawFile(null);
    onClose();
  };

  const handleSubmit = (submitMode: "erfasst" | "entwurf") => {
    if (ocrResult) {
      onSubmit(ocrResult, filename, submitMode, rawFile || undefined);
      handleClose();
    }
  };

  const cat = ocrResult?.belegart ? CATEGORY_MAP[ocrResult.belegart] : null;
  const isLowConfidence = ocrResult ? ocrResult.confidence < 85 : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-3xl sm:shadow-2xl overflow-y-auto z-10">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-4 sm:p-6 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            {mode === "foto" ? <Camera className="w-5 h-5 text-rose-500" /> : <Upload className="w-5 h-5 text-blue-500" />}
            <h2 className="text-lg font-extrabold text-[#1e1b18]">
              {mode === "foto" ? "Beleg fotografieren" : "Beleg hochladen"}
            </h2>
          </div>
          <button onClick={handleClose} className="w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center transition-colors">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {phase === "idle" && (
            <div className="flex flex-col items-center justify-center py-8 sm:py-12">
              <div className="w-24 h-24 rounded-3xl bg-neutral-50 border-2 border-dashed border-neutral-300 flex items-center justify-center mb-6">
                {mode === "foto" ? <Camera className="w-10 h-10 text-neutral-400" /> : <Upload className="w-10 h-10 text-neutral-400" />}
              </div>
              <p className="text-sm text-neutral-600 mb-6 text-center max-w-sm">
                {mode === "foto"
                  ? "Fotografiere deinen Beleg. Die KI erkennt automatisch Lieferant, Betrag und Kategorie."
                  : "Lade eine Datei hoch (PDF, JPG, PNG). Die KI liest den Beleg automatisch aus."}
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleInputChange}
              />

              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                {mode === "foto" ? (
                  <button
                    onClick={handleSimulateCapture}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-[#1e1b18] text-white rounded-xl font-bold text-sm hover:bg-black transition-colors min-h-[48px]"
                  >
                    <Camera className="w-4 h-4" /> Foto aufnehmen (Demo)
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-[#1e1b18] text-white rounded-xl font-bold text-sm hover:bg-black transition-colors min-h-[48px]"
                    >
                      <Upload className="w-4 h-4" /> Datei auswählen
                    </button>
                    <button
                      onClick={handleSimulateCapture}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-[#1e1b18] border border-neutral-200 rounded-xl font-bold text-sm hover:bg-neutral-50 transition-colors min-h-[48px]"
                    >
                      Demo-Beleg laden
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {phase === "processing" && (
            <div className="flex flex-col items-center justify-center py-12 sm:py-16">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-6" />
              <p className="text-base font-extrabold text-[#1e1b18] mb-2">Beleg wird gelesen …</p>
              <p className="text-xs text-neutral-500">{filename}</p>
            </div>
          )}

          {phase === "result" && ocrResult && (
            <div className="space-y-6">
              {/* Status Banner */}
              <div className={`flex items-center gap-3 p-4 rounded-2xl ${isLowConfidence ? "bg-amber-50 border border-amber-200" : "bg-emerald-50 border border-emerald-200"}`}>
                {isLowConfidence ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                )}
                <div>
                  <p className={`text-sm font-extrabold ${isLowConfidence ? "text-amber-800" : "text-emerald-800"}`}>
                    {isLowConfidence ? "Prüfung erforderlich" : "Erfolgreich erkannt"}
                  </p>
                  <p className={`text-xs ${isLowConfidence ? "text-amber-600" : "text-emerald-600"}`}>
                    Confidence: {ocrResult.confidence.toFixed(1)} % · {filename}
                  </p>
                </div>
              </div>

              {/* Preview + Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Preview */}
                <div className="bg-neutral-50 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[160px] border border-neutral-100">
                  <FileText className="w-12 h-12 text-neutral-300 mb-2" />
                  <p className="text-xs text-neutral-400 font-bold">{filename}</p>
                  <p className="text-[10px] text-neutral-400 mt-1">Original im GoBD-Storage (später)</p>
                </div>

                {/* Recognized Fields */}
                <div className="space-y-3">
                  <FieldRow label="Lieferant" value={ocrResult.lieferant} />
                  <FieldRow label="Datum" value={ocrResult.datum} />
                  <FieldRow label="Brutto" value={ocrResult.brutto ? `${ocrResult.brutto.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €` : undefined} />
                  <FieldRow label="Netto" value={ocrResult.netto ? `${ocrResult.netto.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €` : undefined} />
                  <FieldRow label="USt" value={ocrResult.ustBetrag ? `${ocrResult.ustBetrag.toLocaleString("de-DE", { minimumFractionDigits: 2 })} € (${ocrResult.ustSatz} %)` : undefined} />
                  <FieldRow label="Kategorie" value={cat?.label} />
                  <FieldRow label="SKR-Konto" value={cat?.skr} />
                  <FieldRow label="Belegart" value={ocrResult.belegart} />
                  <FieldRow label="Confidence" value={`${ocrResult.confidence.toFixed(1)} %`} highlight={isLowConfidence} />
                </div>
              </div>

              {/* KI Hint for low confidence */}
              {isLowConfidence && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
                  <strong>Hinweis:</strong> Die Erkennung liegt unter dem Schwellenwert. Bitte prüfe die Felder manuell bevor du den Beleg übernimmst.
                  {ocrResult.belegart === "bewirtung" && (
                    <span className="block mt-1">Bei Bewirtungsbelegen: Anlass und Teilnehmer auf der Rückseite ergänzen (§ 4 Abs. 5 Nr. 2 EStG).</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer / Actions */}
        {phase === "result" && (
          <div className="sticky bottom-0 bg-white border-t border-neutral-100 p-4 sm:p-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              onClick={handleClose}
              className="px-5 py-3 text-sm font-bold text-neutral-500 hover:text-[#1e1b18] transition-colors rounded-xl hover:bg-neutral-50 min-h-[48px] order-3 sm:order-1"
            >
              Abbrechen
            </button>
            <button
              onClick={() => handleSubmit("entwurf")}
              className="px-5 py-3 text-sm font-bold text-[#1e1b18] bg-white border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors min-h-[48px] order-2"
            >
              Als Entwurf übernehmen
            </button>
            <button
              onClick={() => handleSubmit(isLowConfidence ? "entwurf" : "erfasst")}
              className="px-5 py-3 text-sm font-bold text-white bg-[#1e1b18] rounded-xl hover:bg-black transition-colors min-h-[48px] order-1 sm:order-3"
            >
              {isLowConfidence ? "Zur Prüfung übernehmen" : "Übernehmen"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldRow({ label, value, highlight }: { label: string; value?: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-neutral-500 font-semibold">{label}</span>
      <span className={`font-bold ${highlight ? "text-amber-600" : value ? "text-[#1e1b18]" : "text-neutral-300"}`}>
        {value || "—"}
      </span>
    </div>
  );
}
