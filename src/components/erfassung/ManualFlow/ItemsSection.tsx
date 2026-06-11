"use client";

import { Plus, Trash2 } from "lucide-react";
import { ItemPhotoUploader } from "../shared/ItemPhotoUploader";

export function ItemsSection({ items, onChange }: { items: any[], onChange: (items: any[]) => void }) {
  const handleAddItem = () => {
    onChange([...items, { id: `temp_${Date.now()}`, name: "", quantity: 1, material: "", surfaceRequested: "", photos: [] }]);
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;
    onChange(newItems);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const handlePhotoUploaded = (index: number, url: string, analysis?: any) => {
    const newItems = [...items];
    newItems[index].photos = [...(newItems[index].photos || []), url];
    
    // If analysis is present and fields are empty, we could auto-fill or suggest
    if (analysis) {
      if (!newItems[index].material && analysis.material) newItems[index].material = analysis.material;
      // We also store it in the item state if we want to show it
    }
    
    onChange(newItems);
  };

  const handlePhotoRemove = (index: number, url: string) => {
    const newItems = [...items];
    newItems[index].photos = newItems[index].photos.filter((p: string) => p !== url);
    onChange(newItems);
  };

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-5 relative group">
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleRemoveItem(index)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Bezeichnung</label>
                  <input
                    type="text"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                    placeholder="z.B. Stoßstange"
                    value={item.name}
                    onChange={(e) => handleUpdateItem(index, "name", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Menge</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                    value={item.quantity}
                    onChange={(e) => handleUpdateItem(index, "quantity", parseInt(e.target.value))}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Material</label>
                  <input
                    type="text"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                    placeholder="z.B. Stahl"
                    value={item.material}
                    onChange={(e) => handleUpdateItem(index, "material", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Oberfläche</label>
                  <input
                    type="text"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                    placeholder="z.B. Verchromen"
                    value={item.surfaceRequested}
                    onChange={(e) => handleUpdateItem(index, "surfaceRequested", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Fotos</label>
              <ItemPhotoUploader
                itemId={item.id}
                photos={item.photos || []}
                onUploadComplete={(url, analysis) => handlePhotoUploaded(index, url, analysis)}
                onRemove={(url) => handlePhotoRemove(index, url)}
              />
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={handleAddItem}
        className="w-full py-3 bg-white border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50 rounded-xl text-blue-600 font-medium flex items-center justify-center gap-2 transition-all"
      >
        <Plus className="w-5 h-5" />
        Weiteres Teil hinzufügen
      </button>
    </div>
  );
}
