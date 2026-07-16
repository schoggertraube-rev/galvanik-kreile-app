"use client";
import { useState } from "react";
import { Plus, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SuggestedItemsPanel({ ocrData, onConfirm }: { ocrData: Record<string, string>, onConfirm: (items: Record<string, unknown>[]) => void }) {
  const [items, setItems] = useState<Array<{ id: string; name: string; quantity: number | ""; surfaceRequested: string }>>(() => {
    const detectedQuantity = Number(ocrData.quantity);
    return [{
      id: crypto.randomUUID(),
      name: ocrData.itemName || "",
      quantity: Number.isSafeInteger(detectedQuantity) && detectedQuantity > 0 ? detectedQuantity : "",
      surfaceRequested: ocrData.surfaceRequested || "",
    }];
  });

  const updateItem = (index: number, key: string, val: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [key]: val };
    setItems(newItems);
  }

  const addItem = () => setItems([...items, { id: crypto.randomUUID(), name: "", quantity: "", surfaceRequested: "" }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const canConfirm = items.every((item) => item.name.trim().length > 0 && Number.isSafeInteger(item.quantity) && Number(item.quantity) > 0);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-in slide-in-from-right-8 duration-300">
      <div className="text-center space-y-1 mb-6">
        <h2 className="text-3xl font-black font-serif text-navy-900">Bauteile erfassen</h2>
        <p className="text-navy-500 font-medium">Diese Teile haben wir aus dem Scan abgeleitet.</p>
      </div>

      <div className="space-y-4">
        {items.map((item, i) => (
          <div key={item.id} className="bg-white border-2 border-neutral-gray-100 rounded-3xl p-5 shadow-sm flex gap-4 items-start focus-within:border-navy-700 transition-colors">
            <div className="flex-1 space-y-4">
              <div className="flex gap-4">
                <div className="w-24 shrink-0">
                  <label className="block text-[11px] font-extrabold text-text-muted uppercase tracking-widest mb-1 pl-1">Menge</label>
                  <input type="number" min={1} value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value === "" ? "" : Number(e.target.value))} className="w-full text-xl font-black text-center bg-bg-app-soft p-3 rounded-xl border-2 border-neutral-gray-100 outline-none focus:border-navy-700 focus:bg-white" />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-extrabold text-text-muted uppercase tracking-widest mb-1 pl-1">Bezeichnung</label>
                  <input type="text" value={item.name} onChange={e => updateItem(i, "name", e.target.value)} className="w-full text-xl font-bold bg-bg-app-soft p-3 rounded-xl border-2 border-neutral-gray-100 outline-none focus:border-navy-700 focus:bg-white" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-text-muted uppercase tracking-widest mb-1 pl-1">Gewünschte Oberfläche (optional)</label>
                <input type="text" value={item.surfaceRequested} onChange={e => updateItem(i, "surfaceRequested", e.target.value)} className="w-full text-base font-bold text-navy-900 bg-bg-app-soft p-3 rounded-xl border-2 border-neutral-gray-100 outline-none focus:border-navy-700 focus:bg-white" />
              </div>
            </div>
            
            <div className="flex flex-col gap-3 shrink-0 pt-6">
              {items.length > 1 && (
                <Button variant="outline" onClick={() => removeItem(i)} className="h-12 w-12 p-0 text-danger-red bg-accent-orange-soft hover:bg-danger-red border-danger-red rounded-xl" title="Teil entfernen">
                  <Trash2 className="w-6 h-6"/>
                </Button>
              )}
            </div>
          </div>
        ))}
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          Teilfotos werden in diesem Erfassungsweg noch nicht gespeichert. Sie können nach dem bestätigten Auftrag über die angebundene Foto-Erfassung ergänzt werden.
        </p>
        
        <Button onClick={addItem} variant="outline" className="w-full h-16 border-2 border-dashed border-text-muted text-navy-500 font-extrabold hover:bg-bg-app-soft hover:border-white/30 hover:text-navy-700 rounded-3xl transition-all">
          <Plus className="mr-2 h-6 w-6" /> Weiteres Teil hinzufügen
        </Button>
      </div>

      <div className="pt-6">
        {!canConfirm && <p role="alert" className="mb-3 text-sm font-semibold text-amber-900">Bezeichnung und ganze Stückzahl müssen ausdrücklich bestätigt werden.</p>}
        <Button disabled={!canConfirm} onClick={() => onConfirm(items)} className="w-full h-16 text-lg font-extrabold rounded-2xl bg-navy-900 text-white hover:bg-navy-700 shadow-xl active:scale-95 transition-all">
          Teile bestätigen <ChevronRight className="ml-2 w-6 h-6" />
        </Button>
      </div>
    </div>
  )
}
