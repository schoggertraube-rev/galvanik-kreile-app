"use client";
import { useState } from "react";
import { Plus, Trash2, Camera as CamIcon, ChevronRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SuggestedItemsPanel({ ocrData, onConfirm }: { ocrData: Record<string, string>, onConfirm: (items: Record<string, unknown>[]) => void }) {
  const [items, setItems] = useState(() => [
    { id: Date.now().toString(), name: ocrData.itemName || "Bauteil", quantity: parseInt(ocrData.quantity) || 1, surfaceRequested: ocrData.surfaceRequested || "", photo: "" }
  ]);

  const updateItem = (index: number, key: string, val: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [key]: val };
    setItems(newItems);
  }

  const addItem = () => setItems([...items, { id: Date.now().toString() + Math.random(), name: "", quantity: 1, surfaceRequested: "", photo: "" }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const handlePhotoCapture = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      // Speichern des Bildes in den Item-Daten (im MVP reicht das Base64 im State)
      updateItem(index, "photo", event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-in slide-in-from-right-8 duration-300">
      <div className="text-center space-y-1 mb-6">
        <h2 className="text-3xl font-black font-serif text-slate-900">Bauteile erfassen</h2>
        <p className="text-slate-500 font-medium">Diese Teile haben wir aus dem Scan abgeleitet.</p>
      </div>

      <div className="space-y-4">
        {items.map((item, i) => (
          <div key={item.id} className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-sm flex gap-4 items-start focus-within:border-blue-400 transition-colors">
            <div className="flex-1 space-y-4">
              <div className="flex gap-4">
                <div className="w-24 shrink-0">
                  <label className="block text-[11px] font-extrabold text-kreile-muted uppercase tracking-widest mb-1 pl-1">Menge</label>
                  <input type="number" value={item.quantity} onChange={e => updateItem(i, "quantity", parseInt(e.target.value))} className="w-full text-xl font-black text-center bg-slate-50 p-3 rounded-xl border-2 border-slate-200 outline-none focus:border-blue-500 focus:bg-white" />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-extrabold text-kreile-muted uppercase tracking-widest mb-1 pl-1">Bezeichnung</label>
                  <input type="text" value={item.name} onChange={e => updateItem(i, "name", e.target.value)} className="w-full text-xl font-bold bg-slate-50 p-3 rounded-xl border-2 border-slate-200 outline-none focus:border-blue-500 focus:bg-white" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-kreile-muted uppercase tracking-widest mb-1 pl-1">Gewünschte Oberfläche (optional)</label>
                <input type="text" value={item.surfaceRequested} onChange={e => updateItem(i, "surfaceRequested", e.target.value)} className="w-full text-base font-bold text-kreile-navy bg-slate-50 p-3 rounded-xl border-2 border-slate-200 outline-none focus:border-blue-500 focus:bg-white" />
              </div>
            </div>
            
            <div className="flex flex-col gap-3 shrink-0 pt-6">
              <label className="cursor-pointer" title="Vorher-Foto ergänzen">
                <div className={`h-12 w-12 flex items-center justify-center rounded-xl border-2 transition-all ${item.photo ? 'bg-green-50 border-green-300 text-green-600' : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-600'}`}>
                  {item.photo ? <CheckCircle className="w-6 h-6"/> : <CamIcon className="w-6 h-6"/>}
                </div>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoCapture(i, e)} />
              </label>
              {items.length > 1 && (
                <Button variant="outline" onClick={() => removeItem(i)} className="h-12 w-12 p-0 text-red-600 bg-red-50 hover:bg-red-100 border-red-200 rounded-xl" title="Teil entfernen">
                  <Trash2 className="w-6 h-6"/>
                </Button>
              )}
            </div>
          </div>
        ))}
        
        <Button onClick={addItem} variant="outline" className="w-full h-16 border-2 border-dashed border-slate-300 text-slate-500 font-extrabold hover:bg-slate-50 hover:border-white/30 hover:text-blue-700 rounded-3xl transition-all">
          <Plus className="mr-2 h-6 w-6" /> Weiteres Teil hinzufügen
        </Button>
      </div>

      <div className="pt-6">
        <Button onClick={() => onConfirm(items)} className="w-full h-16 text-lg font-extrabold rounded-2xl bg-kreile-navy text-white hover:bg-kreile-navy-soft shadow-xl active:scale-95 transition-all">
          Teile bestätigen <ChevronRight className="ml-2 w-6 h-6" />
        </Button>
      </div>
    </div>
  )
}
