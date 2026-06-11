"use client";

import { Truck, PackageSearch, PackageOpen } from "lucide-react";

export function DateSection({ dateInfo, onChange }: { dateInfo: any, onChange: (info: any) => void }) {
  const handleChange = (field: string, value: any) => {
    onChange({ ...dateInfo, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Zugesagter Liefertermin</label>
          <input
            type="date"
            className="w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none transition-colors"
            value={dateInfo.dueDate || ""}
            onChange={(e) => handleChange("dueDate", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Priorität</label>
          <select
            className="w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none transition-colors appearance-none"
            value={dateInfo.priority || "normal"}
            onChange={(e) => handleChange("priority", e.target.value)}
          >
            <option value="normal">Normal</option>
            <option value="express">Express</option>
          </select>
        </div>
      </div>
      
      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Rücklieferung</label>
        <div className="flex gap-2">
          <button 
            onClick={() => handleChange("shipping", "abholung")}
            className={`flex-1 py-2.5 px-3 rounded-full flex items-center justify-center gap-2 text-sm transition-all ${dateInfo.shipping === 'abholung' ? 'bg-[#1a1c23] text-white font-medium border-transparent shadow-md' : 'bg-[#fcfaf6] border border-[#e5dcd0] text-gray-700 hover:bg-white'}`}
          >
            <PackageOpen className="w-4 h-4" /> Abholung
          </button>
          <button 
            onClick={() => handleChange("shipping", "versand")}
             className={`flex-1 py-2.5 px-3 rounded-full flex items-center justify-center gap-2 text-sm transition-all ${dateInfo.shipping === 'versand' ? 'bg-[#1a1c23] text-white font-medium border-transparent shadow-md' : 'bg-[#fcfaf6] border border-[#e5dcd0] text-gray-700 hover:bg-white'}`}
          >
            <PackageSearch className="w-4 h-4" /> Versand
          </button>
          <button 
            onClick={() => handleChange("shipping", "spedition")}
             className={`flex-1 py-2.5 px-3 rounded-full flex items-center justify-center gap-2 text-sm transition-all ${dateInfo.shipping === 'spedition' ? 'bg-[#1a1c23] text-white font-medium border-transparent shadow-md' : 'bg-[#fcfaf6] border border-[#e5dcd0] text-gray-700 hover:bg-white'}`}
          >
            <Truck className="w-4 h-4" /> Spedition
          </button>
        </div>
      </div>
    </div>
  );
}
