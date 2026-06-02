"use client";

import { useState, useEffect } from "react";
import { 
  Inbox, AlertOctagon, MessageSquare, Bot, Link as LinkIcon, 
  Receipt, BarChart3, CheckSquare, Info, ExternalLink, Mail, Phone, Globe
} from "lucide-react";
import { DetailOverlay } from "@/components/ui/DetailOverlay";
import Link from "next/link";
import { inquiriesRepository } from "@/lib/repositories/inquiriesRepository";
import { usePageView } from "@/hooks/usePageView";

export function KommunikationClient() {
  usePageView();
  const [openInquiries, setOpenInquiries] = useState(0);
  const [activeOverlay, setActiveOverlay] = useState<{
    title: string;
    desc: string;
    targetLink?: string;
  } | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setOpenInquiries(await inquiriesRepository.getOpenCount());
      } catch (e) {
        setOpenInquiries(0);
      }
    };
    fetchStats();
    window.addEventListener("kreile-inquiries-updated", fetchStats);
    return () => window.removeEventListener("kreile-inquiries-updated", fetchStats);
  }, []);

  const openDemoOverlay = (title: string, desc: string, link?: string) => {
    setActiveOverlay({ title, desc, targetLink: link });
  };

  return (
    <div className="space-y-6 pb-8 font-sans antialiased text-navy-900 w-full max-w-7xl mx-auto animate-in fade-in duration-400">
      
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-black font-serif tracking-tight text-navy-900 flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-accent-orange" />
          Kommunikationszentrale
        </h1>
        <p className="text-text-muted mt-2 font-medium">Zentraler Posteingang für alle Kundenkanäle (Demo-Modus).</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFTSIDE: HEUTE BEANTWORTEN & MAIN TILES */}
        <div className="lg:col-span-2 space-y-6">
          
          <section className="bg-bg-app-soft border border-neutral-gray-200 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold font-serif text-navy-900 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-accent-orange" />
                Heute beantworten
              </h2>
              <span className="bg-white text-text-muted text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">Priorisiert</span>
            </div>
            
            <div className="space-y-3">
              <div className="bg-white border-l-4 border-error-red rounded-xl p-4 flex justify-between items-start cursor-pointer hover:shadow-md transition" onClick={() => openDemoOverlay("Reklamation: Maier GmbH", "Kunde reklamiert Kratzer an Charge 8102. Bilder sind angehängt.", "/kundenservice")}>
                <div>
                  <h3 className="font-bold text-navy-900 text-sm">Reklamationsverdacht: Maier GmbH</h3>
                  <p className="text-xs text-text-muted mt-1">E-Mail von heute 08:14</p>
                </div>
                <span className="bg-error-red/10 text-error-red text-[10px] font-black uppercase px-2 py-1 rounded">Hoch</span>
              </div>
              <div className="bg-white border-l-4 border-accent-orange rounded-xl p-4 flex justify-between items-start cursor-pointer hover:shadow-md transition" onClick={() => openDemoOverlay("Offene Freigabe: Schmidt AG", "Kunde hat noch nicht auf das Angebot reagiert.", "/quotes")}>
                <div>
                  <h3 className="font-bold text-navy-900 text-sm">Offene Freigaben: Schmidt AG</h3>
                  <p className="text-xs text-text-muted mt-1">Wartet seit 3 Tagen</p>
                </div>
                <span className="bg-accent-orange/10 text-accent-orange text-[10px] font-black uppercase px-2 py-1 rounded">Mittel</span>
              </div>
              <div className="bg-white border-l-4 border-neutral-gray-300 rounded-xl p-4 flex justify-between items-start cursor-pointer hover:shadow-md transition" onClick={() => openDemoOverlay("Neue Anfrage prüfen", "Unbekannter Kunde fragt nach Kapazitäten für 500 Teile.", "/quotes")}>
                <div>
                  <h3 className="font-bold text-navy-900 text-sm">Neue Anfrage (Website)</h3>
                  <p className="text-xs text-text-muted mt-1">Vor 2 Stunden eingegangen</p>
                </div>
                <span className="bg-gray-100 text-text-muted text-[10px] font-black uppercase px-2 py-1 rounded">Neu</span>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => openDemoOverlay("Posteingang", "Zeigt gebündelte Nachrichtenkanäle: E-Mail, WhatsApp, Instagram, Website-Anfrage. Live-Import noch nicht angebunden.")}
              className="bg-white border border-neutral-gray-200 rounded-2xl p-6 text-left hover:border-navy-900 hover:shadow-md transition-all group"
            >
              <Inbox className="w-8 h-8 text-navy-900 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-lg text-navy-900 mb-1">Posteingang</h3>
              <p className="text-sm text-text-muted">Alle Kanäle gebündelt. <span className="font-bold text-accent-orange">Live später</span></p>
            </button>

            <button 
              onClick={() => openDemoOverlay("Reklamationsverdacht", "Nachrichten mit kritischen Begriffen (Reklamation, beschädigt, etc.) werden hier gesammelt und priorisiert.", "/kundenservice")}
              className="bg-white border border-neutral-gray-200 rounded-2xl p-6 text-left hover:border-error-red hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-error-red" />
              <AlertOctagon className="w-8 h-8 text-error-red mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-lg text-navy-900 mb-1">Reklamationsverdacht</h3>
              <p className="text-sm text-text-muted">Kritische Nachrichten sofort erkennen.</p>
            </button>

            <button 
              onClick={() => openDemoOverlay("Antwortassistent", "Vorlagen für Bestätigungen, Termine und Freigaben. Kopieren in Clipboard vorbereitet.")}
              className="bg-white border border-neutral-gray-200 rounded-2xl p-6 text-left hover:border-navy-900 hover:shadow-md transition-all group"
            >
              <Bot className="w-8 h-8 text-navy-900 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-lg text-navy-900 mb-1">Antwortassistent</h3>
              <p className="text-sm text-text-muted">Schnelle Vorlagen und Textbausteine.</p>
            </button>

            <button 
              onClick={() => openDemoOverlay("Kunden zuordnen", "Unbekannte Absender einem bestehenden Kunden oder Auftrag zuordnen.")}
              className="bg-white border border-neutral-gray-200 rounded-2xl p-6 text-left hover:border-navy-900 hover:shadow-md transition-all group"
            >
              <LinkIcon className="w-8 h-8 text-navy-900 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-lg text-navy-900 mb-1">Kunden zuordnen</h3>
              <p className="text-sm text-text-muted">Nachrichten verknüpfen. <span className="font-bold text-accent-orange">Demo</span></p>
            </button>
          </div>

        </div>

        {/* RIGHTSIDE: PANELS */}
        <div className="space-y-6">
          
          <section className="bg-white border border-neutral-gray-200 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold font-serif text-navy-900">Anfragen</h2>
              <span className="bg-bg-app-soft text-text-muted text-xs px-2 py-1 rounded font-bold">{openInquiries > 0 ? "Live" : "Demo"}</span>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-bg-app-soft rounded-full flex items-center justify-center">
                <Globe className="w-6 h-6 text-navy-900" />
              </div>
              <div>
                <span className="text-3xl font-black text-navy-900">{openInquiries || 5}</span>
                <p className="text-xs text-text-muted font-bold uppercase tracking-wider">Offen</p>
              </div>
            </div>
            <button 
              onClick={() => openDemoOverlay("Anfragen prüfen", "Website- und E-Mail-Anfragen bündeln und bearbeiten.", "/quotes")}
              className="w-full bg-bg-app-soft text-navy-900 font-bold py-2 rounded-xl text-sm hover:bg-neutral-gray-200 transition"
            >
              Zur Angebotsvorbereitung
            </button>
          </section>

          <section className="bg-white border border-neutral-gray-200 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold font-serif text-navy-900">Rechnungen</h2>
              <span className="bg-bg-app-soft text-text-muted text-xs px-2 py-1 rounded font-bold">Vorbereitet</span>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5 text-text-muted" />
                <span className="text-sm font-bold text-navy-900">Zahlungsnachrichten</span>
              </div>
              <button 
                onClick={() => openDemoOverlay("Rechnungen & Zahlungen", "Versandinfos, Zahlungslinks und Erinnerungen. Keine echte Erzeugung aktiv.", "/finanzen")}
                className="w-full border border-neutral-gray-200 text-navy-900 font-bold py-2 rounded-xl text-sm hover:bg-bg-app-soft transition"
              >
                Finanz-Dashboard öffnen
              </button>
            </div>
          </section>

          <section className="bg-white border border-neutral-gray-200 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold font-serif text-navy-900">Analyse</h2>
              <span className="bg-bg-app-soft text-text-muted text-xs px-2 py-1 rounded font-bold">Demo</span>
            </div>
            <ul className="space-y-3 text-sm font-medium text-navy-900">
              <li className="flex justify-between border-b pb-2"><span>Ø Antwortzeit</span> <span className="font-bold">4.2 Std</span></li>
              <li className="flex justify-between border-b pb-2"><span>Kanäle</span> <span className="font-bold">E-Mail (80%)</span></li>
              <li className="flex justify-between"><span>Stoßzeit</span> <span className="font-bold">08:00 - 10:00</span></li>
            </ul>
            <button 
              onClick={() => openDemoOverlay("Kommunikationsanalyse", "Auswertung von häufigsten Themen, Antwortzeiten und Stressphasen vorbereitet.")}
              className="mt-4 w-full text-center text-xs font-bold text-accent-orange hover:underline"
            >
              Details ansehen
            </button>
          </section>

        </div>
      </div>

      <DetailOverlay open={!!activeOverlay} onClose={() => setActiveOverlay(null)} title={activeOverlay?.title || ""}>
        <div className="space-y-6 text-navy-900">
          <div className="p-4 rounded-xl border bg-bg-app-soft border-neutral-gray-200 flex gap-3">
            <Info className="w-5 h-5 shrink-0 mt-0.5 text-navy-900" />
            <div>
              <h4 className="font-bold">Modul-Vorbereitung</h4>
              <p className="text-sm mt-1 text-text-muted">{activeOverlay?.desc}</p>
            </div>
          </div>
          
          <div className="pt-4 border-t border-neutral-gray-200 flex justify-end">
             {activeOverlay?.targetLink && (
               <Link href={activeOverlay.targetLink} onClick={() => setActiveOverlay(null)} className="bg-navy-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-navy-800 transition-colors flex items-center gap-2">
                 Zum Bereich <ExternalLink className="w-4 h-4" />
               </Link>
             )}
          </div>
        </div>
      </DetailOverlay>

    </div>
  );
}
