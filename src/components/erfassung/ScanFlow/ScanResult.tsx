"use client";

import { useErfassung } from "../ErfassungProvider";
import { FileText, UserPlus, PackagePlus, Link, Building2 } from "lucide-react";
import { AiBadge } from "../shared/AiBadge";
import type { OcrResult } from "@/lib/ocr/geminiOcr";

type ScanResultData = {
  id?: unknown;
  status?: unknown;
  contentSha256?: unknown;
  fileSizeBytes?: unknown;
  extractedData?: unknown;
  detectedType?: unknown;
  detectionConfidence?: unknown;
};

export function ScanResult({ data }: { data: ScanResultData }) {
  const { openErfassung } = useErfassung();
  const ext: Partial<OcrResult> | null = data?.extractedData && typeof data.extractedData === "object"
    ? data.extractedData as Partial<OcrResult>
    : null;
  const hasConfirmedExtraction = data.status === "processed"
    && typeof data.id === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.id)
    && typeof data.contentSha256 === "string"
    && /^[0-9a-f]{64}$/.test(data.contentSha256)
    && Number.isSafeInteger(data.fileSizeBytes)
    && Number(data.fileSizeBytes) > 0
    && ext !== null;

  const handleNewOrder = () => {
    if (!hasConfirmedExtraction) return;
    const customerName = ext.company || ext.customerName;
    const hasItem = typeof ext.articleDescription === "string" && ext.articleDescription.trim().length > 0;
    openErfassung({
      mode: "order",
      prefill: {
        customer: customerName ? { name: customerName, companyName: ext.company } : null,
        items: hasItem ? [{
          id: crypto.randomUUID(),
          name: ext.articleDescription,
          quantity: typeof ext.quantity === "number" && Number.isSafeInteger(ext.quantity) && ext.quantity > 0 ? ext.quantity : "",
          material: typeof ext.material === "string" ? ext.material : "",
          target: typeof ext.surface === "string" ? ext.surface : "",
          routeTemplateId: "",
        }] : [],
        rawText: typeof ext.rawText === "string" ? ext.rawText : "",
      },
      source: "scan",
      sourceRef: data.id as string,
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

  const detectedType = typeof data.detectedType === "string" ? data.detectedType : "unbekannt";
  const confidence = typeof data.detectionConfidence === "number" && data.detectionConfidence >= 0 && data.detectionConfidence <= 1
    ? Math.round(data.detectionConfidence * 100)
    : null;

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
                  {detectedType === "unbekannt" ? "Dokumentdaten extrahiert" : `${typeLabels[detectedType] || "Dokument"} erkannt`}
                </h3>
                <AiBadge />
              </div>
              {confidence !== null && <p className="text-sm text-gray-500">Modellkonfidenz: {confidence}%</p>}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Erkannte Daten</h4>
            
            {(ext?.company || ext?.customerName) && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm">
                  <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
                  <span className="text-gray-700">{ext.company || ext.customerName}</span>
                </div>
                {ext.address && (
                  <div className="text-sm text-gray-600 pl-6">{ext.address}</div>
                )}
              </div>
            )}

            {ext?.articleDescription && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-xs font-semibold text-gray-500 mb-2">EXTRAHIERTE POSITION</div>
                <ul className="space-y-2">
                  <li className="text-sm text-gray-700 flex justify-between">
                    <span>{Number.isSafeInteger(ext.quantity) ? `${ext.quantity}x ` : "Menge offen · "}{ext.articleDescription}</span>
                    <span className="text-gray-500">{ext.material || "Material offen"}</span>
                  </li>
                </ul>
              </div>
            )}
            
            {!ext?.customerName && !ext?.company && !ext?.articleDescription && (
              <p className="text-sm text-gray-500 italic">Keine strukturierten Daten extrahiert.</p>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="w-full lg:w-80 flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Was möchten Sie tun?</h4>
          
          <button 
            onClick={handleNewOrder}
            disabled={!hasConfirmedExtraction}
            className="group flex flex-col p-4 bg-white border-2 border-blue-600 rounded-xl hover:bg-blue-50 transition-colors text-left"
          >
            <div className="flex items-center gap-2 text-blue-700 font-bold mb-1">
              <PackagePlus className="w-5 h-5" />
              Neuen Auftrag anlegen
            </div>
            <p className="text-sm text-blue-600/80 pr-6">
              Erkannte Daten werden in das Auftrags-Formular übernommen.
            </p>
          </button>

          <button
            disabled
            title="Ein idempotenter Dokument-Zuordnungsbeleg ist noch nicht angebunden"
            className="group flex flex-col p-4 bg-white border border-gray-200 rounded-xl opacity-60 cursor-not-allowed text-left"
          >
            <div className="flex items-center gap-2 text-gray-900 font-medium mb-1">
              <Link className="w-5 h-5 text-gray-500 group-hover:text-gray-700" />
              Bestehendem zuordnen
            </div>
            <p className="text-sm text-gray-500">
              Noch nicht sicher an einen laufenden Auftrag angebunden.
            </p>
          </button>

          <div className="flex gap-3 mt-2">
            <button
              disabled
              title="Der Kunden-Übernahmevertrag ist noch nicht angebunden"
              className="flex-1 flex flex-col items-center justify-center p-3 bg-white border border-gray-200 rounded-xl opacity-60 cursor-not-allowed"
            >
              <UserPlus className="w-5 h-5 text-gray-500 mb-1" />
              <span className="text-xs font-medium text-gray-700">Nur Kunde</span>
            </button>
            <button
              disabled
              title="Die Buchhaltungsübergabe benötigt einen bestätigten Belegvertrag"
              className="flex-1 flex flex-col items-center justify-center p-3 bg-white border border-gray-200 rounded-xl opacity-60 cursor-not-allowed"
            >
              <FileText className="w-5 h-5 text-gray-500 mb-1" />
              <span className="text-xs font-medium text-gray-700">Beleg</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
