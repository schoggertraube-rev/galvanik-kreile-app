"use client";

import { useErfassung } from "../ErfassungProvider";
import { FileText, UserPlus, PackagePlus, Link, ArrowRight, Building2, User } from "lucide-react";
import { AiBadge } from "../shared/AiBadge";

export function ScanResult({ data }: { data: any }) {
  const { openErfassung, closeErfassung } = useErfassung();

  const handleNewOrder = () => {
    openErfassung({
      mode: "order",
      prefill: data.extracted,
      source: "scan",
      sourceRef: data.id
    });
  };

  const handleOnlyCustomer = () => {
    // Navigate to customer creation or open manual flow with only customer section
    alert("Kunde anlegen Flow (WIP)");
    closeErfassung();
  };

  const handleAssignToOrder = () => {
    alert("Bestehendem Auftrag zuordnen (WIP)");
    closeErfassung();
  };

  const handleToAccounting = () => {
    alert("Als Beleg an Buchhaltung senden (WIP)");
    closeErfassung();
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

  const detectedType = data.detectedType || "unbekannt";
  const confidence = data.detectionConfidence ? Math.round(data.detectionConfidence * 100) : 0;
  const ext = data.extractedData || {};

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

          <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Erkannte Daten</h4>
            
            {ext.customer && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm">
                  <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
                  <span className="text-gray-700">{ext.customer.companyName || ext.customer.name || "Kein Name erkannt"}</span>
                </div>
                {ext.customer.address && (
                  <div className="text-sm text-gray-600 pl-6">{ext.customer.address}</div>
                )}
              </div>
            )}

            {ext.items && ext.items.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-xs font-semibold text-gray-500 mb-2">ERFASSTE TEILE ({ext.items.length})</div>
                <ul className="space-y-2">
                  {ext.items.map((item: any, i: number) => (
                    <li key={i} className="text-sm text-gray-700 flex justify-between">
                      <span>{item.quantity}x {item.name}</span>
                      <span className="text-gray-500">{item.material}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {!ext.customer && (!ext.items || ext.items.length === 0) && (
              <p className="text-sm text-gray-500 italic">Keine strukturierten Daten extrahiert.</p>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="w-full lg:w-80 flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Was möchten Sie tun?</h4>
          
          <button 
            onClick={handleNewOrder}
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
            onClick={handleAssignToOrder}
            className="group flex flex-col p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="flex items-center gap-2 text-gray-900 font-medium mb-1">
              <Link className="w-5 h-5 text-gray-500 group-hover:text-gray-700" />
              Bestehendem zuordnen
            </div>
            <p className="text-sm text-gray-500">
              Dokument an einen laufenden Auftrag hängen.
            </p>
          </button>

          <div className="flex gap-3 mt-2">
            <button 
              onClick={handleOnlyCustomer}
              className="flex-1 flex flex-col items-center justify-center p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <UserPlus className="w-5 h-5 text-gray-500 mb-1" />
              <span className="text-xs font-medium text-gray-700">Nur Kunde</span>
            </button>
            <button 
              onClick={handleToAccounting}
              className="flex-1 flex flex-col items-center justify-center p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
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
