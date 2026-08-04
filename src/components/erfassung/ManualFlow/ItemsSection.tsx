"use client";

import { Plus, Trash2 } from "lucide-react";

type ManualItem = Record<string, unknown> & {
  id?: string | number;
  name?: string;
  quantity?: string | number;
  material?: string;
  target?: string;
  surfaceRequested?: string;
};

type EditableItemField = "name" | "material" | "target" | "quantity";

export function ItemsSection({ items, onChange }: { items: ManualItem[], onChange: (items: ManualItem[]) => void }) {
  const handleAddItem = () => {
    onChange([...items, { id: `temp_${Date.now()}`, name: "", quantity: 1, material: "", target: "" }]);
  };

  const handleUpdateItem = <Field extends EditableItemField>(index: number, field: Field, value: ManualItem[Field]) => {
    const newItems = [...items];
    newItems[index][field] = value;
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
        <div key={item.id} className="bg-[#fcfaf6] border border-[#e5dcd0] rounded-xl p-4 relative group">
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
                value={item.name}
                onChange={(e) => handleUpdateItem(index, "name", e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Material</label>
                <select
                  className="w-full bg-white border border-[#e5dcd0] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none transition-colors appearance-none"
                  value={item.material}
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
                  value={item.target}
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
                  value={item.quantity}
                  onChange={(e) => handleUpdateItem(index, "quantity", parseInt(e.target.value))}
                />
              </div>
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
