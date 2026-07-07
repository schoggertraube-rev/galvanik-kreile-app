"use client";
import { AlertCircle } from "lucide-react";
import { OcrResult } from "@/lib/ocr/geminiOcr";

export function CameraCapture(props: {
  onScanComplete: (scan: OcrResult, base64Image?: string) => void;
  onCancel?: () => void;
}) {
  void props;

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto animate-in zoom-in-95 duration-300">
      <div className="flex flex-col items-center justify-center h-[460px] w-full bg-navy-900 rounded-3xl relative overflow-hidden shadow-2xl border border-navy-900">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-text-muted bg-navy-900">
          <AlertCircle className="w-12 h-12 text-accent-orange mb-4" />
          <p className="font-bold text-white mb-2">Komponente Deaktiviert</p>
          <p className="text-sm">Die direkte Kameraerfassung vor dem Upload wurde aus Sicherheitsgründen entfernt.</p>
        </div>
      </div>
    </div>
  );
}
