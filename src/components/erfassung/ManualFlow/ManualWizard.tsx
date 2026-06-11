"use client";

import { useState } from "react";
import { useErfassung } from "../ErfassungProvider";
import { User, Package, Calendar, Sparkles, MessageSquare } from "lucide-react";
import { CustomerSection } from "./CustomerSection";
import { ItemsSection } from "./ItemsSection";
import { DateSection } from "./DateSection";

export function ManualWizard() {
  const { contextData, closeErfassung } = useErfassung();
  
  // State for the three mandatory sections
  const [customer, setCustomer] = useState<any>(contextData?.prefill?.customer || null);
  const [items, setItems] = useState<any[]>(contextData?.prefill?.items || []);
  const [dateInfo, setDateInfo] = useState<any>({ priority: contextData?.prefill?.order?.priority || "normal" });
  
  // Optional toggles
  const [showFreetext, setShowFreetext] = useState(false);
  const [showBehavior, setShowBehavior] = useState(!!contextData?.prefill?.behaviorNote);
  const [behaviorNote, setBehaviorNote] = useState(contextData?.prefill?.behaviorNote?.text || "");

  const handleSave = async () => {
    // Basic validation
    if (!customer) return alert("Bitte wähle einen Kunden aus.");
    if (items.length === 0) return alert("Bitte füge mindestens ein Teil hinzu.");
    if (!dateInfo.dueDate) return alert("Bitte gib einen Liefertermin an.");

    try {
      // Here we would call the Server Action
      // e.g. await createOrderAction({ customer, items, dateInfo, behaviorNote, source: contextData?.source })
      alert("Auftrag erfolgreich angelegt! (WIP)");
      closeErfassung();
    } catch (e) {
      alert("Fehler beim Speichern.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {contextData?.isQuote ? "KV-Anfrage anlegen" : "Neuen Auftrag anlegen"}
          </h2>
          <p className="text-sm text-gray-500">
            Bitte fülle die drei Pflichtbereiche aus.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFreetext(!showFreetext)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2
              ${showFreetext ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
          >
            <Sparkles className="w-4 h-4" />
            Freitext & KI
          </button>
          <button
            onClick={() => setShowBehavior(!showBehavior)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2
              ${showBehavior ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
          >
            <MessageSquare className="w-4 h-4" />
            Verhaltensnotiz
          </button>
        </div>
      </div>

      {/* Main Form */}
      <div className="p-6 space-y-8 overflow-y-auto flex-1">
        
        {/* Optional: Verhaltensnotiz */}
        {showBehavior && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 animate-in slide-in-from-top-2">
            <label className="block text-sm font-bold text-yellow-800 uppercase tracking-wider mb-2">
              Verhaltensnotiz zum Kunden
            </label>
            <textarea
              className="w-full bg-white/50 border border-yellow-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-yellow-500 focus:outline-none"
              rows={3}
              placeholder="Besondere Vorlieben, typisches Verhalten..."
              value={behaviorNote}
              onChange={(e) => setBehaviorNote(e.target.value)}
            />
            <p className="text-xs text-yellow-700 mt-2">Wird direkt am Kundenprofil gespeichert und in Zukunft angezeigt.</p>
          </div>
        )}

        {/* 1. Kunde */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50/80 border-b border-gray-100 px-5 py-3 flex items-center gap-2">
            <User className="w-5 h-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900">1. Kunde</h3>
          </div>
          <div className="p-5">
            <CustomerSection customer={customer} onChange={setCustomer} />
          </div>
        </section>

        {/* 2. Teile */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50/80 border-b border-gray-100 px-5 py-3 flex items-center gap-2">
            <Package className="w-5 h-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900">2. Teile & Leistungen</h3>
          </div>
          <div className="p-5 bg-gray-50/30">
            <ItemsSection items={items} onChange={setItems} />
          </div>
        </section>

        {/* 3. Termin */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50/80 border-b border-gray-100 px-5 py-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900">3. Termin & Lieferung</h3>
          </div>
          <div className="p-5">
            <DateSection dateInfo={dateInfo} onChange={setDateInfo} />
          </div>
        </section>

      </div>

      {/* Footer / Actions */}
      <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-between items-center sticky bottom-0">
        <button
          onClick={closeErfassung}
          className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Abbrechen
        </button>
        <button
          onClick={handleSave}
          className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm shadow-blue-200 transition-all"
        >
          Auftrag speichern
        </button>
      </div>
    </div>
  );
}
