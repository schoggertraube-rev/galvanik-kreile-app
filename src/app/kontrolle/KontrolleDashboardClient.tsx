"use client";

import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ShieldAlert, Activity, Archive, BarChart3, 
  AlertTriangle, Clock, PackageX, Wrench, 
  Truck, MailQuestion, ArrowRight, XCircle, Info
} from 'lucide-react';
import { DetailOverlay } from '@/components/ui/DetailOverlay';

interface Props {
  isDevOrAdmin: boolean;
}

export function KontrolleDashboardClient({ isDevOrAdmin }: Props) {
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);
  const [isAdminOrDevLocal, setIsAdminOrDevLocal] = useState(isDevOrAdmin);

  useEffect(() => {
    const role = localStorage.getItem("kreile_user_role");
    if (role === "admin" || role === "developer" || isDevOrAdmin) {
      setIsAdminOrDevLocal(true);
    }
  }, [isDevOrAdmin]);

  const closeOverlay = () => setActiveOverlay(null);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 font-sans antialiased text-navy-900 min-h-screen bg-[#F0EBE0]">
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

        {isAdminOrDevLocal && (
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
                <span className="text-3xl font-bold text-navy-900">1</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Material fehlt</h3>
              <p className="text-sm text-text-muted font-medium">Goldbad Nachschub</p>
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
                <span className="text-3xl font-bold text-navy-900">2</span>
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
                <span className="text-3xl font-bold text-navy-900">4</span>
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
          <div className="bg-error-red/10 border border-error-red/20 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-error-red shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-error-red">Sofortiger Handlungsbedarf</h4>
              <p className="text-sm text-error-red/80">3 Aufträge überschreiten den garantierten Liefertermin heute, wenn sie nicht priorisiert werden.</p>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Betroffene Vorgänge (Demo)</h4>
            <ul className="space-y-3">
              <li className="bg-bg-app-soft p-3 rounded-lg flex justify-between items-center border border-neutral-gray-100">
                <div><p className="font-bold">A-2026-0815 <span className="text-text-muted font-normal text-sm">— Metallbau Müller</span></p><p className="text-xs text-text-muted">Station: Verzinken (Seit 2 Tagen im Rückstand)</p></div>
                <span className="text-xs bg-error-red text-white px-2 py-1 rounded font-bold">Heute fällig</span>
              </li>
              <li className="bg-bg-app-soft p-3 rounded-lg flex justify-between items-center border border-neutral-gray-100">
                <div><p className="font-bold">A-2026-0820 <span className="text-text-muted font-normal text-sm">— AutoTech GmbH</span></p><p className="text-xs text-text-muted">Station: Qualitätskontrolle</p></div>
                <span className="text-xs bg-accent-orange text-white px-2 py-1 rounded font-bold">Morgen fällig</span>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-2">Ursache</h4>
            <p className="text-sm text-text-muted">Krankheitsausfall an der Verzinkungsanlage hat den Durchsatz gestern um 40% reduziert.</p>
          </div>
          
          <div className="pt-4 border-t border-neutral-gray-200 flex justify-end">
            <Link href="/orders" className="bg-navy-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-navy-800 transition-colors flex items-center gap-2">
              Aufträge ansehen <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </DetailOverlay>

      {/* B: Kundenfreigabe */}
      <DetailOverlay open={activeOverlay === "customer_approval"} onClose={closeOverlay} title="Warten auf Kundenfreigabe" subtitle="Rückfragen, bei denen der Kunde am Zug ist.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-accent-orange/10 border border-accent-orange/20 rounded-xl p-4 flex gap-3">
            <Clock className="w-5 h-5 text-accent-orange shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-accent-orange">Kontakt erforderlich</h4>
              <p className="text-sm text-accent-orange/80">5 Vorgänge pausieren. Eine telefonische Erinnerung bei den ältesten Vorgängen wird empfohlen.</p>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Offene Freigaben (Demo)</h4>
            <ul className="space-y-3">
              <li className="bg-bg-app-soft p-3 rounded-lg flex justify-between items-center border border-neutral-gray-100">
                <div><p className="font-bold">AN-0422 <span className="text-text-muted font-normal text-sm">— Schrauben Meier</span></p><p className="text-xs text-text-muted">Unklarheit bezüglich Schichtdicke.</p></div>
                <span className="text-xs bg-error-red/20 text-error-red px-2 py-1 rounded font-bold">Seit 4 Tagen</span>
              </li>
              <li className="bg-bg-app-soft p-3 rounded-lg flex justify-between items-center border border-neutral-gray-100">
                <div><p className="font-bold">A-2026-0799 <span className="text-text-muted font-normal text-sm">— BikeParts UG</span></p><p className="text-xs text-text-muted">Rückfrage zu angeliefertem Zustand (rostig).</p></div>
                <span className="text-xs bg-neutral-gray-200 text-text-muted px-2 py-1 rounded font-bold">Seit 1 Tag</span>
              </li>
            </ul>
          </div>
          
          <div className="pt-4 border-t border-neutral-gray-200 flex justify-end gap-3">
            <Link href="/quotes" className="bg-navy-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-navy-800 transition-colors flex items-center gap-2">
              Zu den Angeboten <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </DetailOverlay>

      {/* C: Material fehlt */}
      <DetailOverlay open={activeOverlay === "missing_material"} onClose={closeOverlay} title="Material fehlt" subtitle="Waren oder Verbrauchsmaterial, das die Produktion blockiert.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-neutral-gray-100 border border-neutral-gray-200 rounded-xl p-4 flex gap-3">
            <PackageX className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-navy-900">Produktionsblockade</h4>
              <p className="text-sm text-text-muted">1 wichtiges Material nähert sich dem kritischen Füllstand und gefährdet die Goldbad-Station.</p>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Fehlendes Material (Demo)</h4>
            <div className="bg-bg-app-soft p-4 rounded-lg border border-neutral-gray-100">
              <p className="font-bold">Gold-Elektrolyt (AURUM-7)</p>
              <p className="text-sm text-text-muted mt-1">Aktueller Bestand: 2L (Kritisch). Letzte Bestellung vor 4 Wochen.</p>
              <p className="text-sm text-error-red font-medium mt-2">Risiko: Stillstand in 2 Tagen bei aktueller Auftragslage.</p>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-2">Empfohlene Aktion</h4>
            <p className="text-sm text-text-muted">Umgehende Nachbestellung beim Lieferanten (Express-Versand).</p>
          </div>
          
          <div className="pt-4 border-t border-neutral-gray-200 flex justify-end gap-3">
            <Link href="/baeder" className="bg-white border border-neutral-gray-200 text-navy-900 px-5 py-2.5 rounded-xl font-bold hover:bg-neutral-gray-50 transition-colors flex items-center gap-2">
              Bäder prüfen
            </Link>
            <Link href="/items" className="bg-navy-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-navy-800 transition-colors flex items-center gap-2">
              Inventar öffnen <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </DetailOverlay>

      {/* D: QS / Nacharbeit */}
      <DetailOverlay open={activeOverlay === "quality_control"} onClose={closeOverlay} title="QS / Reklamationen" subtitle="Analyse zu fehlerhaften Teilen und Nacharbeiten.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-warning-yellow/10 border border-warning-yellow/30 rounded-xl p-4 flex items-center justify-between">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-warning-yellow shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-navy-900">Demo / Noch nicht vollständig angebunden</h4>
                <p className="text-sm text-text-muted">Die Reklamationsdatenbank (complaintsRepository) wird derzeit migriert.</p>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Reklamationsanalyse (Beispieldaten)</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-bg-app-soft p-4 rounded-xl text-center border border-neutral-gray-100">
                <span className="block text-3xl font-black text-navy-900">2</span>
                <span className="text-xs text-text-muted font-bold uppercase tracking-wider">Aktuelle Fälle</span>
              </div>
              <div className="bg-bg-app-soft p-4 rounded-xl text-center border border-neutral-gray-100">
                <span className="block text-3xl font-black text-error-red">4.2%</span>
                <span className="text-xs text-text-muted font-bold uppercase tracking-wider">Fehlerquote (Woche)</span>
              </div>
            </div>
            
            <ul className="space-y-3">
              <li className="bg-bg-app-soft p-3 rounded-lg flex justify-between items-center border border-neutral-gray-100">
                <div><p className="font-bold">Oberflächenqualität mangelhaft</p><p className="text-xs text-text-muted">Häufigste Ursache diese Woche</p></div>
                <span className="text-xs bg-neutral-gray-200 text-text-muted px-2 py-1 rounded font-bold">Station: Bad 3</span>
              </li>
              <li className="bg-bg-app-soft p-3 rounded-lg flex justify-between items-center border border-neutral-gray-100">
                <div><p className="font-bold">Transportschaden</p><p className="text-xs text-text-muted">Wiederholungsmuster erkannt</p></div>
                <span className="text-xs bg-neutral-gray-200 text-text-muted px-2 py-1 rounded font-bold">Verpackung</span>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-2">Verbesserungsmaßnahme</h4>
            <p className="text-sm text-text-muted">Kontrolle der Badparameter an Station 3 (Temperatur/Stromdichte) anweisen.</p>
          </div>
          
          <div className="pt-4 border-t border-neutral-gray-200 flex justify-end gap-3 flex-wrap">
            <Link href="/baeder" className="bg-white border border-neutral-gray-200 text-navy-900 px-5 py-2.5 rounded-xl font-bold hover:bg-neutral-gray-50 transition-colors flex items-center gap-2">
              Bäder prüfen
            </Link>
            <Link href="/kundenservice" className="bg-white border border-neutral-gray-200 text-navy-900 px-5 py-2.5 rounded-xl font-bold hover:bg-neutral-gray-50 transition-colors flex items-center gap-2">
              Zum Kundenservice
            </Link>
            <Link href="/orders" className="bg-navy-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-navy-800 transition-colors flex items-center gap-2">
              Aufträge prüfen <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </DetailOverlay>

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
                <li><strong className="text-error-red">1x</strong> Reklamationsverdacht ("Teile sehen fleckig aus")</li>
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
            <Link href="/kundenservice" className="bg-white border border-neutral-gray-200 text-navy-900 px-5 py-2.5 rounded-xl font-bold hover:bg-neutral-gray-50 transition-colors flex items-center gap-2">
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
