"use client";

import { useErfassung } from "../ErfassungProvider";
import { FileText, UserPlus, PackagePlus, Link, Building2 } from "lucide-react";
import { AiBadge } from "../shared/AiBadge";
import { convertScanToOrder } from "@/app/actions/erfassung.actions";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ScanResult({ data }: { data: any }) {
  const { openErfassung, closeErfassung } = useErfassung();
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDirectCreate = async () => {
    setIsCreating(true);
    setErrorMsg(null);
    try {
      const res = await convertScanToOrder(data.id);
      if ("error" in res) {
        setErrorMsg(res.error);
      } else if (res.orderId) {
        closeErfassung();
        router.push(`/orders/${res.orderId}`);
      }
    } catch (e: unknown) {
      setErrorMsg("Ein unerwarteter Fehler ist aufgetreten.");
    } finally {
      setIsCreating(false);
    }
  };

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
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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
          
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
              {errorMsg}
            </div>
          )}

          <button 
            onClick={handleDirectCreate}
            disabled={isCreating}
            className="group flex flex-col p-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-left relative overflow-hidden"
          >
            <div className="flex items-center gap-2 font-bold mb-1">
              {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <PackagePlus className="w-5 h-5" />}
              Auftrag anlegen
            </div>
            <p className="text-sm text-blue-100 pr-6">
              Direkt einen neuen Auftrag aus diesen Daten erstellen.
            </p>
          </button>

          <button 
            onClick={handleNewOrder}
            className="group flex flex-col p-4 bg-white border-2 border-blue-600 rounded-xl hover:bg-blue-50 transition-colors text-left"
          >
            <div className="flex items-center gap-2 text-blue-700 font-bold mb-1">
              <PackagePlus className="w-5 h-5" />
              Manuell erfassen
            </div>
            <p className="text-sm text-blue-600">
              Formular mit erkannten Daten vorausfüllen.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
