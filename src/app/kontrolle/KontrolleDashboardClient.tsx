"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";

import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { useState } from 'react';
import Link from 'next/link';
import { 
  ShieldAlert, Activity, Archive, BarChart3, 
  AlertTriangle, Clock, PackageX, Wrench, 
  Truck, MailQuestion, ArrowRight, Info
} from 'lucide-react';
import { DetailOverlay } from '@/components/ui/DetailOverlay';
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { usePermissions } from "@/lib/auth/PermissionsContext";

type QsData = {
  orderId: string;
  ergebnis: string;
  pruefer: string | null;
  bemerkung: string | null;
  orderNumber: string;
};

interface Props {
  qsData?: QsData[];
}

export function KontrolleDashboardClient({ qsData = [] }: Props) {
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);
  const { hasPermission } = usePermissions();
  const canAccessQa = hasPermission("perm_op_qa");

  const qsCount = qsData.length;
  const qsRows = qsCount > 0 ? qsData.map((q) => ({
    avatar: q.ergebnis === "ausschuss" ? "A" : "N",
    avatarColor: q.ergebnis === "ausschuss" ? "bg-error-red" : "bg-warning-yellow",
    name: `${q.orderNumber} (${q.bemerkung || q.ergebnis})`,
    amount: q.pruefer || "Unbekannt",
    href: `/orders/${q.orderId}`
  })) : [{ avatar: "✓", avatarColor: "bg-success-green", name: "Keine Qualitätsmängel", amount: "-", href: "#" }];

  const closeOverlay = () => setActiveOverlay(null);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 font-sans antialiased text-navy-900 min-h-screen bg-[#F0EBE0]">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Kontrolle',href:'/kontrolle'}]} />
        <BackButton label="Home" href="/" />
      </div>
      
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-navy-900 mb-2 font-serif">Kontrolle</h1>
        <p className="text-text-muted text-sm md:text-base">Übersicht über alle administrativen und operativen Steuerungsbereiche.</p>
      </header>

      {/* Große Kachel-Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <div className="bg-white rounded-2xl p-6 border-2 border-navy-900 shadow-sm relative overflow-hidden flex flex-col justify-between h-40">
          <div className="absolute top-0 right-0 w-24 h-24 bg-navy-900/5 rounded-bl-[100px] -z-10" />
          <div>
            <ShieldAlert className="w-8 h-8 text-navy-900 mb-3" />
            <h2 className="text-lg font-bold text-navy-900">Kontrolle</h2>
          </div>
          <p className="text-xs text-text-muted">Operative Prüfungen & offene Probleme</p>
        </div>

        <Link href="/performance" className="bg-white/60 hover:bg-white rounded-2xl p-6 border border-neutral-gray-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between h-40 group cursor-pointer">
          <div>
            <Activity className="w-8 h-8 text-accent-orange mb-3 group-hover:scale-110 transition-transform" />
            <h2 className="text-lg font-bold text-navy-900">Performance</h2>
          </div>
          <p className="text-xs text-text-muted">Wie läuft der Betrieb?</p>
        </Link>

        <Link href="/archive" className="bg-white/60 hover:bg-white rounded-2xl p-6 border border-neutral-gray-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between h-40 group cursor-pointer">
          <div>
            <Archive className="w-8 h-8 text-success-green mb-3 group-hover:scale-110 transition-transform" />
            <h2 className="text-lg font-bold text-navy-900">Archiv</h2>
          </div>
          <p className="text-xs text-text-muted">Abgeschlossene historische Vorgänge</p>
        </Link>

        {canAccessQa && (
          <Link href="/admin/analytics" className="bg-navy-900 hover:bg-navy-800 rounded-2xl p-6 border border-navy-900 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between h-40 group cursor-pointer">
            <div>
              <BarChart3 className="w-8 h-8 text-white mb-3 group-hover:scale-110 transition-transform" />
              <h2 className="text-lg font-bold text-white">Developer Analytics</h2>
            </div>
            <p className="text-xs text-white/70">Wie wird die App genutzt? (Admin)</p>
          </Link>
        )}
      </div>

      {/* Operativer Kontrollbereich */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-navy-900 font-serif">Operativer Kontrollbereich</h2>
          <span className="bg-accent-orange/10 text-accent-orange text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Demo / Nicht angebunden</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          
          <button onClick={() => setActiveOverlay("critical_orders")} className="text-left bg-white rounded-2xl p-5 border border-error-red/20 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-error-red/10 rounded-xl flex items-center justify-center text-error-red">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <span className="text-3xl font-bold text-navy-900">3</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Kritische Aufträge</h3>
              <p className="text-sm text-error-red font-medium">Termin gefährdet</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          <button onClick={() => setActiveOverlay("customer_approval")} className="text-left bg-white rounded-2xl p-5 border border-accent-orange/20 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-accent-orange/10 rounded-xl flex items-center justify-center text-accent-orange">
                  <Clock className="w-6 h-6" />
                </div>
                <span className="text-3xl font-bold text-navy-900">5</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Kundenfreigabe</h3>
              <p className="text-sm text-accent-orange font-medium">Rückfragen offen</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          <button onClick={() => setActiveOverlay("missing_material")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-neutral-gray-100 rounded-xl flex items-center justify-center text-text-muted">
                  <PackageX className="w-6 h-6" />
                </div>
                <span className="text-3xl font-bold text-navy-900">0</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Material fehlt</h3>
              <p className="text-sm text-text-muted font-medium">Bestellungen prüfen</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          <button onClick={() => setActiveOverlay("quality_control")} className="text-left bg-white rounded-2xl p-5 border border-error-red/20 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-error-red/10 rounded-xl flex items-center justify-center text-error-red">
                  <Wrench className="w-6 h-6" />
                </div>
                <span className="text-3xl font-bold text-navy-900">{qsCount}</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">QS / Nacharbeit</h3>
              <p className="text-sm text-error-red font-medium">Reklamationsanalyse</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          <button onClick={() => setActiveOverlay("shipping_pending")} className="text-left bg-white rounded-2xl p-5 border border-success-green/20 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-success-green/10 rounded-xl flex items-center justify-center text-success-green">
                  <Truck className="w-6 h-6" />
                </div>
                <span className="text-3xl font-bold text-navy-900">0</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Warenausgang offen</h3>
              <p className="text-sm text-success-green font-medium">Verpackt, nicht abgeholt</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          <button onClick={() => setActiveOverlay("customer_service")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[#2563EB]/10 rounded-xl flex items-center justify-center text-[#2563EB]">
                  <MailQuestion className="w-6 h-6" />
                </div>
                <span className="text-3xl font-bold text-navy-900">7</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Offene Anfragen</h3>
              <p className="text-sm text-text-muted font-medium">Kundenservice prüfen</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      </div>

      {/* Detail Overlays */}
      
      {/* A: Kritische Aufträge */}
      <DetailOverlay open={activeOverlay === "critical_orders"} onClose={closeOverlay} title="Kritische Aufträge" subtitle="Aufträge, deren Liefertermin unmittelbar gefährdet ist.">
    <div className="space-y-6 text-navy-900">
      <div className="bg-neutral-gray-100 border border-neutral-gray-200 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-navy-900">Keine Daten</h4>
          <p className="text-sm text-text-muted">Aktuell sind 0 Aufträge kritisch.</p>
        </div>
      </div>
    </div>
  </DetailOverlay>

      {/* B: Kundenfreigabe */}
      <DetailOverlay open={activeOverlay === "customer_approval"} onClose={closeOverlay} title="Kundenfreigabe" subtitle="Rückfragen an den Kunden, die die Produktion blockieren.">
    <div className="space-y-6 text-navy-900">
      <div className="bg-neutral-gray-100 border border-neutral-gray-200 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-navy-900">Keine Daten</h4>
          <p className="text-sm text-text-muted">Aktuell liegen 0 Aufträge zur Kundenfreigabe vor.</p>
        </div>
      </div>
    </div>
  </DetailOverlay>

      {/* C: Material fehlt */}
      <DetailOverlay open={activeOverlay === "missing_material"} onClose={closeOverlay} title="Material fehlt" subtitle="Waren oder Verbrauchsmaterial, das die Produktion blockiert.">
    <div className="space-y-6 text-navy-900">
      <div className="bg-neutral-gray-100 border border-neutral-gray-200 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-navy-900">Keine Daten</h4>
          <p className="text-sm text-text-muted">Aktuell fehlen 0 Materialien für die Produktion.</p>
        </div>
      </div>
    </div>
  </DetailOverlay>

      {/* D: QS / Nacharbeit */}
      <AnalysisOverlay
        open={activeOverlay === "quality_control"}
        onClose={closeOverlay}
        title="QS / Reklamationen"
        subtitle="Analyse zu fehlerhaften Teilen und Nacharbeiten."
        hero={{
          kicker: "Aktuelle Reklamationen",
          value: String(qsCount),
          changePill: { text: "Basierend auf Livedaten", variant: qsCount > 0 ? "red" : "gray" }
        }}
        composition={{
          title: "Häufigste Ursachen",
          rows: qsRows
        }}
        insight={{
          body: qsCount > 0 ? `${qsCount} Vorgänge benötigen eine Prüfung oder Nacharbeit.` : "Aktuell keine offenen Reklamationen."
        }}
        linkedAreas={[
          { label: "Warendurchlauf prüfen", href: "/warendurchlauf" },
          { label: "Bäder-Parameter checken", href: "/baeder" }
        ]}
      />

      {/* E: Kundenservice */}
      <DetailOverlay open={activeOverlay === "customer_service"} onClose={closeOverlay} title="Kundenservice prüfen" subtitle="Offene Anfragen und E-Mail-Postfach.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-[#2563EB]/10 border border-[#2563EB]/20 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-[#2563EB]">E-Mail-Import noch nicht angebunden</h4>
              <p className="text-sm text-[#2563EB]/80">Das direkte Auslesen des Info-Postfachs ist in Planung. Die folgenden Zahlen basieren auf manuellen Ticketeingängen (Demo).</p>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Offene Anfragen (7)</h4>
            <div className="bg-bg-app-soft p-4 rounded-lg border border-neutral-gray-100 mb-4">
              <ul className="list-disc pl-5 space-y-1 text-sm text-text-muted">
                <li><strong className="text-navy-900">3x</strong> Neukunden-Anfragen (Preisanfragen)</li>
                <li><strong className="text-navy-900">2x</strong> Statusnachfragen zu laufenden Aufträgen</li>
                <li><strong className="text-error-red">1x</strong> Reklamationsverdacht (&ldquo;Teile sehen fleckig aus&rdquo;)</li>
                <li><strong className="text-navy-900">1x</strong> Änderung der Lieferadresse</li>
              </ul>
            </div>
            
            <h4 className="font-bold mb-2 text-sm">Suchbegriffe für manuelle Mail-Prüfung:</h4>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="bg-neutral-gray-100 px-3 py-1 text-xs rounded-full font-medium">Reklamation</span>
              <span className="bg-neutral-gray-100 px-3 py-1 text-xs rounded-full font-medium">beschädigt</span>
              <span className="bg-neutral-gray-100 px-3 py-1 text-xs rounded-full font-medium">Lieferverzug</span>
              <span className="bg-neutral-gray-100 px-3 py-1 text-xs rounded-full font-medium">mangelhaft</span>
            </div>
          </div>
          
          <div className="pt-4 border-t border-neutral-gray-200 flex justify-end gap-3">
            <Link href="/kommunikation" className="bg-white border border-neutral-gray-200 text-navy-900 px-5 py-2.5 rounded-xl font-bold hover:bg-neutral-gray-50 transition-colors flex items-center gap-2">
              Zum Kundenservice
            </Link>
            <Link href="/quotes" className="bg-navy-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-navy-800 transition-colors flex items-center gap-2">
              Zu den Angeboten <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </DetailOverlay>

      {/* F: Warenausgang offen */}
      <DetailOverlay open={activeOverlay === "shipping_pending"} onClose={closeOverlay} title="Warenausgang offen" subtitle="Verpackt und abholbereit, aber nicht versendet.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-success-green/10 border border-success-green/20 rounded-xl p-4 flex gap-3">
            <Truck className="w-5 h-5 text-success-green shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-success-green">Abholung verzögert</h4>
              <p className="text-sm text-success-green/80">4 Aufträge sind fertig, blockieren aber den Warenausgangsbereich.</p>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Fertige Aufträge (Demo)</h4>
            <ul className="space-y-3">
              <li className="bg-bg-app-soft p-3 rounded-lg flex justify-between items-center border border-neutral-gray-100">
                <div><p className="font-bold">A-2026-0790 <span className="text-text-muted font-normal text-sm">— TechRäder GmbH</span></p><p className="text-xs text-text-muted">Versandart: Spedition (Wartet auf LKW)</p></div>
                <span className="text-xs bg-error-red/20 text-error-red px-2 py-1 rounded font-bold">Seit 3 Tagen</span>
              </li>
              <li className="bg-bg-app-soft p-3 rounded-lg flex justify-between items-center border border-neutral-gray-100">
                <div><p className="font-bold">A-2026-0801 <span className="text-text-muted font-normal text-sm">— Handwerker Schmidt</span></p><p className="text-xs text-text-muted">Versandart: Selbstabholer</p></div>
                <span className="text-xs bg-neutral-gray-200 text-text-muted px-2 py-1 rounded font-bold">Seit heute</span>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-2">Nächste Aktion</h4>
            <p className="text-sm text-text-muted">Spedition für Auftrag A-2026-0790 anmahnen oder Kunde kontaktieren.</p>
          </div>
          
          <div className="pt-4 border-t border-neutral-gray-200 flex justify-end">
            <Link href="/warendurchlauf" className="bg-navy-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-navy-800 transition-colors flex items-center gap-2">
              Warendurchlauf <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </DetailOverlay>

      <FeedbackFooter pageTitle="Kontrolle" route="/kontrolle" variant="full" />
    </div>
  );
}
