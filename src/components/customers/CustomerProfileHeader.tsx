import { Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Customer } from "@/lib/repositories/customersRepository";
import { useAppShortcut } from "@/components/ui/AppShortcutContext";

export function CustomerProfileHeader({ customer }: { customer: Customer }) {
  const { openShortcut } = useAppShortcut();
  return (
    <div className="bg-white border-2 border-neutral-gray-100 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black font-serif text-navy-900">{customer.name}</h1>
          <p className="text-xl font-bold text-navy-500 mt-1">
            {customer.type === "institution" || customer.type === "Institution" 
              ? "Institution" 
              : customer.type === "business" || customer.type === "Geschäftskunde" 
                ? "Gewerblich" 
                : "Privatkunde"}
          </p>
        </div>
        <span className="px-3 py-1.5 bg-green-100 text-green-800 font-bold rounded-lg text-sm">Aktiv</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center text-text-muted bg-bg-app-soft p-3 rounded-xl border border-neutral-gray-100">
          <Mail className="w-5 h-5 mr-3 text-text-muted" />
          <span className="font-bold text-sm truncate">{customer.email || "Keine E-Mail"}</span>
        </div>
        <div className="flex items-center text-text-muted bg-bg-app-soft p-3 rounded-xl border border-neutral-gray-100">
          <Phone className="w-5 h-5 mr-3 text-text-muted" />
          <span className="font-bold text-sm truncate">{customer.phone || "Keine Nummer"}</span>
        </div>
        <div className="flex items-center text-text-muted bg-bg-app-soft p-3 rounded-xl border border-neutral-gray-100">
          <MapPin className="w-5 h-5 mr-3 text-text-muted" />
          <span className="font-bold text-sm truncate">{customer.address || "Keine Adresse"}</span>
        </div>
      </div>

      <div className="flex gap-4 pt-2">
        <Button 
          onClick={() => openShortcut("new_order")}
          className="h-14 px-6 rounded-2xl bg-navy-900 text-white font-bold text-lg hover:bg-navy-900 shadow-xl active:scale-95 transition-all"
        >
          Neuer Auftrag
        </Button>
        <Button variant="outline" className="h-14 px-6 rounded-2xl border-2 border-neutral-gray-100 text-navy-900 font-bold text-lg hover:bg-bg-app-soft active:scale-95 transition-all">
          Anrufen
        </Button>
      </div>
    </div>
  );
}
