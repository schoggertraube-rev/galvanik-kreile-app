import { PriceAgreement } from "@/lib/repositories/priceAgreementsRepository";
import { FileBadge } from "lucide-react";

export function PriceAgreementPanel({ agreements }: { agreements: PriceAgreement[] }) {
  if (!agreements || agreements.length === 0) return null;

  return (
    <div className="bg-gold-100 border-2 border-gold-600 rounded-3xl p-6 md:p-8 shadow-sm">
      <h3 className="text-sm font-extrabold text-gold-600 uppercase tracking-widest pl-1 mb-4 flex items-center">
        <FileBadge className="w-5 h-5 mr-2" /> Aktive Preisabsprachen
      </h3>
      <div className="space-y-4">
        {agreements.map(a => (
          <div key={a.id} className="bg-white p-5 rounded-2xl border-2 border-gold-600 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-navy-900 text-lg">{a.title}</h4>
                <p className="text-sm text-navy-500 font-bold mt-0.5">{a.surfaceType}</p>
              </div>
              <span className="text-2xl font-black text-gold-600 bg-gold-100 px-3 py-1 rounded-xl">{a.price} €</span>
            </div>
            {a.note && <p className="text-sm font-medium text-text-muted mt-4 bg-gold-100 p-3 rounded-xl border border-gold-600">{a.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
