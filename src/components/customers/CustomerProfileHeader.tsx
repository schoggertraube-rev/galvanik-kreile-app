import { Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Customer } from "@/lib/repositories/customersRepository";

export function CustomerProfileHeader({ customer }: { customer: Customer }) {
  return (
    <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black font-serif text-slate-900">{customer.name}</h1>
          <p className="text-xl font-bold text-slate-500 mt-1">
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
        <div className="flex items-center text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
          <Mail className="w-5 h-5 mr-3 text-slate-400" />
          <span className="font-bold text-sm truncate">{customer.email || "Keine E-Mail"}</span>
        </div>
        <div className="flex items-center text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
          <Phone className="w-5 h-5 mr-3 text-slate-400" />
          <span className="font-bold text-sm truncate">{customer.phone || "Keine Nummer"}</span>
        </div>
        <div className="flex items-center text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
          <MapPin className="w-5 h-5 mr-3 text-slate-400" />
          <span className="font-bold text-sm truncate">{customer.address || "Keine Adresse"}</span>
        </div>
      </div>

      <div className="flex gap-4 pt-2">
        <Button className="h-14 px-6 rounded-2xl bg-slate-900 text-white font-bold text-lg hover:bg-slate-800 shadow-xl active:scale-95 transition-all">
          Neuer Auftrag
        </Button>
        <Button variant="outline" className="h-14 px-6 rounded-2xl border-2 border-slate-200 text-slate-700 font-bold text-lg hover:bg-slate-50 active:scale-95 transition-all">
          Anrufen
        </Button>
      </div>
    </div>
  );
}
