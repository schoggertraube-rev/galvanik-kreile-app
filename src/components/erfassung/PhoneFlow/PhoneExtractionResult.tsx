"use client";

import { useErfassung } from "../ErfassungProvider";
import { Phone, PackagePlus, UserPlus, Save } from "lucide-react";
import { AiBadge } from "../shared/AiBadge";

export function PhoneExtractionResult({ data }: { data: any }) {
  const { openErfassung, closeErfassung } = useErfassung();

  const handleCreateQuote = () => {
    openErfassung({
      mode: "order",
      intent: "create_quote",
      prefill: data.extracted,
      source: "phone",
      sourceRef: data.id
    });
  };

  const handleOnlyCustomer = () => {
    openErfassung({
      mode: "customer",
      prefill: { customer: data.extracted?.customer, behaviorNote: data.extracted?.behaviorNote },
      source: "phone",
      sourceRef: data.id
    });
  };

  const handleKeepOnlyNote = () => {
    alert("Notiz wurde bereits gespeichert. Keine weitere Aktion nötig.");
    closeErfassung();
  };

  const ext = data?.extracted || {};

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
          <Phone className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Aus Telefonnotiz erkannt</h2>
          <p className="text-gray-500">Möchten Sie daraus direkt etwas anlegen?</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Left: Extracted Data Preview */}
        <div className="flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Erkannte Auftragsdaten</span>
            <AiBadge />
          </div>
          <div className="p-5 space-y-4">
            {ext.customer && (
              <div className="text-sm">
                <span className="font-medium text-gray-900">{ext.customer.companyName || ext.customer.name || "Kunde erkannt"}</span>
                {ext.customer.city && <span className="text-gray-500 ml-2">{ext.customer.city}</span>}
              </div>
            )}
            
            {ext.items?.length > 0 && (
              <div className="text-sm text-gray-700">
                <span className="font-semibold text-gray-900 block mb-1">Teile:</span>
                {ext.items.map((item: any, i: number) => (
                  <div key={i}>{item.quantity}x {item.name} ({item.surfaceRequested || item.material || "Keine Oberfläche"})</div>
                ))}
              </div>
            )}

            {ext.order?.title && (
              <div className="text-sm text-gray-700">
                <span className="font-semibold text-gray-900">Anfrage: </span> {ext.order.title}
              </div>
            )}
          </div>
        </div>

        {/* Right: Behavior Hint */}
        {ext.behaviorNote?.text && (
          <div className="w-full md:w-64 bg-yellow-50 border border-yellow-200 rounded-xl p-5 flex flex-col">
            <div className="text-xs font-bold text-yellow-800 uppercase tracking-wider mb-2">Verhaltenshinweis erkannt</div>
            <p className="text-sm text-yellow-900 flex-1">{ext.behaviorNote.text}</p>
            <div className="mt-4 text-xs text-yellow-700 font-medium">Wird beim Anlegen übernommen</div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={handleCreateQuote}
          className="flex flex-col items-center justify-center p-4 bg-white border-2 border-blue-600 rounded-xl hover:bg-blue-50 transition-colors"
        >
          <PackagePlus className="w-6 h-6 text-blue-600 mb-2" />
          <span className="font-bold text-blue-700">KV-Anfrage anlegen</span>
        </button>

        <button
          onClick={handleOnlyCustomer}
          className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <UserPlus className="w-6 h-6 text-gray-500 mb-2" />
          <span className="font-medium text-gray-900">Nur Kunde anlegen</span>
        </button>

        <button
          onClick={handleKeepOnlyNote}
          className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <Save className="w-6 h-6 text-gray-500 mb-2" />
          <span className="font-medium text-gray-900">Nur Notiz behalten</span>
        </button>
      </div>
    </div>
  );
}
