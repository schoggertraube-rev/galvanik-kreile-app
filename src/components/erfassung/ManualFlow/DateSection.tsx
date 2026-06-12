"use client";

import { Truck, PackageSearch, PackageOpen } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DateSection({ dateInfo, onChange, customer }: { dateInfo: any, onChange: (info: any) => void, customer?: any }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChange = (field: string, value: any) => {
    onChange({ ...dateInfo, [field]: value });
  };

  const hasFullAddress = !!(
    (customer?.street || customer?.address) && 
    (customer?.zipCode || customer?.postalCode || customer?.postal_code || (customer?.address && /\b\d{4,5}\b/.test(customer.address))) && 
    (customer?.city || (customer?.address && customer?.address.length > 10))
  );

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
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Uhrzeitfenster</label>
          <select
            className="w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none transition-colors appearance-none"
            value={dateInfo.timeWindow || "ganztaegig"}
            onChange={(e) => handleChange("timeWindow", e.target.value)}
          >
            <option value="ganztaegig">Ganztägig</option>
            <option value="vormittags">Vormittags (08:00 - 12:00)</option>
            <option value="nachmittags">Nachmittags (12:00 - 16:00)</option>
            <option value="spaet">Spätnachmittag (16:00 - 18:00)</option>
          </select>
        </div>
      </div>
      
      <div className="flex items-center justify-between bg-white border border-[#e5dcd0] rounded-lg p-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">Kalender-Anbindung</p>
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mt-0.5">Kalenderverknüpfung vorbereitet</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" checked={dateInfo.calendarSync || false} onChange={(e) => handleChange("calendarSync", e.target.checked)} />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1a1c23]"></div>
        </label>
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
            onClick={() => hasFullAddress && handleChange("shipping", "versand")}
            disabled={!hasFullAddress}
             className={`flex-1 py-2.5 px-3 rounded-full flex items-center justify-center gap-2 text-sm transition-all ${dateInfo.shipping === 'versand' ? 'bg-[#1a1c23] text-white font-medium border-transparent shadow-md' : 'bg-[#fcfaf6] border border-[#e5dcd0] text-gray-700 hover:bg-white'} ${!hasFullAddress ? 'opacity-50 cursor-not-allowed' : ''}`}
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
        {!hasFullAddress && (
          <p className="text-xs text-amber-600 mt-2">
            Versand erst möglich, wenn Straße, PLZ und Ort beim Kunden hinterlegt sind.
          </p>
        )}
      </div>
    </div>
  );
}
