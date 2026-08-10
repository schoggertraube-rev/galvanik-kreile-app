"use client";
import { Camera, FileText, UploadCloud } from "lucide-react";
import { useErfassung } from "../ErfassungProvider";
export function ScanUpload() {
  const { openErfassung } = useErfassung();
  return <div className="p-10 flex flex-col items-center justify-center min-h-[60vh] text-center"><div className="max-w-md w-full"><div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm"><Camera className="w-8 h-8" /></div><h2 className="text-3xl font-semibold text-gray-900 mb-3 tracking-tight">Dokument scannen</h2><p className="text-gray-500 mb-8 text-lg">Scan und KI-Auswertung sind bis zum sicheren Server-Command-Vertrag nicht verfügbar.</p><button disabled title="Nicht verfügbar: sicherer Server-Command-Vertrag fehlt." className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-blue-300 bg-blue-50/50 rounded-2xl opacity-50 cursor-not-allowed"><UploadCloud className="w-10 h-10 text-blue-400 mb-3" /><span className="text-sm text-gray-700 font-medium">Upload nicht verfügbar</span></button><button onClick={() => openErfassung({ mode: "order", source: "scan" })} className="mt-4 inline-flex items-center gap-2 text-blue-700 font-medium"><FileText className="w-4 h-4" /> Manuell ohne Dokument fortfahren</button></div></div>;
}
