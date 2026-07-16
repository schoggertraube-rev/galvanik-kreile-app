"use client";

import { useState } from "react";
import { Box, Save, Tag, X } from "lucide-react";
import { createItemDb, updateItemDb, type ItemResponse } from "@/app/actions/items.actions";
import { PriceLinesEditor } from "./PriceLinesEditor";

interface ItemDrawerProps {
  orderId: string;
  itemId: string | "new" | null;
  existingItems: ItemResponse[];
  onClose: () => void;
  onSaved: () => void;
}

const WORKFLOW_TEMPLATES = [
  { label: "Standard Zink (Trommel)", sequence: ["wareneingang", "entfettung", "zink_trommel", "passivierung", "trocknung", "warenausgang"] },
  { label: "Gestell Nickel", sequence: ["wareneingang", "schleiferei", "entfettung", "nickel_gestell", "trocknung", "warenausgang"] },
  { label: "Nur Entlacken", sequence: ["wareneingang", "entlackung", "warenausgang"] },
];

export function ItemDrawer({ orderId, itemId, existingItems, onClose, onSaved }: ItemDrawerProps) {
  const isNew = itemId === "new";
  const existingItem = isNew ? null : existingItems.find((item) => item.id === itemId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState(() => ({
    name: existingItem?.name || "",
    quantity: existingItem?.quantity || 1,
    material: existingItem?.material || "",
    surfaceRequested: existingItem?.surfaceRequested || "",
    stationSequence: existingItem?.stationSequence || [] as string[],
    internalNotes: existingItem?.internalNotes || "",
  }));

  async function handleSave() {
    setLoading(true);
    setError(null);
    const payload = {
      name: formData.name,
      quantity: formData.quantity,
      material: formData.material,
      surfaceRequested: formData.surfaceRequested,
      stationSequence: formData.stationSequence,
      internalNotes: formData.internalNotes,
    };
    try {
      const result = isNew
        ? await createItemDb({ ...payload, orderId, currentStationId: "wareneingang" })
        : await updateItemDb(itemId as string, payload);
      if (!result.ok) throw new Error(result.message);
      onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Teil konnte nicht gespeichert werden.");
    } finally {
      setLoading(false);
    }
  }

  if (!itemId) return null;

  return (
    <div className="fixed inset-0 z-1000 flex items-start justify-center overflow-y-auto bg-navy-900/40 px-4 py-12 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[560px] rounded-2xl border border-neutral-gray-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-neutral-gray-200 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Box className="h-5 w-5" />{isNew ? "Neues Teil anlegen" : "Teil bearbeiten"}</h2>
          <button type="button" onClick={onClose} aria-label="Schließen" className="rounded-full p-2 hover:bg-neutral-gray-100"><X className="h-5 w-5" /></button>
        </header>

        <div className="space-y-6 p-6">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider">Bezeichnung</label>
            <input value={formData.name} maxLength={200} onChange={(event) => setFormData({ ...formData, name: event.target.value })} className="w-full rounded-lg border p-3 text-sm" placeholder="Zum Beispiel Kotflügel vorne links" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider">Menge</label>
              <input type="number" min={1} max={1_000_000} value={formData.quantity} onChange={(event) => setFormData({ ...formData, quantity: Number(event.target.value) || 1 })} className="w-full rounded-lg border p-3 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider">Material</label>
              <input value={formData.material} maxLength={100} onChange={(event) => setFormData({ ...formData, material: event.target.value })} className="w-full rounded-lg border p-3 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider">Zielfinish</label>
            <input value={formData.surfaceRequested} maxLength={100} onChange={(event) => setFormData({ ...formData, surfaceRequested: event.target.value })} className="w-full rounded-lg border p-3 text-sm" />
          </div>

          <div className="border-t pt-5">
            <label className="mb-3 block text-xs font-bold uppercase tracking-wider">Stationen-Abfolge</label>
            <div className="mb-3 flex flex-wrap gap-2">
              {WORKFLOW_TEMPLATES.map((template) => (
                <button key={template.label} type="button" onClick={() => setFormData({ ...formData, stationSequence: template.sequence })} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-neutral-gray-50">{template.label}</button>
              ))}
            </div>
            <div className="flex min-h-14 flex-wrap gap-2 rounded-lg border bg-neutral-gray-50 p-3 text-sm">
              {formData.stationSequence.length === 0
                ? <span className="text-text-muted">Keine Stationen definiert.</span>
                : formData.stationSequence.map((station, index) => <span key={`${station}-${index}`} className="rounded border bg-white px-2 py-1">{index + 1}. {station}</span>)}
            </div>
          </div>

          <div className="border-t pt-5">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider">Interne Notizen</label>
            <textarea value={formData.internalNotes} maxLength={2_000} onChange={(event) => setFormData({ ...formData, internalNotes: event.target.value })} className="min-h-24 w-full rounded-lg border p-3 text-sm" />
          </div>

          {!isNew && <div className="border-t pt-5"><label className="mb-3 flex items-center gap-1 text-xs font-bold uppercase tracking-wider"><Tag className="h-3 w-3" /> Preispositionen</label><PriceLinesEditor orderId={orderId} itemId={itemId} /></div>}
        </div>

        <footer className="space-y-3 border-t border-neutral-gray-200 p-6">
          {!isNew && <p className="text-xs text-text-muted">Direktes Löschen ist gesperrt, bis ein auditierter Stornoablauf vorhanden ist.</p>}
          {error && <p role="alert" className="text-sm font-medium text-error-red">{error}</p>}
          <button type="button" onClick={handleSave} disabled={loading || formData.name.trim().length === 0} className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3 font-bold text-white disabled:opacity-50">
            <Save className="h-5 w-5" />{loading ? "Speichert …" : isNew ? "Anlegen" : "Speichern"}
          </button>
        </footer>
      </div>
    </div>
  );
}
