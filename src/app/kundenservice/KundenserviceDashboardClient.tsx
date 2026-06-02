"use client";

import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import React, { useState } from 'react';
import Link from 'next/link';
import { 
  HeartHandshake, MessageCircleWarning, MailQuestion, 
  FileText, Activity, AlertCircle, ArrowRight, Info, CheckCircle2, Copy, MessageSquare
} from 'lucide-react';
import { DetailOverlay } from '@/components/ui/DetailOverlay';

export function KundenserviceDashboardClient() {
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);

  const closeOverlay = () => setActiveOverlay(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    // In a real app we'd show a toast here
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 font-sans antialiased text-navy-900 min-h-screen bg-[#F0EBE0]">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-navy-900 mb-2 font-serif">Kundenservice</h1>
        <p className="text-text-muted text-sm md:text-base">Zentrale für Reklamationen, Rückfragen und Kundenkommunikation.</p>
        <Link href="/kommunikation" className="inline-flex items-center gap-2 mt-4 text-sm font-bold text-navy-900 hover:text-accent-orange transition-colors bg-white px-4 py-2 rounded-xl shadow-sm border border-neutral-gray-200 group">
          <MessageSquare className="w-4 h-4" />
          Zur Kommunikationszentrale (Messenger) <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </header>

      {/* Kundenservice Kontrollbereich */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-navy-900 font-serif">Service-Zentrale</h2>
          <span className="bg-accent-orange/10 text-accent-orange text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Demo / Teil-Angebunden</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          
          {/* 1. Reklamationen */}
          <button onClick={() => setActiveOverlay("complaints")} className="text-left bg-white rounded-2xl p-5 border border-error-red/20 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-error-red/10 rounded-xl flex items-center justify-center text-error-red">
                  <MessageCircleWarning className="w-6 h-6" />
                </div>
                <span className="text-2xl font-bold text-navy-900">2</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Reklamationen</h3>
              <p className="text-sm text-error-red font-medium">Laufende QS-Fälle</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 2. Rückfragen */}
          <button onClick={() => setActiveOverlay("inquiries")} className="text-left bg-white rounded-2xl p-5 border border-accent-orange/20 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-accent-orange/10 rounded-xl flex items-center justify-center text-accent-orange">
                  <MailQuestion className="w-6 h-6" />
                </div>
                <span className="text-2xl font-bold text-navy-900">5</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Rückfragen</h3>
              <p className="text-sm text-accent-orange font-medium">Auf Kundenantwort warten</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 3. E-Mail-Prüfung */}
          <button onClick={() => setActiveOverlay("email_check")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[#2563EB]/10 rounded-xl flex items-center justify-center text-[#2563EB]">
                  <AlertCircle className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">E-Mail-Prüfung</h3>
              <p className="text-sm text-text-muted font-medium">Suchmuster & Verdachtsfälle</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Muster anzeigen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 4. Antwortvorlagen */}
          <button onClick={() => setActiveOverlay("templates")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-neutral-gray-100 rounded-xl flex items-center justify-center text-navy-900">
                  <FileText className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Antwortvorlagen</h3>
              <p className="text-sm text-text-muted font-medium">Textbausteine für Mails</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Vorlagen öffnen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 5. Kundenzufriedenheit */}
          <button onClick={() => setActiveOverlay("satisfaction")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-success-green/10 rounded-xl flex items-center justify-center text-success-green">
                  <HeartHandshake className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Kundenzufriedenheit</h3>
              <p className="text-sm text-text-muted font-medium">Kunden-Ampel (Demo)</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Ampel prüfen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 6. Service-Priorität heute */}
          <button onClick={() => setActiveOverlay("priority_today")} className="text-left bg-white rounded-2xl p-5 border border-kreile-yellow/30 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-kreile-yellow/20 rounded-xl flex items-center justify-center text-navy-900">
                  <Activity className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold bg-kreile-yellow/20 text-navy-900 px-3 py-1 rounded-full">Fokus</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Service-Priorität heute</h3>
              <p className="text-sm text-text-muted font-medium">Empfohlene Tagesreihenfolge</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Agenda ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

        </div>
      </div>

      {/* Detail Overlays */}
      
      {/* 1: Reklamationen */}
      <DetailOverlay open={activeOverlay === "complaints"} onClose={closeOverlay} title="Reklamationen" subtitle="Fehleranalyse und QS-Maßnahmen">
        <div className="space-y-6 text-navy-900">
          <div className="bg-warning-yellow/10 border border-warning-yellow/30 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-warning-yellow shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-navy-900">Demo / Noch nicht angebunden</h4>
              <p className="text-sm text-text-muted">Das Reklamations-Repository ist derzeit noch ein Mock. Zeigt Platzhalterdaten.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-error-red/10 p-4 rounded-xl border border-error-red/20 text-center">
              <span className="block text-2xl font-black text-error-red">2</span>
              <span className="text-xs text-error-red font-bold uppercase tracking-wider">Aktuelle Fälle</span>
            </div>
            <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-100 text-center">
              <span className="block text-2xl font-black text-navy-900">1.5%</span>
              <span className="text-xs text-text-muted font-bold uppercase tracking-wider">Fehlerquote</span>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Häufigste Ursachen (Diese Woche)</h4>
            <ul className="space-y-3">
              <li className="bg-bg-app-soft p-3 rounded-lg flex justify-between items-center border border-neutral-gray-100">
                <div><p className="font-bold">Oberflächenqualität mangelhaft</p><p className="text-xs text-text-muted">Betroffene Station: Bad 3 (Verzinken)</p></div>
                <span className="text-xs bg-error-red text-white px-2 py-1 rounded font-bold">Wiederholung</span>
              </li>
              <li className="bg-bg-app-soft p-3 rounded-lg flex justify-between items-center border border-neutral-gray-100">
                <div><p className="font-bold">Lieferverzug</p><p className="text-xs text-text-muted">Auftragstyp: Express-Gestell</p></div>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-2">Empfohlene Maßnahme</h4>
            <p className="text-sm text-text-muted">Parameterprüfung an Bad 3 (Temperatur/Stromdichte) priorisieren, da Wiederholungsmuster bei Oberflächenqualität erkannt wurde.</p>
          </div>
        </div>
      </DetailOverlay>

      {/* 2: Rückfragen */}
      <DetailOverlay open={activeOverlay === "inquiries"} onClose={closeOverlay} title="Rückfragen" subtitle="Warten auf Kundenfreigabe oder Klärung.">
        <div className="space-y-6 text-navy-900">
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Offene Kundenrückfragen</h4>
            <ul className="space-y-3">
              <li className="bg-bg-app-soft p-3 rounded-lg flex flex-col gap-2 border border-neutral-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">Schrauben Meier <span className="font-normal text-text-muted">— AN-0422</span></p>
                    <p className="text-sm text-text-muted">Freigabe für Mehrkosten (Dickere Schicht) offen.</p>
                  </div>
                  <span className="text-xs bg-error-red/20 text-error-red px-2 py-1 rounded font-bold whitespace-nowrap">Seit 4 Tagen</span>
                </div>
                <div className="flex justify-end gap-2 mt-2">
                   <button className="text-xs bg-white border border-neutral-gray-200 px-3 py-1.5 rounded-lg font-bold hover:bg-neutral-gray-100">Anrufen</button>
                   <Link href="/quotes" className="text-xs bg-navy-900 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-navy-800">Zu Angeboten</Link>
                </div>
              </li>
              <li className="bg-bg-app-soft p-3 rounded-lg flex flex-col gap-2 border border-neutral-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">BikeParts UG <span className="font-normal text-text-muted">— A-2026-0799</span></p>
                    <p className="text-sm text-text-muted">Rückfrage zum stark rostigen Anlieferzustand.</p>
                  </div>
                  <span className="text-xs bg-neutral-gray-200 text-text-muted px-2 py-1 rounded font-bold whitespace-nowrap">Seit 1 Tag</span>
                </div>
                <div className="flex justify-end gap-2 mt-2">
                   <button className="text-xs bg-white border border-neutral-gray-200 px-3 py-1.5 rounded-lg font-bold hover:bg-neutral-gray-100">Mail vorbereiten</button>
                   <Link href="/orders" className="text-xs bg-navy-900 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-navy-800">Zum Auftrag</Link>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </DetailOverlay>

      {/* 3: E-Mail-Prüfung */}
      <DetailOverlay open={activeOverlay === "email_check"} onClose={closeOverlay} title="E-Mail-Prüfung" subtitle="Suchmuster für das info@-Postfach.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-[#2563EB]/10 border border-[#2563EB]/20 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-[#2563EB]">E-Mail-Import noch nicht angebunden</h4>
              <p className="text-sm text-[#2563EB]/80">Bitte prüfen Sie das Postfach manuell anhand dieser Muster.</p>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Suchbegriffe für manuelle Prüfung</h4>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="bg-bg-app-soft px-3 py-1.5 rounded border border-neutral-gray-200 font-medium">Reklamation</span>
              <span className="bg-bg-app-soft px-3 py-1.5 rounded border border-neutral-gray-200 font-medium">beschädigt</span>
              <span className="bg-bg-app-soft px-3 py-1.5 rounded border border-neutral-gray-200 font-medium">nicht zufrieden</span>
              <span className="bg-bg-app-soft px-3 py-1.5 rounded border border-neutral-gray-200 font-medium">Lieferverzug</span>
              <span className="bg-bg-app-soft px-3 py-1.5 rounded border border-neutral-gray-200 font-medium">falsch</span>
              <span className="bg-bg-app-soft px-3 py-1.5 rounded border border-neutral-gray-200 font-medium">mangelhaft</span>
              <span className="bg-bg-app-soft px-3 py-1.5 rounded border border-neutral-gray-200 font-medium">noch nicht da</span>
              <span className="bg-bg-app-soft px-3 py-1.5 rounded border border-neutral-gray-200 font-medium">wann fertig</span>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Kategorisierung</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-text-muted">
              <li><strong className="text-error-red">1. Priorität:</strong> Reklamationsverdacht, Mangel</li>
              <li><strong className="text-accent-orange">2. Priorität:</strong> Terminfragen, Lieferverzug</li>
              <li><strong className="text-navy-900">3. Priorität:</strong> Freigabe offen, Abholung/Versand</li>
              <li><strong className="text-text-muted">4. Priorität:</strong> Normale Preisfragen (Neukunden)</li>
            </ul>
          </div>
        </div>
      </DetailOverlay>

      {/* 4: Antwortvorlagen */}
      <DetailOverlay open={activeOverlay === "templates"} onClose={closeOverlay} title="Antwortvorlagen" subtitle="Standardtexte für wiederkehrende Situationen.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-neutral-gray-100 p-4 rounded-xl border border-neutral-gray-200 mb-4">
            <h4 className="font-bold flex items-center justify-between">
              Reklamation sachlich bestätigen
              <button onClick={() => handleCopy("Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihre Nachricht. Wir bedauern sehr, dass die gelieferte Qualität nicht Ihren Erwartungen entspricht. Wir haben den Vorgang intern zur Prüfung an unsere Qualitätssicherung weitergegeben und melden uns schnellstmöglich mit einer Lösung bei Ihnen.\n\nMit freundlichen Grüßen")} className="p-1.5 hover:bg-white rounded-lg transition-colors" title="Kopieren">
                <Copy className="w-4 h-4 text-text-muted" />
              </button>
            </h4>
            <p className="text-sm mt-2 text-text-muted whitespace-pre-wrap select-all font-mono bg-white p-3 rounded border border-neutral-gray-100">
              Sehr geehrte Damen und Herren,{'\n\n'}
              vielen Dank für Ihre Nachricht. Wir bedauern sehr, dass die gelieferte Qualität nicht Ihren Erwartungen entspricht. Wir haben den Vorgang intern zur Prüfung an unsere Qualitätssicherung weitergegeben und melden uns schnellstmöglich mit einer Lösung bei Ihnen.{'\n\n'}
              Mit freundlichen Grüßen
            </p>
          </div>

          <div className="bg-neutral-gray-100 p-4 rounded-xl border border-neutral-gray-200 mb-4">
            <h4 className="font-bold flex items-center justify-between">
              Freigabe anfordern
              <button onClick={() => handleCopy("Sehr geehrte Damen und Herren,\n\num mit der Bearbeitung Ihres Auftrags fortfahren zu können, benötigen wir noch eine kurze Freigabe bezüglich [...].\n\nBitte geben Sie uns kurz Bescheid, damit wir den Prozess nicht verzögern.\n\nMit freundlichen Grüßen")} className="p-1.5 hover:bg-white rounded-lg transition-colors" title="Kopieren">
                <Copy className="w-4 h-4 text-text-muted" />
              </button>
            </h4>
            <p className="text-sm mt-2 text-text-muted whitespace-pre-wrap select-all font-mono bg-white p-3 rounded border border-neutral-gray-100">
              Sehr geehrte Damen und Herren,{'\n\n'}
              um mit der Bearbeitung Ihres Auftrags fortfahren zu können, benötigen wir noch eine kurze Freigabe bezüglich [...].{'\n\n'}
              Bitte geben Sie uns kurz Bescheid, damit wir den Prozess nicht verzögern.{'\n\n'}
              Mit freundlichen Grüßen
            </p>
          </div>
          
          <p className="text-xs text-center text-text-muted">Der direkte Mailversand ist in dieser Version noch nicht aktiviert.</p>
        </div>
      </DetailOverlay>

      {/* 5: Kundenzufriedenheit */}
      <DetailOverlay open={activeOverlay === "satisfaction"} onClose={closeOverlay} title="Kundenzufriedenheit" subtitle="Risikobewertung bei laufenden Vorgängen.">
        <div className="space-y-6 text-navy-900">
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Kunden-Ampel (Demo)</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-error-red/10 border border-error-red/20 rounded-lg">
                <div className="w-3 h-3 rounded-full bg-error-red mt-1.5 shrink-0" />
                <div>
                  <p className="font-bold text-error-red">Kritisch</p>
                  <p className="text-sm text-error-red/80">Wiederholte Reklamation (Metallbau Müller). Kunde hat bereits beim letzten Auftrag Mängel gemeldet. Direkter Anruf vom Inhaber empfohlen.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-accent-orange/10 border border-accent-orange/20 rounded-lg">
                <div className="w-3 h-3 rounded-full bg-accent-orange mt-1.5 shrink-0" />
                <div>
                  <p className="font-bold text-accent-orange">Beobachten</p>
                  <p className="text-sm text-accent-orange/80">Lange offene Rückfrage (Schrauben Meier). Erstkunde mit unklarer Erwartungshaltung bezüglich Schichtdicke. Termin gefährdet.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-success-green/10 border border-success-green/20 rounded-lg">
                <div className="w-3 h-3 rounded-full bg-success-green mt-1.5 shrink-0" />
                <div>
                  <p className="font-bold text-success-green">Stabil</p>
                  <p className="text-sm text-success-green/80">Der Großteil der Stammkunden (&gt;95%) läuft reibungslos im Standard-Prozess ohne manuellen Klärungsbedarf.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DetailOverlay>

      {/* 6: Service-Priorität heute */}
      <DetailOverlay open={activeOverlay === "priority_today"} onClose={closeOverlay} title="Service-Priorität heute" subtitle="Empfohlene Arbeitsreihenfolge für den Tag.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-bg-app-soft p-5 rounded-xl border border-neutral-gray-200">
            <ol className="space-y-4">
              <li className="flex gap-4 relative">
                <div className="w-8 h-8 shrink-0 rounded-full bg-error-red text-white flex items-center justify-center font-bold z-10">1</div>
                <div className="pt-1">
                  <p className="font-bold text-navy-900">Reklamationsverdacht prüfen</p>
                  <p className="text-sm text-text-muted mt-1">Warum: Verhindert Eskalation und zeigt schnelle Reaktionsfähigkeit. Höchstes Frustrationsrisiko beim Kunden.</p>
                </div>
                <div className="absolute left-4 top-8 bottom-[-16px] w-0.5 bg-neutral-gray-200" />
              </li>
              <li className="flex gap-4 relative">
                <div className="w-8 h-8 shrink-0 rounded-full bg-accent-orange text-white flex items-center justify-center font-bold z-10">2</div>
                <div className="pt-1">
                  <p className="font-bold text-navy-900">Kundenfreigaben einholen</p>
                  <p className="text-sm text-text-muted mt-1">Warum: Entblockiert die Produktion. Aufträge bleiben sonst im System hängen.</p>
                </div>
                <div className="absolute left-4 top-8 bottom-[-16px] w-0.5 bg-neutral-gray-200" />
              </li>
              <li className="flex gap-4 relative">
                <div className="w-8 h-8 shrink-0 rounded-full bg-navy-900 text-white flex items-center justify-center font-bold z-10">3</div>
                <div className="pt-1">
                  <p className="font-bold text-navy-900">Liefertermin kommunizieren</p>
                  <p className="text-sm text-text-muted mt-1">Warum: Wenn Aufträge in Verzug geraten, proaktiv informieren, bevor der Kunde nachfragt.</p>
                </div>
                <div className="absolute left-4 top-8 bottom-[-16px] w-0.5 bg-neutral-gray-200" />
              </li>
              <li className="flex gap-4 relative">
                <div className="w-8 h-8 shrink-0 rounded-full bg-neutral-gray-400 text-white flex items-center justify-center font-bold z-10">4</div>
                <div className="pt-1">
                  <p className="font-bold text-navy-900">Abholung erinnern</p>
                  <p className="text-sm text-text-muted mt-1">Warum: Schafft Platz im Warenausgang und beschleunigt den Zahlungseingang.</p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </DetailOverlay>

      <FeedbackFooter pageTitle="Kundenservice" route="/kundenservice" variant="full" />
    </div>
  );
}
