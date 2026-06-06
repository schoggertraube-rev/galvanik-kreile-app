import { FileText, Truck, Phone, AtSign, Globe, Euro, Clock, Package, Anchor } from "lucide-react";
import Link from "next/link";
import { AppBackButton } from "@/components/ui/AppBackButton";

export default async function LieferantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Mock data for Supplier
  const isChemie = id.toLowerCase().includes("chemie") || id.toLowerCase().includes("riedel");
  
  const lieferant = {
    id: id,
    name: id === "riedel" ? "Riedel Chemie GmbH" : "Musterlieferant AG",
    typ: isChemie ? "Chemie & Rohstoffe" : "Allgemein",
    kontakt: {
      telefon: "+49 123 456789",
      email: "bestellungen@lieferant.de",
      website: "www.lieferant.de"
    },
    verbrauchLfdJahr: 14500,
    bestellungenTotal: 24,
  };

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-8 font-sans">
      <div className="mb-6">
        <AppBackButton fallbackHref="/buchhaltung" label="Zurück" />
      </div>

      {/* Header */}
      <div className="mb-8 bg-white border-2 border-neutral-gray-300 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-navy-100 rounded-xl flex items-center justify-center text-navy-900 border border-navy-200">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black font-serif text-navy-900">{lieferant.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2.5 py-1 bg-navy-50 text-navy-700 font-bold rounded text-[10px] uppercase tracking-wider border border-navy-200">
                {lieferant.typ}
              </span>
              <span className="text-xs text-text-muted font-bold tracking-wide">ID: {lieferant.id}</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 border-t border-neutral-gray-200 pt-6">
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-text-muted shrink-0" />
            <div>
              <span className="block text-[10px] font-bold text-text-muted uppercase">Telefon</span>
              <span className="text-sm font-semibold text-navy-900">{lieferant.kontakt.telefon}</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <AtSign className="w-5 h-5 text-text-muted shrink-0" />
            <div>
              <span className="block text-[10px] font-bold text-text-muted uppercase">E-Mail</span>
              <span className="text-sm font-semibold text-navy-900">{lieferant.kontakt.email}</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 text-text-muted shrink-0" />
            <div>
              <span className="block text-[10px] font-bold text-text-muted uppercase">Website</span>
              <span className="text-sm font-semibold text-navy-900">{lieferant.kontakt.website}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Col */}
        <div className="space-y-8">
          
          {/* Belege & Bestellhistorie */}
          <div className="bg-white border-2 border-neutral-gray-300 rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold font-serif text-navy-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-text-muted" />
                Letzte Belege
              </h3>
              <Link href={`/buchhaltung/belege?lieferant=${lieferant.name}`} className="text-xs font-bold text-navy-600 hover:underline">
                Alle ansehen
              </Link>
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Link key={i} href={`/buchhaltung/belege/BE-${2026040 + i}`} className="block group">
                  <div className="p-4 bg-bg-app-soft border border-neutral-gray-200 rounded-2xl flex items-center justify-between group-hover:border-navy-500 transition-colors">
                    <div>
                      <span className="text-[10px] text-text-muted font-bold block mb-0.5">BE-{2026040 + i} · 1{i}.06.2026</span>
                      <span className="text-sm font-black text-navy-900">Rechnung Materiallieferung</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-navy-900 block">{1200 + i * 45},00 €</span>
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">Bezahlt</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

        </div>

        {/* Right Col */}
        <div className="space-y-8">

          {/* Verknüpfte Bereiche */}
          <div className="bg-white border-2 border-navy-200 rounded-3xl p-6 md:p-8 shadow-sm bg-gradient-to-br from-white to-navy-50/30">
            <h3 className="text-lg font-bold font-serif text-navy-900 mb-6 flex items-center gap-2">
              <Anchor className="w-5 h-5 text-navy-600" />
              Verknüpfte Bereiche
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link href="/buchhaltung/bwa" className="p-4 bg-white border border-neutral-gray-200 rounded-2xl hover:border-navy-400 hover:shadow-md transition-all group flex flex-col items-center justify-center text-center gap-2 h-32">
                <Euro className="w-8 h-8 text-navy-300 group-hover:text-navy-600 transition-colors" />
                <div>
                  <span className="block text-sm font-black text-navy-900">BWA</span>
                  <span className="block text-[10px] text-text-muted">Kostenanalyse</span>
                </div>
              </Link>
              
              <Link href="/items" className="p-4 bg-white border border-neutral-gray-200 rounded-2xl hover:border-navy-400 hover:shadow-md transition-all group flex flex-col items-center justify-center text-center gap-2 h-32">
                <Package className="w-8 h-8 text-navy-300 group-hover:text-navy-600 transition-colors" />
                <div>
                  <span className="block text-sm font-black text-navy-900">Lagerbestand</span>
                  <span className="block text-[10px] text-text-muted">Gelieferte Artikel</span>
                </div>
              </Link>

              {isChemie && (
                <Link href="/baeder" className="p-4 bg-white border border-neutral-gray-200 rounded-2xl hover:border-navy-400 hover:shadow-md transition-all group flex flex-col items-center justify-center text-center gap-2 h-32 sm:col-span-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-1">
                    <span className="font-bold">B</span>
                  </div>
                  <div>
                    <span className="block text-sm font-black text-navy-900">Bäder</span>
                    <span className="block text-[10px] text-text-muted">Verbrauch der Chemie</span>
                  </div>
                </Link>
              )}
            </div>
          </div>

          {/* Preishistorie */}
          <div className="bg-white border-2 border-neutral-gray-300 rounded-3xl p-6 md:p-8 shadow-sm">
            <h3 className="text-lg font-bold font-serif text-navy-900 flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5 text-text-muted" />
              Verbrauch & Historie
            </h3>
            <div className="flex justify-between items-center p-4 bg-bg-app-soft rounded-2xl mb-4 border border-neutral-gray-100">
              <span className="text-sm font-bold text-text-muted">Verbrauch lfd. Jahr</span>
              <span className="text-lg font-black text-navy-900">{lieferant.verbrauchLfdJahr.toLocaleString("de-DE")} €</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Detaillierte Preishistorien für einzelne eingekaufte Artikel finden Sie im Modul <Link href="/items" className="text-navy-600 hover:underline font-bold">Lager & Chemie</Link>.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
