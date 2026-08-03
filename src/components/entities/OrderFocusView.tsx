"use client";

import { useState } from "react";
import { Order } from "@/lib/repositories/ordersRepository";
import { X, Save, Printer, Loader2 } from "lucide-react";
import { generateOrderLabel } from "@/app/actions/pdf.actions";

interface OrderFocusViewProps {
  order: Order;
  onClose: () => void;
  onSave: (changes: Partial<Order>) => Promise<void>;
}

export function OrderFocusView({ order, onClose, onSave }: OrderFocusViewProps) {
  const [risk, setRisk] = useState(order.risk);
  const [station, setStation] = useState(order.station);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ risk, station });
      setHasChanges(false);
    } catch (e) {
      console.error("Fehler beim Speichern", e);
    } finally {
      setIsSaving(false);
    }
  };

  const [isPrinting, setIsPrinting] = useState(false);
  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const base64 = await generateOrderLabel(order.id);
      const url = `data:application/pdf;base64,${base64}`;
      const win = window.open();
      if (win) {
        win.document.write(`<iframe src="${url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
        win.document.title = `Laufkarte_${order.orderNumber}.pdf`;
      } else {
        // Fallback to download if popup blocked
        const a = document.createElement("a");
        a.href = url;
        a.download = `Laufkarte_${order.orderNumber}.pdf`;
        a.click();
      }
    } catch (e) {
      console.error("Fehler beim Generieren der Laufkarte", e);
      alert("Fehler beim Generieren der Laufkarte.");
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-app">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-navy-900 text-white shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="font-mono text-lg font-bold">{order.orderNumber}</h2>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-navy-700 text-white uppercase tracking-wider">
            {order.station}
          </span>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <X className="w-5 h-5 text-white/70 hover:text-white" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
        {/* Core Info */}
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-navy-900 leading-tight">{order.task}</h1>
          <p className="text-sm font-semibold text-text-muted">{order.title || "Keine weitere Beschreibung"}</p>
        </div>

        {/* Inline Editing: Status */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-navy-900 uppercase tracking-wider block">Priorität / Status</label>
          <div className="flex gap-2">
            {(["green", "yellow", "orange", "red", "blocked"] as const).map(r => (
              <button
                key={r}
                onClick={() => { setRisk(r); setHasChanges(true); }}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all border-2 ${
                  risk === r 
                    ? "border-navy-900 bg-navy-900 text-white shadow-md scale-105" 
                    : "border-neutral-gray-200 bg-white text-text-muted hover:border-neutral-gray-300 hover:bg-neutral-gray-50"
                }`}
              >
                {r === "green" ? "Im Plan" : r === "yellow" ? "Achtung" : r === "orange" ? "Gefahr" : r === "red" ? "Kritisch" : "Wartend"}
              </button>
            ))}
          </div>
        </div>

        {/* Inline Editing: Station */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-navy-900 uppercase tracking-wider block">Aktuelle Arbeitsstation</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(["wareneingang", "entmetallisierung", "schleiferei", "beschichtung", "warenausgang"] as const).map(s => (
              <button
                key={s}
                onClick={() => { setStation(s); setHasChanges(true); }}
                className={`py-2 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all border-2 ${
                  station === s 
                    ? "border-navy-900 bg-navy-900 text-white shadow-md" 
                    : "border-neutral-gray-200 bg-white text-text-muted hover:border-neutral-gray-300 hover:bg-neutral-gray-50"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Footer / Actions */}
      <div className="p-4 border-t border-neutral-gray-200 bg-white flex justify-end gap-3 shrink-0">
        <button 
          onClick={onClose}
          className="px-6 py-2.5 text-sm font-bold text-text-muted hover:text-navy-900 hover:bg-neutral-gray-100 rounded-xl transition-colors"
        >
          Schließen
        </button>
        <button
          onClick={handlePrint}
          disabled={isPrinting}
          className="px-6 py-2.5 text-sm font-bold rounded-xl flex items-center gap-2 transition-all bg-navy-900 text-white hover:bg-navy-800 shadow-md mr-auto"
        >
          {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
          Laufkarte drucken
        </button>
        <button 
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={`px-6 py-2.5 text-sm font-bold rounded-xl flex items-center gap-2 transition-all ${
            hasChanges && !isSaving
              ? "bg-navy-900 text-white hover:bg-navy-800 shadow-md"
              : "bg-neutral-gray-100 text-neutral-gray-400 cursor-not-allowed"
          }`}
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Speichere..." : "Änderungen speichern"}
        </button>
      </div>

    </div>
  );
}
