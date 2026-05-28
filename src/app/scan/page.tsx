"use client";

import { useState } from "react";
import { CameraCapture } from "@/components/intake/CameraCapture";
import { OCRReviewPanel } from "@/components/intake/OCRReviewPanel";
import { SuggestedItemsPanel } from "@/components/intake/SuggestedItemsPanel";
import { OCRScan } from "@/lib/services/ocrService";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ScanPage() {
  const [scan, setScan] = useState<OCRScan | null>(null);
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
        <>
          {/* Review the OCR‑result */}
          <OCRReviewPanel scan={scan} onConfirm={handleConfirm} />
          {/* Show any suggested parts from the scan */}
          <SuggestedItemsPanel 
            ocrData={scan.extractedFields.reduce((acc, f) => ({ ...acc, [f.key]: f.value }), {} as Record<string, string>)} 
            onConfirm={(items) => console.log("Items confirmed", items)} 
          />
        </>
      ) : (
        <CameraCapture onScanComplete={setScan} />
      )}
    </div>
  );
}
