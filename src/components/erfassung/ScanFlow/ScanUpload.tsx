"use client";

import { useState } from "react";
import { UploadCloud, Loader2, Camera, FileText } from "lucide-react";
import { useErfassung } from "../ErfassungProvider";

export function ScanUpload() {
  const { openErfassung, closeErfassung } = useErfassung();
  const [isUploading, setIsUploading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [fallbackState, setFallbackState] = useState<{ type: "ai_failed" | "storage_failed" | "status_unknown", record?: { id?: string; status?: string } } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setIsUploading(true);
    setStatusText("Lade Dokument hoch...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      
      setStatusText("KI analysiert Dokument...");
      const res = await fetch("/api/erfassung/scan-upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      // We wait for the background edge function to complete. We could poll here.
      // But let's assume the API route returns the ID, we then poll scan-status.
      const data = await res.json();
      
      // Polling for status
      let attempts = 0;
      let scanRecord = null;
      while (attempts < 20) {
        await new Promise(r => setTimeout(r, 1500));
        const statusRes = await fetch(`/api/erfassung/scan-status/${data.id}`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (["processed", "secured", "error"].includes(statusData.status)) {
            scanRecord = statusData;
            break;
          }
        }
        attempts++;
      }

      if (scanRecord?.status === "processed") {
        openErfassung({ mode: "scan", prefill: { scanResult: scanRecord } });
      } else if (scanRecord?.status === "secured") {
        setFallbackState({ type: "ai_failed", record: scanRecord });
        setIsUploading(false);
      } else if (scanRecord?.status === "error") {
        setFallbackState({ type: "storage_failed", record: scanRecord });
        setIsUploading(false);
      } else {
        setFallbackState({ type: "status_unknown", record: { id: data.id, status: "unknown" } });
        setIsUploading(false);
      }
      
    } catch (err) {
      console.error(err);
      // Fallback: Complete failure (storage/network)
      setFallbackState({ type: "storage_failed" });
      setIsUploading(false);
    }
  };

  if (fallbackState) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
          <FileText className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-3 tracking-tight">
          Manuelle Weiterverarbeitung
        </h2>
        {fallbackState.type === "ai_failed" ? (
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Die Datei wurde erfolgreich gespeichert, aber die KI-Auswertung konnte nicht abgeschlossen werden. Du kannst die Datei nun manuell einem neuen Vorgang zuweisen.
          </p>
        ) : fallbackState.type === "status_unknown" ? (
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Der Upload wurde angenommen, sein Verarbeitungsstatus konnte aber nicht bestätigt werden. Die Scan-ID bleibt als Herkunft erhalten; es wird kein KI-Erfolg behauptet.
          </p>
        ) : (
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Es gab ein Problem beim Hochladen der Datei. Du kannst den Vorgang trotzdem manuell ohne Datei fortsetzen.
          </p>
        )}
        
        <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
          <button 
            onClick={() => openErfassung({
              mode: "order",
              source: fallbackState.type === "storage_failed" ? "manual" : "scan",
              ...(fallbackState.type !== "storage_failed" && fallbackState.record?.id ? { sourceRef: fallbackState.record.id } : {}),
            })}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            Manuell weiterverarbeiten
          </button>
          <button 
            onClick={() => { setFallbackState(null); setIsUploading(false); }}
            className="w-full py-3 px-4 bg-white text-gray-700 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Erneut versuchen
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
          
          <h2 className="text-3xl font-semibold text-gray-900 mb-3 tracking-tight">
            Dokument scannen
          </h2>
          <p className="text-gray-500 mb-8 text-lg">
            Lade ein Foto oder PDF hoch. Unsere KI erkennt automatisch Lieferscheine, Belege, Teile oder Visitenkarten.
          </p>

          <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-blue-300 bg-blue-50/50 rounded-2xl cursor-pointer hover:bg-blue-50 transition-colors group">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <UploadCloud className="w-10 h-10 text-blue-400 group-hover:text-blue-500 mb-3 transition-colors" />
              <p className="mb-2 text-sm text-gray-700 font-medium">
                <span className="text-blue-600">Klicken</span> oder Drag & Drop
              </p>
              <p className="text-xs text-gray-500">PNG, JPG, PDF (max. 10MB)</p>
            </div>
            <input
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/heic,application/pdf"
              onChange={handleFileChange}
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center animate-in zoom-in duration-300">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-gray-100 rounded-full"></div>
            <div className="w-20 h-20 border-4 border-blue-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
            <div className="absolute inset-0 flex items-center justify-center text-blue-600">
              <FileText className="w-6 h-6 animate-pulse" />
            </div>
          </div>
          <h3 className="mt-6 text-xl font-medium text-gray-900">{statusText}</h3>
          <p className="text-gray-500 mt-2">Das kann ein paar Sekunden dauern...</p>
        </div>
      )}
    </div>
  );
}
