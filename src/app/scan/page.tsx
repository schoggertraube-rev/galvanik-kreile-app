"use client";

import { useState } from "react";
import { CameraCapture } from "@/components/intake/CameraCapture";
import { OCRReviewPanel } from "@/components/intake/OCRReviewPanel";
import { SuggestedItemsPanel } from "@/components/intake/SuggestedItemsPanel";
import { OcrResult } from "@/lib/ocr/geminiOcr";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ScanPage() {
  const [scan, setScan] = useState<OcrResult | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<string>("");

  const handleConfirm = (data: Record<string, string>) => {
    // For now we simply display a success message. In a real workflow this would create an order.
    console.log("Confirmed scan data", data);
    setConfirmMessage("Scan erfolgreich verarbeitet – Auftrag wird erstellt.");
    // Reset for next scan after a short delay
    setTimeout(() => {
      setScan(null);
      setConfirmMessage("");
    }, 3000);
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <PageHeader title="Scan & KI‑Erfassung" subtitle="Dokumente, Lieferscheine oder Bauteile – mit KI schnell erfassen" />
      {confirmMessage && (
        <div className="mb-4 p-3 bg-success-green-soft text-success-green rounded-lg shadow-md">
          {confirmMessage}
        </div>
      )}
      {scan ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-neutral-gray-300">
            <h2 className="text-xl font-bold mb-4">Erkanntes Dokument</h2>
            <pre className="text-xs bg-gray-100 p-4 rounded-xl overflow-auto whitespace-pre-wrap">
              {scan.rawText}
            </pre>
            <div className="mt-4 flex gap-4">
              <button 
                onClick={() => setScan(null)}
                className="flex-1 bg-neutral-gray-200 p-3 rounded-xl font-bold"
              >
                Erneut scannen
              </button>
              <button 
                onClick={() => handleConfirm({})}
                className="flex-1 bg-navy-900 text-white p-3 rounded-xl font-bold"
              >
                Bestätigen
              </button>
            </div>
          </div>
          {/* Show any suggested parts from the scan */}
          <SuggestedItemsPanel 
            ocrData={{
              customerName: scan.customerName || scan.company || "",
              itemName: scan.articleDescription || "",
              quantity: scan.quantity?.toString() || "",
              surfaceRequested: scan.surface || ""
            }} 
            onConfirm={(items) => console.log("Items confirmed", items)} 
          />
        </div>
      ) : (
        <CameraCapture onScanComplete={setScan} />
      )}
    </div>
  );
}
