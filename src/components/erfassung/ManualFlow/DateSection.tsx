"use client";

import { Truck, PackageSearch, PackageOpen } from "lucide-react";
import { useState } from "react";
import { DetailOverlay } from "@/components/ui/DetailOverlay";

type ManualCustomer = Record<string, unknown> & {
  id?: string;
  isNew?: boolean;
  name?: string;
  companyName?: string | null;
  company?: string | null;
  customerNumber?: string | null;
  city?: string | null;
  ordersCount?: number;
  street?: string | null;
  address?: string | null;
  zipCode?: string | null;
  postalCode?: string | null;
  postal_code?: string | null;
};

type ManualDateInfo = Record<string, unknown> & {
  priority?: string;
  dueDate?: string;
  timeWindow?: string;
  calendarSync?: boolean;
  shipping?: string;
};

type DateField = "dueDate" | "timeWindow" | "calendarSync" | "shipping";

export function DateSection({ dateInfo, onChange, customer }: { dateInfo: ManualDateInfo, onChange: (info: ManualDateInfo) => void, customer?: ManualCustomer | null }) {
  const handleChange = <Field extends DateField>(field: Field, value: ManualDateInfo[Field]) => {
    onChange({ ...dateInfo, [field]: value });
  };

  const [addressModalOpen, setAddressModalOpen] = useState(false);

  const hasFullAddress = !!(
    (customer?.street || customer?.address) && 
    (customer?.zipCode || customer?.postalCode || customer?.postal_code || (customer?.address && /\b\d{4,5}\b/.test(customer.address))) && 
    (customer?.city || (customer?.address && customer?.address.length > 10))
  );

  const handleShippingClick = () => {
    if (hasFullAddress) {
      handleChange("shipping", "versand");
    } else {
      setAddressModalOpen(true);
    }
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
            onClick={handleShippingClick}
             className={`flex-1 py-2.5 px-3 rounded-full flex items-center justify-center gap-2 text-sm transition-all ${dateInfo.shipping === 'versand' ? 'bg-[#1a1c23] text-white font-medium border-transparent shadow-md' : 'bg-[#fcfaf6] border border-[#e5dcd0] text-gray-700 hover:bg-white'} ${!hasFullAddress && dateInfo.shipping === 'versand' ? 'opacity-50' : ''}`}
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

      <DetailOverlay
        open={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        title="Versandadresse unvollständig"
        subtitle={`Kunde: ${customer?.name || customer?.company || 'Unbekannt'}`}
      >
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
          <p className="text-sm text-amber-800">
            Die Adresse dieses Kunden ist nicht vollständig erfasst (Straße, PLZ, Ort fehlen).
            Bitte ergänzen Sie die Stammdaten des Kunden oder wählen Sie Abholung.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button 
            onClick={() => {
              setAddressModalOpen(false);
              handleChange("shipping", "abholung");
            }}
            className="w-full py-3 bg-white border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            <PackageOpen className="w-4 h-4" /> Stattdessen Abholung wählen
          </button>
        </div>
      </DetailOverlay>
    </div>
  );
}
