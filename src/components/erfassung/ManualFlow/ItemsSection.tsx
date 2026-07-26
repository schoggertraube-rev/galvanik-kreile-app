"use client";

import { Plus, Trash2 } from "lucide-react";
import { ROUTE_TEMPLATES } from "@/lib/orders/routeSnapshot";

type EditableItem = Record<string, unknown>;

const textValue = (value: unknown) => typeof value === "string" ? value : "";
export const quantityInputValue = (value: unknown): number | "" => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const quantity = Number(value);
    if (Number.isFinite(quantity)) return quantity;
  }
  return "";
};

export function ItemsSection({ items, onChange }: { items: EditableItem[], onChange: (items: EditableItem[]) => void }) {
  const handleAddItem = () => {
    onChange([...items, { id: `temp_${Date.now()}`, name: "", quantity: 1, material: "", target: "", routeTemplateId: "" }]);
  };

  const handleUpdateItem = (index: number, field: string, value: unknown) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  if (items.length === 0) {
    return (
       <button
        onClick={handleAddItem}
        className="w-full py-3 bg-[#fcfaf6] border-2 border-dashed border-[#e5dcd0] hover:border-gray-400 hover:bg-white rounded-xl text-gray-500 font-medium flex items-center justify-center gap-2 transition-all"
      >
        <Plus className="w-5 h-5" />
        Teil hinzufügen
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={textValue(item.id) || `item-${index}`} className="bg-[#fcfaf6] border border-[#e5dcd0] rounded-xl p-4 relative group">
          <div className="flex justify-between items-center mb-3">
            <span className="font-bold text-[#1a1c23] text-sm">T-0{(index + 1).toString().padStart(1, '0')}</span>
            <button
              onClick={() => handleRemoveItem(index)}
              className="p-1.5 text-red-400 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Bezeichnung</label>
              <input
                type="text"
                className="w-full bg-white border border-[#e5dcd0] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none transition-colors"
                placeholder="Lampenfassung"
                value={textValue(item.name)}
                onChange={(e) => handleUpdateItem(index, "name", e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Material</label>
                <select
                  className="w-full bg-white border border-[#e5dcd0] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none transition-colors appearance-none"
                  value={textValue(item.material)}
                  onChange={(e) => handleUpdateItem(index, "material", e.target.value)}
                >
                  <option value="">Wählen...</option>
                  <option value="Messing">Messing</option>
                  <option value="Stahl">Stahl</option>
                  <option value="Aluminium">Aluminium</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Ziel</label>
                <select
                  className="w-full bg-white border border-[#e5dcd0] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none transition-colors appearance-none"
                  value={textValue(item.target)}
                  onChange={(e) => handleUpdateItem(index, "target", e.target.value)}
                >
                  <option value="">Wählen...</option>
                  <option value="Vergoldet poliert">Vergoldet poliert</option>
                  <option value="Verchromt glänzend">Verchromt glänzend</option>
                  <option value="Versilbert matt">Versilbert matt</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Menge</label>
                <input
                  type="number"
                  min="1"
                  className="w-full bg-white border border-[#e5dcd0] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none transition-colors"
                  value={quantityInputValue(item.quantity)}
                  onChange={(e) => handleUpdateItem(
                    index,
                    "quantity",
                    e.target.value === "" ? "" : Number(e.target.value),
                  )}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Bestätigte Positionsroute</label>
              <select
                required
                className="w-full bg-white border border-[#e5dcd0] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none"
                value={textValue(item.routeTemplateId)}
                onChange={(event) => handleUpdateItem(index, "routeTemplateId", event.target.value)}
              >
                <option value="">Route auswählen …</option>
                {Object.entries(ROUTE_TEMPLATES).map(([templateId, template]) => (
                  <option key={templateId} value={templateId}>{template.label}: {template.stations.join(" → ")}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-gray-500">Die Auswahl wird als unveränderlicher v1-Routen-Snapshot an jeder Position gespeichert.</p>
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={handleAddItem}
        className="w-full py-3 bg-[#fcfaf6] border border-dashed border-[#e5dcd0] hover:border-gray-400 hover:bg-white rounded-xl text-gray-500 font-medium flex items-center justify-center gap-2 transition-all text-sm"
      >
        <Plus className="w-4 h-4" />
        Weiteres Teil
      </button>
    </div>
  );
}
