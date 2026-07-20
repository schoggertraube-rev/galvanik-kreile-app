import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";
import { getRechnungAction } from "@/app/buchhaltung/actions";
import Link from "next/link";
import { ChevronRight, FileText, AlertTriangle, Euro, Anchor, Briefcase, User } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { OrderModalTrigger } from "@/components/orders/OrderModalTrigger";

export default async function RechnungDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rechnung = await getRechnungAction(id);

  const mapStatusToColor = (s: string) => {
    if (s === "offen" || s === "teilbezahlt") return "bg-blue-50 text-blue-600 border-blue-200";
    if (s === "ueberfaellig" || s === "Ǭberfllig") return "bg-amber-50 text-amber-600 border-amber-200";
    if (s === "gemahnt" || s === "mahnung") return "bg-rose-50 text-rose-600 border-rose-200";
    if (s === "bezahlt") return "bg-emerald-50 text-emerald-600 border-emerald-200";
    return "bg-neutral-100 text-neutral-600 border-neutral-200";
  };

  const isWarning = ["ueberfaellig", "gemahnt"].includes(rechnung.status) || (new Date(rechnung.faelligAm || "") < new Date() && ["offen", "teilbezahlt"].includes(rechnung.status));

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8 min-h-screen">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Buchhaltung',href:'/buchhaltung'}, {label:'Rechnungen',href:'/buchhaltung/rechnungen'}, {label:'Detail'}]} />
        <BackButton label="Rechnungen" href="/buchhaltung/rechnungen" />
      </div>
      
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/betrieb" className="hover:text-navy-900 transition-colors">Betrieb</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung/rechnungen" className="hover:text-navy-900 transition-colors">Rechnungen</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">{rechnung.nummer}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <FileText className="w-7 h-7 text-navy-900" />
            <h1 className="text-3xl font-extrabold text-[#1e1b18] tracking-tight">{rechnung.nummer}</h1>
            <span className={`px-2.5 py-1 rounded text-[10px] font-extrabold tracking-wide uppercase border ${mapStatusToColor(rechnung.status)}`}>
              {rechnung.status}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-500 mt-2">
            <User className="w-4 h-4" />
            <span>Kunde:</span>
            <Link href={`/customers/${rechnung.kundeId}`} className="text-navy-900 font-bold hover:underline hover:text-navy-600 transition-colors">
              {rechnung.kundeName || rechnung.kundeId}
            </Link>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-500 mt-1">
            <Briefcase className="w-4 h-4" />
            <span>Auftrag:</span>
            {rechnung.orderId ? (
              <OrderModalTrigger orderId={rechnung.orderId} className="text-navy-900 font-bold hover:underline hover:text-navy-600 transition-colors">
                Auftrag anzeigen
              </OrderModalTrigger>
            ) : (
              <span className="text-neutral-500">Kein Auftrag verknüpft</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Action buttons could go here */}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-neutral-100">
          <h3 className="text-sm font-bold text-[#1e1b18] mb-4">Positionen</h3>
          <div className="border border-neutral-100 rounded-2xl overflow-hidden bg-neutral-50/50">
            <div className="grid grid-cols-[1fr_80px_100px_100px] gap-4 p-4 border-b border-neutral-100 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              <div>Beschreibung</div>
              <div className="text-right">Menge</div>
              <div className="text-right">Einzelpreis</div>
              <div className="text-right">Gesamt</div>
            </div>
            {rechnung.positionen?.map((pos) => (
              <div key={pos.id} className="grid grid-cols-[1fr_80px_100px_100px] gap-4 p-4 items-center border-b border-neutral-100 last:border-0">
                <div className="text-sm font-semibold text-[#1e1b18]">{pos.beschreibung}</div>
                <div className="text-sm font-semibold text-neutral-500 text-right">{pos.menge}</div>
                <div className="text-sm font-semibold text-neutral-500 text-right">{pos.einzelpreisNetto.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</div>
                <div className="text-sm font-bold text-[#1e1b18] text-right">{(pos.menge * pos.einzelpreisNetto).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</div>
              </div>
            ))}
          </div>

          {rechnung.bemerkung && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-[#1e1b18] mb-2">Bemerkung</h3>
              <p className="text-sm text-neutral-600 bg-neutral-50 p-4 rounded-xl border border-neutral-100">
                {rechnung.bemerkung}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100">
            <h3 className="text-sm font-bold text-[#1e1b18] mb-4">Details</h3>
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="font-semibold text-neutral-500">Datum:</span>
              <span className="font-bold text-[#1e1b18]">{new Date(rechnung.datum).toLocaleDateString("de-DE")}</span>
            </div>
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="font-semibold text-neutral-500">Fällig am:</span>
              <span className={`font-bold ${isWarning ? 'text-amber-600' : 'text-[#1e1b18]'}`}>
                {rechnung.faelligAm ? new Date(rechnung.faelligAm).toLocaleDateString("de-DE") : "-"}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="font-semibold text-neutral-500">Mahnstufe:</span>
              <span className="font-bold text-[#1e1b18]">{rechnung.mahnstufe}</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100">
            <h3 className="text-sm font-bold text-[#1e1b18] mb-4">Summen</h3>
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="font-semibold text-neutral-500">Netto:</span>
              <span className="font-bold text-[#1e1b18]">{(rechnung.netto || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</span>
            </div>
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="font-semibold text-neutral-500">USt. ({rechnung.ustSatz}%):</span>
              <span className="font-bold text-[#1e1b18]">{(rechnung.ustBetrag || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</span>
            </div>
            <div className="w-full h-px bg-neutral-200 my-3" />
            <div className="flex justify-between items-center text-lg">
              <span className="font-bold text-[#1e1b18]">Brutto:</span>
              <span className="font-extrabold text-[#1e1b18]">{(rechnung.brutto || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</span>
            </div>
          </div>

          <div className="bg-linear-to-br from-[#1e1b18] to-navy-900 rounded-3xl shadow-sm p-6 text-white border border-[#1e1b18]">
            <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Anchor className="w-4 h-4" /> Vernetzte Bereiche
            </h3>
            
            <div className="flex flex-col gap-3">
              {["offen", "teilbezahlt", "ueberfaellig", "gemahnt", "mahnung"].includes(rechnung.status) && (
                <Link href="/buchhaltung/zahlung" className="p-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-full bg-accent-orange-soft/20 flex items-center justify-center text-accent-orange-light shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-sm font-bold">Offene Posten (OPOS)</span>
                    <span className="block text-[10px] text-white/60">Zahlungsabgleich prüfen</span>
                  </div>
                </Link>
              )}
              
              <Link href="/buchhaltung/steuerprofil" className="p-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-sm font-bold">UStVA & Steuern</span>
                  <span className="block text-[10px] text-white/60">USt-Betrag {rechnung.ustBetrag?.toLocaleString("de-DE")} € gebucht</span>
                </div>
              </Link>
              
              <Link href="/buchhaltung/bwa" className="p-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                  <Euro className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-sm font-bold">BWA-Einnahmen</span>
                  <span className="block text-[10px] text-white/60">Monatsauswertung</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <FeedbackFooter pageTitle={`Rechnung ${rechnung.nummer}`} route={`/buchhaltung/rechnungen/${rechnung.id}`} variant="full" />
    </div>
  );
}
