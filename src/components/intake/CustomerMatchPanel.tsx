"use client";
import { useState, useEffect } from "react";
import { UserPlus, UserCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { customersRepository, Customer } from "@/lib/repositories/customersRepository";

export function CustomerMatchPanel({ ocrData, onConfirm }: { ocrData: Record<string, string>, onConfirm: (custId: string | null, newName?: string) => void }) {
  const [matches, setMatches] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Simuliere Ladezeit für das ML-Matching-Gefühl
      await new Promise(r => setTimeout(r, 600));
      const res = await customersRepository.findSimilar(ocrData.customerName || "");
      setMatches(res);
      setLoading(false);
    }
    load();
  }, [ocrData.customerName]);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-in slide-in-from-right-8 duration-300">
      <div className="text-center space-y-1 mb-6">
        <h2 className="text-3xl font-black font-serif text-slate-900">Kunde zuordnen</h2>
        <p className="text-slate-500 font-medium">Wir haben nach &quot;{ocrData.customerName}&quot; in der Kartei gesucht.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.length > 0 ? (
            <div className="space-y-3">
              <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider pl-1">Gefundene Treffer</h3>
              {matches.map(m => (
                <button 
                  key={m.id}
                  onClick={() => onConfirm(m.id)}
                  className="w-full text-left bg-white border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 hover:shadow-md p-4 rounded-2xl flex items-center justify-between transition-all active:scale-98"
                >
                  <div>
                    <h4 className="font-extrabold text-lg text-slate-900">{m.name}</h4>
                    <p className="text-sm text-slate-500 font-medium">{m.customerNumber} · {m.city || "Kein Ort"}</p>
                  </div>
                  <UserCheck className="h-6 w-6 text-blue-600" />
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-slate-50 border-2 border-slate-200 border-dashed rounded-3xl p-8 text-center">
              <Search className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="font-extrabold text-slate-700 text-xl">Kein Bestandskunde gefunden</h3>
              <p className="text-slate-500 mt-1 font-medium">Soll &quot;{ocrData.customerName}&quot; neu angelegt werden?</p>
            </div>
          )}

          <div className="pt-6 border-t border-slate-200 mt-6">
            <Button 
              onClick={() => onConfirm(null, ocrData.customerName)}
              variant="outline"
              className="w-full h-16 text-lg font-extrabold rounded-2xl border-2 border-slate-300 hover:bg-slate-100 text-slate-700 active:scale-95 transition-all"
            >
              <UserPlus className="mr-3 h-6 w-6" />
              Neu anlegen: &quot;{ocrData.customerName}&quot;
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
