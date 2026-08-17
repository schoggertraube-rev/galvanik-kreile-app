"use client";
import { ArrowLeft, CameraOff } from "lucide-react";
export function CameraCapture({ onScanComplete, onCancel }: { onScanComplete: (scan: never, base64Image?: string) => void; onCancel?: () => void }) {
  void onScanComplete;
  return <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto">{onCancel && <button onClick={onCancel} className="flex items-center gap-2 text-navy-500 hover:text-navy-900 font-bold text-sm self-start px-3 py-2 rounded-xl"><ArrowLeft className="w-4 h-4" /> Zurück</button>}<div className="flex flex-col items-center justify-center h-[460px] w-full bg-navy-900 rounded-3xl p-6 text-center text-white"><CameraOff className="w-12 h-12 mb-4" /><h2 className="font-bold text-lg">Kamera-Erfassung nicht verfügbar</h2><p className="mt-2 text-sm text-slate-200">Bild- und KI-Verarbeitung bleiben bis zum sicheren Server-Command-Vertrag geschlossen.</p></div></div>;
}
