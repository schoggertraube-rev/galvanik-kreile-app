"use client";

import React, { useState } from 'react';
import { 
  Banknote, Receipt, FileSpreadsheet, Building, 
  BarChart4, Briefcase, FileText, ArrowRight, Info, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { DetailOverlay } from '@/components/ui/DetailOverlay';

export function FinanzenDashboardClient() {
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);

  const closeOverlay = () => setActiveOverlay(null);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 font-sans antialiased text-navy-900 min-h-screen bg-[#F0EBE0]">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-navy-900 mb-2 font-serif">Buchhaltung & Finanzen</h1>
        <p className="text-text-muted text-sm md:text-base">Finanzielle Übersicht, Steuern und Exporte für die Buchhaltung.</p>
      </header>

      {/* Finanzen Kontrollbereich */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-navy-900 font-serif">Finanz-Zentrale</h2>
          <span className="bg-accent-orange/10 text-accent-orange text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Demo / In Vorbereitung</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          
          {/* 1. Offene Posten */}
          <button onClick={() => setActiveOverlay("open_items")} className="text-left bg-white rounded-2xl p-5 border border-error-red/20 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-error-red/10 rounded-xl flex items-center justify-center text-error-red">
                  <Banknote className="w-6 h-6" />
                </div>
                <span className="text-2xl font-bold text-navy-900">12.450 €</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Offene Posten</h3>
              <p className="text-sm text-error-red font-medium">3 Zahlungen überfällig</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 2. Rechnungen & Zahlungsstatus */}
          <button onClick={() => setActiveOverlay("invoices_status")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-success-green/10 rounded-xl flex items-center justify-center text-success-green">
                  <Receipt className="w-6 h-6" />
                </div>
                <span className="text-2xl font-bold text-navy-900">42</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Rechnungen</h3>
              <p className="text-sm text-text-muted font-medium">Laufender Monat</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 3. DATEV Export */}
          <button onClick={() => setActiveOverlay("datev_export")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[#008200]/10 rounded-xl flex items-center justify-center text-[#008200]">
                  <FileText className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">DATEV Export</h3>
              <p className="text-sm text-text-muted font-medium">Schnittstelle vorbereitet</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Vorschau öffnen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 4. Lexware / Excel Export */}
          <button onClick={() => setActiveOverlay("excel_export")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[#107C41]/10 rounded-xl flex items-center justify-center text-[#107C41]">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Lexware / Excel</h3>
              <p className="text-sm text-text-muted font-medium">Einfacher CSV-Export</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Vorschau öffnen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 5. Deutschland-Steuerprofil */}
          <button onClick={() => setActiveOverlay("tax_profile")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[#2563EB]/10 rounded-xl flex items-center justify-center text-[#2563EB]">
                  <Building className="w-6 h-6" />
                </div>
                <span className="text-xl font-bold text-navy-900">DE</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Steuerprofil</h3>
              <p className="text-sm text-text-muted font-medium">19% / 7% / 0%</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 6. BWA / Monatsübersicht */}
          <button onClick={() => setActiveOverlay("bwa_overview")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-navy-900/10 rounded-xl flex items-center justify-center text-navy-900">
                  <BarChart4 className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">BWA / Monatsübersicht</h3>
              <p className="text-sm text-text-muted font-medium">Betriebswirtschaftliche Auswertung</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 7. Steuerberater-Paket */}
          <button onClick={() => setActiveOverlay("tax_advisor_pkg")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer md:col-span-2 lg:col-span-3">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-kreile-yellow/20 rounded-xl flex items-center justify-center text-navy-900">
                  <Briefcase className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold bg-kreile-yellow/20 text-navy-900 px-3 py-1 rounded-full">Premium-Modul</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Steuerberater-Paket</h3>
              <p className="text-sm text-text-muted font-medium">Digitaler Aktenordner für die Monatsübergabe.</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Paket-Inhalte prüfen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

        </div>
      </div>

      {/* Detail Overlays */}
      
      {/* 1: Offene Posten */}
      <DetailOverlay open={activeOverlay === "open_items"} onClose={closeOverlay} title="Offene Posten (OPOS)" subtitle="Forderungsmanagement und Mahnwesen">
        <div className="space-y-6 text-navy-900">
          <div className="bg-warning-yellow/10 border border-warning-yellow/30 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-warning-yellow shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-navy-900">Demo / Noch nicht angebunden</h4>
              <p className="text-sm text-text-muted">Das Buchhaltungs-Backend verarbeitet noch keine echten Zahlungseingänge.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-100 text-center">
              <span className="block text-2xl font-black text-navy-900">12.450 €</span>
              <span className="text-xs text-text-muted font-bold uppercase tracking-wider">Offene Summe</span>
            </div>
            <div className="bg-error-red/5 p-4 rounded-xl border border-error-red/20 text-center">
              <span className="block text-2xl font-black text-error-red">3.120 €</span>
              <span className="text-xs text-error-red font-bold uppercase tracking-wider">Überfällig</span>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Größte offene Kunden (Demo)</h4>
            <ul className="space-y-3">
              <li className="bg-bg-app-soft p-3 rounded-lg flex justify-between items-center border border-neutral-gray-100">
                <div><p className="font-bold">Metallbau Müller</p><p className="text-xs text-text-muted">Rechnung R-2026-041</p></div>
                <span className="text-sm text-error-red font-bold">2.450 € (Mahnstufe 1)</span>
              </li>
              <li className="bg-bg-app-soft p-3 rounded-lg flex justify-between items-center border border-neutral-gray-100">
                <div><p className="font-bold">AutoTech GmbH</p><p className="text-xs text-text-muted">Rechnung R-2026-045</p></div>
                <span className="text-sm text-navy-900 font-bold">1.800 €</span>
              </li>
            </ul>
          </div>
          
          <div className="pt-4 border-t border-neutral-gray-200 flex justify-end">
            <button onClick={closeOverlay} className="bg-navy-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-navy-800 transition-colors">
              Schließen
            </button>
          </div>
        </div>
      </DetailOverlay>

      {/* 2: Rechnungen & Zahlungsstatus */}
      <DetailOverlay open={activeOverlay === "invoices_status"} onClose={closeOverlay} title="Rechnungen & Zahlungsstatus" subtitle="Übersicht aller Ausgangsrechnungen im System.">
        <div className="space-y-6 text-navy-900">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-success-green/10 p-3 rounded-xl border border-success-green/20 text-center">
              <span className="block text-xl font-black text-success-green">38</span>
              <span className="text-[10px] text-success-green font-bold uppercase tracking-wider">Bezahlt</span>
            </div>
            <div className="bg-neutral-gray-100 p-3 rounded-xl border border-neutral-gray-200 text-center">
              <span className="block text-xl font-black text-navy-900">4</span>
              <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Offen</span>
            </div>
            <div className="bg-error-red/10 p-3 rounded-xl border border-error-red/20 text-center">
              <span className="block text-xl font-black text-error-red">3</span>
              <span className="text-[10px] text-error-red font-bold uppercase tracking-wider">Überfällig</span>
            </div>
            <div className="bg-bg-app-soft p-3 rounded-xl border border-neutral-gray-200 text-center">
              <span className="block text-xl font-black text-navy-900">45</span>
              <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Gesamt</span>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Zahlungsarten</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center"><span className="text-text-muted">Banküberweisung</span><span className="font-bold">85%</span></div>
              <div className="flex justify-between items-center"><span className="text-text-muted">Barzahlung (Abholer)</span><span className="font-bold">10%</span></div>
              <div className="flex justify-between items-center"><span className="text-text-muted">Kreditkarte</span><span className="font-bold">5%</span></div>
            </div>
          </div>
        </div>
      </DetailOverlay>

      {/* 3: DATEV Export */}
      <DetailOverlay open={activeOverlay === "datev_export"} onClose={closeOverlay} title="DATEV Export (Vorbereitung)" subtitle="Buchungsdatenservice / ASCII-Export">
        <div className="space-y-6 text-navy-900">
          <div className="bg-[#008200]/10 border border-[#008200]/20 rounded-xl p-4 flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#008200] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-[#008200]">Exportstruktur vorbereitet</h4>
              <p className="text-sm text-[#008200]/80">Die DATEV-Validierung und finale Formatierung erfolgt in einem späteren Release. Es werden noch keine echten Buchungssätze an DATEV übermittelt.</p>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Zukünftiger Export-Umfang</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-text-muted">
              <li>Ausgangsrechnungen (Debitorenbuchungen)</li>
              <li>Zahlungseingänge (Bankbuchungen)</li>
              <li>Stammdaten-Änderungen (Kunden)</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Pflichtfelder für Buchungssatz</h4>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="bg-bg-app-soft px-2 py-1 rounded border border-neutral-gray-200 font-mono">Belegdatum</span>
              <span className="bg-bg-app-soft px-2 py-1 rounded border border-neutral-gray-200 font-mono">Buchungstext</span>
              <span className="bg-bg-app-soft px-2 py-1 rounded border border-neutral-gray-200 font-mono">Konto</span>
              <span className="bg-bg-app-soft px-2 py-1 rounded border border-neutral-gray-200 font-mono">Gegenkonto</span>
              <span className="bg-bg-app-soft px-2 py-1 rounded border border-neutral-gray-200 font-mono">Betrag</span>
              <span className="bg-bg-app-soft px-2 py-1 rounded border border-neutral-gray-200 font-mono">BU (Steuer)</span>
            </div>
          </div>
        </div>
      </DetailOverlay>

      {/* 4: Lexware / Excel Export */}
      <DetailOverlay open={activeOverlay === "excel_export"} onClose={closeOverlay} title="Lexware / Excel CSV-Export" subtitle="Einfacher Datenexport als Tabelle.">
        <div className="space-y-6 text-navy-900">
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Vorschau: Rechnungsjournal (Demo)</h4>
            <div className="overflow-x-auto border border-neutral-gray-200 rounded-lg">
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="bg-bg-app-soft text-text-muted uppercase">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Beleg-Nr.</th>
                    <th className="px-3 py-2 font-semibold">Datum</th>
                    <th className="px-3 py-2 font-semibold">Kunde</th>
                    <th className="px-3 py-2 font-semibold text-right">Netto</th>
                    <th className="px-3 py-2 font-semibold text-right">Steuer</th>
                    <th className="px-3 py-2 font-semibold text-right">Brutto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-gray-100 bg-white">
                  <tr>
                    <td className="px-3 py-2 font-mono text-navy-900">R-26-041</td>
                    <td className="px-3 py-2">01.06.2026</td>
                    <td className="px-3 py-2">Metallbau Müller</td>
                    <td className="px-3 py-2 text-right">2.058,82</td>
                    <td className="px-3 py-2 text-right">391,18</td>
                    <td className="px-3 py-2 text-right font-bold">2.450,00</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-navy-900">R-26-042</td>
                    <td className="px-3 py-2">01.06.2026</td>
                    <td className="px-3 py-2">AutoTech GmbH</td>
                    <td className="px-3 py-2 text-right">1.512,61</td>
                    <td className="px-3 py-2 text-right">287,39</td>
                    <td className="px-3 py-2 text-right font-bold">1.800,00</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-text-muted mt-2 italic">Hinweis: Die echte Export-Generierung wird mit der Fertigstellung der Auftragsdatenbank verknüpft.</p>
          </div>
          
          <div className="pt-4 border-t border-neutral-gray-200 flex justify-end">
            <button className="bg-neutral-gray-200 text-text-muted px-5 py-2.5 rounded-xl font-bold cursor-not-allowed">
              CSV Herunterladen
            </button>
          </div>
        </div>
      </DetailOverlay>

      {/* 5: Deutschland-Steuerprofil */}
      <DetailOverlay open={activeOverlay === "tax_profile"} onClose={closeOverlay} title="Steuerprofil (Deutschland)" subtitle="Fest hinterlegte Steuersätze für Rechnungen.">
        <div className="space-y-6 text-navy-900">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200">
              <span className="block text-2xl font-black text-navy-900">19 %</span>
              <span className="text-sm text-text-muted font-bold">Standard USt.</span>
            </div>
            <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200">
              <span className="block text-2xl font-black text-navy-900">7 %</span>
              <span className="text-sm text-text-muted font-bold">Reduziert</span>
            </div>
            <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200">
              <span className="block text-2xl font-black text-navy-900">0 %</span>
              <span className="text-sm text-text-muted font-bold">Steuerfrei</span>
            </div>
          </div>
          
          <div className="bg-navy-900/5 p-4 rounded-xl text-sm text-navy-900">
            <p className="font-bold mb-1">System-Regeln:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Die Währung ist global auf <strong>EUR (€)</strong> festgesetzt.</li>
              <li>Eine komplexe Steuerlogik für Drittländer oder Schweiz-MwSt. ist nicht integriert.</li>
              <li>Die Steuer wird präzise je Rechnungsposition (und nicht nur pauschal am Ende) berechnet.</li>
              <li>Reduzierte Sätze müssen beim Artikel bewusst und manuell ausgewählt werden.</li>
            </ul>
          </div>
        </div>
      </DetailOverlay>

      {/* 6: BWA / Monatsübersicht */}
      <DetailOverlay open={activeOverlay === "bwa_overview"} onClose={closeOverlay} title="BWA / Monatsübersicht" subtitle="Betriebswirtschaftliche Auswertung.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-warning-yellow/10 border border-warning-yellow/30 rounded-xl p-4 flex gap-3 mb-6">
            <AlertTriangle className="w-5 h-5 text-warning-yellow shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-navy-900">Demo / Fallback</h4>
              <p className="text-sm text-text-muted">Das System hat aktuell noch keinen Zugriff auf echte Fixkosten und Fremdleistungen. Alle Zahlen sind Platzhalter.</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-white border border-neutral-gray-200 rounded-lg">
              <span className="font-medium text-navy-900">1. Umsatzerlöse</span>
              <span className="font-bold text-navy-900">85.400 €</span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-error-red/5 border border-error-red/10 rounded-lg text-error-red">
              <span className="font-medium">- Materialaufwand</span>
              <span className="font-bold">12.200 €</span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-error-red/5 border border-error-red/10 rounded-lg text-error-red">
              <span className="font-medium">- Fremdleistungen</span>
              <span className="font-bold">4.500 €</span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-success-green/10 border border-success-green/20 rounded-lg">
              <span className="font-bold text-success-green">Deckungsbeitrag</span>
              <span className="font-black text-success-green">68.700 €</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-error-red/5 border border-error-red/10 rounded-lg text-error-red">
              <span className="font-medium">- Betriebliche Fixkosten (geschätzt)</span>
              <span className="font-bold">45.000 €</span>
            </div>

            <div className="flex justify-between items-center p-4 bg-navy-900 rounded-lg text-white mt-4">
              <span className="font-bold text-lg">Vorläufiges Betriebsergebnis</span>
              <span className="font-black text-xl">23.700 €</span>
            </div>
          </div>
        </div>
      </DetailOverlay>

      {/* 7: Steuerberater-Paket */}
      <DetailOverlay open={activeOverlay === "tax_advisor_pkg"} onClose={closeOverlay} title="Steuerberater-Paket" subtitle="Digitaler Aktenordner für die Monatsübergabe.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-bg-app-soft p-5 rounded-xl border border-neutral-gray-200">
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Inhalte für den Steuerberater</h4>
            <ul className="space-y-2 text-sm text-navy-900">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success-green" /> Rechnungsjournal (CSV)</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success-green" /> Ausgangsrechnungen (PDF-Archiv)</li>
              <li className="flex items-center gap-2"><div className="w-4 h-4 shrink-0 rounded-full border-2 border-text-muted" /> Kassensystem-Export (Fehlt noch)</li>
              <li className="flex items-center gap-2"><div className="w-4 h-4 shrink-0 rounded-full border-2 border-text-muted" /> Bankumsätze (Fehlt noch)</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-2">Nächste Schritte</h4>
            <p className="text-sm text-text-muted">Das Datenmodell für Kassen- und Bankbuchungen muss in der nächsten Migration finalisiert werden, bevor das Paket exportiert werden kann.</p>
          </div>
          
          <div className="pt-4 border-t border-neutral-gray-200 flex justify-end">
            <button onClick={closeOverlay} className="bg-navy-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-navy-800 transition-colors">
              Verstanden
            </button>
          </div>
        </div>
      </DetailOverlay>

    </div>
  );
}
