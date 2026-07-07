"use client";

import { FileText, PackagePlus } from "lucide-react";
import { AiBadge } from "../shared/AiBadge";
import { Eingangskarte } from "./Eingangskarte";
import { useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ScanResult({ data }: { data: any }) {
  const [localData, setLocalData] = useState(data);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSaveReview = async (scanId: string, updatedData: any) => {
    const { saveScanReview } = await import("@/app/actions/review.actions");
    const result = await saveScanReview(scanId, updatedData);
    if (result.error) {
      throw new Error(result.error);
    }
    // Update local state to reflect review completion
    setLocalData({
      ...localData,
      extractedData: updatedData,
      reviewRequired: false,
    });
  };

  const typeLabels: Record<string, string> = {
    lieferschein: "Lieferschein",
    visitenkarte: "Visitenkarte",
    beleg: "Beleg / Rechnung",
    etikett: "Etikett",
    qr: "QR-Code",
    teil: "Bauteil",
    unbekannt: "Dokument"
  };

  const detectedType = localData.detectedType || "unbekannt";
  const confidence = localData.detectionConfidence ? Math.round(localData.detectionConfidence * 100) : 0;
  const isReviewRequired = localData.reviewRequired !== false;

  return (
    <div className="p-8">
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Left: Preview & Extraction Details */}
        <div className="flex-1 space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-gray-900">
                  {typeLabels[detectedType]} erkannt
                </h3>
                <AiBadge />
              </div>
              <p className="text-sm text-gray-500">
                Sicherheit: {confidence}%
              </p>
            </div>
          </div>

          <div className="mt-6">
            <Eingangskarte 
              scanId={localData.id}
              extractedData={localData.extractedData}
              fieldConfidence={localData.fieldConfidence || {}}
              reviewRequired={isReviewRequired}
              onSave={handleSaveReview}
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="w-full lg:w-80 flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Folgeschritte (erst nach Review)</h4>
          
          <button 
            disabled={true}
            className="group flex flex-col p-4 rounded-xl transition-colors text-left relative overflow-hidden bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
          >
            <div className="flex items-center gap-2 font-bold mb-1">
              <PackagePlus className="w-5 h-5" />
              Auftrag anlegen (B3)
            </div>
            <p className="text-sm pr-6 text-gray-400">
              Automatische Anlage ist im aktuellen V0.3-Scope deaktiviert.
            </p>
          </button>

          <button 
            disabled={true}
            className="group flex flex-col p-4 rounded-xl transition-colors text-left bg-gray-50 border border-gray-200 text-gray-400 cursor-not-allowed"
          >
            <div className="flex items-center gap-2 font-bold mb-1 text-gray-400">
              <PackagePlus className="w-5 h-5" />
              Manuell erfassen (B3)
            </div>
            <p className="text-sm text-gray-400">
              Conversion in B2 noch nicht freigeschaltet.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
