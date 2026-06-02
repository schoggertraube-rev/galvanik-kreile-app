"use client";

import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Beaker, AlertTriangle, CalendarDays, FlaskConical, 
  TrendingDown, DollarSign, ShieldAlert, ArrowRight, Info, CheckCircle2, Droplets
} from 'lucide-react';
import { DetailOverlay } from '@/components/ui/DetailOverlay';

export function BaederDashboardClient() {
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);

  const closeOverlay = () => setActiveOverlay(null);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 font-sans antialiased text-navy-900 min-h-screen bg-[#F0EBE0]">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-navy-900 mb-2 font-serif">Bäder und Chemie</h1>
        <p className="text-text-muted text-sm md:text-base">Zentrale für Galvanik-Bäder, Messwerte und Betriebsstoffe.</p>
      </header>

      {/* Bäder Kontrollbereich */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-navy-900 font-serif">Bad-Zentrale</h2>
          <span className="bg-accent-orange/10 text-accent-orange text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Demo / In Vorbereitung</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          
          {/* 1. Badstatus */}
          <button onClick={() => setActiveOverlay("bath_status")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-navy-900/10 rounded-xl flex items-center justify-center text-navy-900">
                  <Beaker className="w-6 h-6" />
                </div>
                <span className="text-2xl font-bold text-navy-900">12</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Badstatus Gesamt</h3>
              <p className="text-sm text-text-muted font-medium">Nickel, Chrom, Gold...</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Übersicht öffnen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 2. Kritische Bäder */}
          <button onClick={() => setActiveOverlay("critical_baths")} className="text-left bg-white rounded-2xl p-5 border border-error-red/20 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-error-red/10 rounded-xl flex items-center justify-center text-error-red">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <span className="text-2xl font-bold text-error-red">1</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Kritische Bäder</h3>
              <p className="text-sm text-error-red font-medium">Sofortiger Handlungsbedarf</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details prüfen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 3. Messplan heute */}
          <button onClick={() => setActiveOverlay("measurement_plan")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-kreile-yellow/20 rounded-xl flex items-center justify-center text-navy-900">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <span className="text-2xl font-bold text-navy-900">3</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Messplan heute</h3>
              <p className="text-sm text-text-muted font-medium">Anstehende Analysen</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Plan ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 4. Chemie und Bestand */}
          <button onClick={() => setActiveOverlay("chemicals_inventory")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[#107C41]/10 rounded-xl flex items-center justify-center text-[#107C41]">
                  <FlaskConical className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Chemie und Bestand</h3>
              <p className="text-sm text-text-muted font-medium">Elektrolyte, Zusätze, Säuren</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Bestände prüfen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 5. Metallverbrauch */}
          <button onClick={() => setActiveOverlay("metal_consumption")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-accent-orange/10 rounded-xl flex items-center justify-center text-accent-orange">
                  <TrendingDown className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Metallverbrauch</h3>
              <p className="text-sm text-text-muted font-medium">Hochrechnung und Logik</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Verbrauch zeigen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 6. Badkosten / Metallmarge */}
          <button onClick={() => setActiveOverlay("metal_margins")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-success-green/10 rounded-xl flex items-center justify-center text-success-green">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Kosten / Marge</h3>
              <p className="text-sm text-text-muted font-medium">Preis-Mengen-Vorbereitung</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Kalkulation ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 7. Sperrungen und Risiken */}
          <button onClick={() => setActiveOverlay("bath_locks")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer md:col-span-2 lg:col-span-3">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-neutral-gray-100 rounded-xl flex items-center justify-center text-navy-900">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold bg-neutral-gray-100 text-navy-900 px-3 py-1 rounded-full">Sicherheit</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Sperrungen und Betriebsrisiken</h3>
              <p className="text-sm text-text-muted font-medium">Verriegelte Anlagen und betroffene Aufträge.</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Sperrungen prüfen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

        </div>
      </div>

      {/* Detail Overlays */}
      
      {/* 1: Badstatus */}
      <DetailOverlay open={activeOverlay === "bath_status"} onClose={closeOverlay} title="Badstatus Übersicht" subtitle="Alle aktiven Anlagen und deren Grundzustand.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-warning-yellow/10 border border-warning-yellow/30 rounded-xl p-4 flex gap-3 mb-4">
            <Info className="w-5 h-5 text-warning-yellow shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-navy-900">Mockup-Ansicht</h4>
              <p className="text-sm text-text-muted">Echte Sensor-Livedaten fehlen. Dies ist eine Demo der künftigen Visualisierung.</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="bg-success-green/5 border border-success-green/20 p-4 rounded-xl">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold flex items-center gap-2"><Droplets className="w-4 h-4 text-success-green" /> Nickelbad (Bad 1)</h4>
                <span className="bg-success-green text-white text-xs px-2 py-1 rounded font-bold">Stabil</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm mt-3">
                <div className="bg-white p-2 rounded border border-neutral-gray-100 text-center"><span className="block text-text-muted text-[10px] uppercase">pH</span><span className="font-bold">4.2</span></div>
                <div className="bg-white p-2 rounded border border-neutral-gray-100 text-center"><span className="block text-text-muted text-[10px] uppercase">Temp</span><span className="font-bold">58°C</span></div>
                <div className="bg-white p-2 rounded border border-neutral-gray-100 text-center"><span className="block text-text-muted text-[10px] uppercase">Nickel</span><span className="font-bold">75g/L</span></div>
              </div>
            </div>

            <div className="bg-error-red/5 border border-error-red/20 p-4 rounded-xl">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold flex items-center gap-2"><Droplets className="w-4 h-4 text-error-red" /> Hartchrom (Bad 4)</h4>
                <span className="bg-error-red text-white text-xs px-2 py-1 rounded font-bold">Kritisch</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm mt-3">
                <div className="bg-error-red/10 p-2 rounded border border-error-red/20 text-center"><span className="block text-error-red text-[10px] uppercase">Sulfat</span><span className="font-bold text-error-red">1.5g/L</span></div>
                <div className="bg-white p-2 rounded border border-neutral-gray-100 text-center"><span className="block text-text-muted text-[10px] uppercase">Temp</span><span className="font-bold">55°C</span></div>
                <div className="bg-white p-2 rounded border border-neutral-gray-100 text-center"><span className="block text-text-muted text-[10px] uppercase">Chromsäure</span><span className="font-bold">250g/L</span></div>
              </div>
            </div>

            <div className="bg-accent-orange/5 border border-accent-orange/20 p-4 rounded-xl">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold flex items-center gap-2"><Droplets className="w-4 h-4 text-accent-orange" /> Entfettung (Vorbehandlung)</h4>
                <span className="bg-accent-orange text-white text-xs px-2 py-1 rounded font-bold">Beobachten</span>
              </div>
              <p className="text-sm text-text-muted mt-1">Standzeit bald erreicht, Schmutztragfähigkeit sinkt.</p>
            </div>
          </div>
        </div>
      </DetailOverlay>

      {/* 2: Kritische Bäder */}
      <DetailOverlay open={activeOverlay === "critical_baths"} onClose={closeOverlay} title="Kritische Bäder" subtitle="Anlagen mit sofortigem Handlungsbedarf.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-error-red/10 border border-error-red/20 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-error-red shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-error-red">Warnung: Badparameter verlassen Soll-Fenster</h4>
              <p className="text-sm text-error-red/80">Bei 1 Bad besteht akute Gefahr für die Schichtqualität.</p>
            </div>
          </div>
          
          <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200">
            <h4 className="font-bold text-navy-900 text-lg mb-2">Hartchrom (Bad 4)</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between"><span className="text-text-muted">Ursache:</span> <span className="font-bold text-error-red">Sulfat zu niedrig (Soll: 2.5 - 3.0 g/L)</span></li>
              <li className="flex justify-between"><span className="text-text-muted">Letzte Messung:</span> <span>Heute, 08:30 Uhr</span></li>
              <li className="flex justify-between"><span className="text-text-muted">Risiko:</span> <span>Schlechte Streuung, ungleichmäßige Deckung</span></li>
            </ul>
            
            <div className="mt-4 pt-4 border-t border-neutral-gray-200">
              <h5 className="font-bold mb-1">Empfohlene Maßnahme:</h5>
              <p className="text-sm">Zugabe von 120ml Schwefelsäure (H2SO4) zur Korrektur. Danach neue Analyse durchführen.</p>
            </div>
            
            <div className="mt-4 flex gap-2">
              <button className="bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-navy-800 w-full">Als dosiert markieren</button>
            </div>
          </div>
        </div>
      </DetailOverlay>

      {/* 3: Messplan heute */}
      <DetailOverlay open={activeOverlay === "measurement_plan"} onClose={closeOverlay} title="Messplan Heute" subtitle="Anstehende Laboranalysen nach Risiko priorisiert.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-white border border-neutral-gray-200 rounded-xl overflow-hidden">
            <div className="p-3 bg-navy-900 text-white font-bold text-sm">Labor-Agenda (Demo)</div>
            
            <div className="divide-y divide-neutral-gray-100">
              <div className="p-4 flex gap-4 relative bg-error-red/5">
                <div className="w-6 h-6 shrink-0 rounded-full bg-error-red text-white flex items-center justify-center font-bold text-xs mt-1">1</div>
                <div className="w-full">
                  <div className="flex justify-between">
                    <p className="font-bold">Hartchrom (Bad 4)</p>
                    <span className="text-xs bg-error-red text-white px-2 py-0.5 rounded">Kontrollmessung</span>
                  </div>
                  <p className="text-sm text-text-muted mt-1">Sulfat-Gehalt nach Dosierung überprüfen. Soll: 2.5g/L.</p>
                </div>
              </div>
              
              <div className="p-4 flex gap-4 relative">
                <div className="w-6 h-6 shrink-0 rounded-full bg-accent-orange text-white flex items-center justify-center font-bold text-xs mt-1">2</div>
                <div className="w-full">
                  <div className="flex justify-between">
                    <p className="font-bold">Goldbad (Bad 7)</p>
                    <span className="text-xs bg-neutral-gray-200 text-navy-900 px-2 py-0.5 rounded">Wöchentlich</span>
                  </div>
                  <p className="text-sm text-text-muted mt-1">Gold-Gehalt analysieren. Letzter Wert: 3.8g/L.</p>
                </div>
              </div>

              <div className="p-4 flex gap-4 relative">
                <div className="w-6 h-6 shrink-0 rounded-full bg-navy-900 text-white flex items-center justify-center font-bold text-xs mt-1">3</div>
                <div className="w-full">
                  <div className="flex justify-between">
                    <p className="font-bold">Kupfer (Bad 2)</p>
                    <span className="text-xs bg-neutral-gray-200 text-navy-900 px-2 py-0.5 rounded">Routine</span>
                  </div>
                  <p className="text-sm text-text-muted mt-1">Säuregehalt (Schwefelsäure). Soll: 60-80g/L.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DetailOverlay>

      {/* 4: Chemie und Bestand */}
      <DetailOverlay open={activeOverlay === "chemicals_inventory"} onClose={closeOverlay} title="Chemie und Bestand" subtitle="Verfügbare Vorräte und Reichweite.">
        <div className="space-y-6 text-navy-900">
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Kritische Bestände</h4>
            <div className="bg-error-red/10 border border-error-red/20 rounded-xl p-4 flex items-start gap-3 mb-4">
              <FlaskConical className="w-5 h-5 text-error-red shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-error-red">Natriumcyanid (NaCN)</p>
                <p className="text-sm text-error-red/80 mt-1">Bestand: 5 kg (Minimum: 10 kg). Wird in Kupfer-Cyanid und Silber-Bädern benötigt.</p>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Stabile Bestände (Auszug)</h4>
            <ul className="space-y-2">
              <li className="bg-bg-app-soft p-3 rounded-lg flex justify-between items-center border border-neutral-gray-100">
                <div><p className="font-bold">Nickelsulfat</p><p className="text-xs text-text-muted">Für Bad 1</p></div>
                <span className="text-sm font-bold text-success-green">250 kg</span>
              </li>
              <li className="bg-bg-app-soft p-3 rounded-lg flex justify-between items-center border border-neutral-gray-100">
                <div><p className="font-bold">Schwefelsäure (96%)</p><p className="text-xs text-text-muted">Universal</p></div>
                <span className="text-sm font-bold text-success-green">400 L</span>
              </li>
              <li className="bg-bg-app-soft p-3 rounded-lg flex justify-between items-center border border-neutral-gray-100">
                <div><p className="font-bold">Glanzzusatz CU-200</p><p className="text-xs text-text-muted">Für sauer Kupfer</p></div>
                <span className="text-sm font-bold text-navy-900">25 L</span>
              </li>
            </ul>
          </div>
          
          <div className="pt-4 border-t border-neutral-gray-200 flex justify-end">
            <Link href="/items" className="bg-navy-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-navy-800 transition-colors flex items-center gap-2">
              Zum Inventar <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </DetailOverlay>

      {/* 5: Metallverbrauch */}
      <DetailOverlay open={activeOverlay === "metal_consumption"} onClose={closeOverlay} title="Metallverbrauch" subtitle="Theoretischer Verbrauch nach Schichtdicke.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-warning-yellow/10 border border-warning-yellow/30 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-warning-yellow shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-navy-900">Demo / Noch nicht angebunden</h4>
              <p className="text-sm text-text-muted">Die Live-Hochrechnung aus den Produktionsdaten ist im Aufbau.</p>
            </div>
          </div>
          
          <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200">
            <h4 className="font-bold mb-2">Rechenlogik der App:</h4>
            <p className="text-sm font-mono bg-white p-2 rounded border border-neutral-gray-200">Fläche (dm²) × Schichtdicke (µm) × Dichte (g/cm³) = Masse (g)</p>
            <p className="text-xs text-text-muted mt-2">Das System summiert diesen Wert für alle abgeschlossenen Aufträge des Monats.</p>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Geschätzter Verbrauch (Letzte 30 Tage)</h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center"><span className="text-text-muted">Gold (Au)</span><span className="font-bold">125 g</span></div>
              <div className="flex justify-between items-center"><span className="text-text-muted">Silber (Ag)</span><span className="font-bold">2.4 kg</span></div>
              <div className="flex justify-between items-center"><span className="text-text-muted">Nickel (Ni)</span><span className="font-bold">85.0 kg</span></div>
              <div className="flex justify-between items-center"><span className="text-text-muted">Kupfer (Cu)</span><span className="font-bold">110.0 kg</span></div>
            </div>
          </div>
        </div>
      </DetailOverlay>

      {/* 6: Badkosten / Metallmarge */}
      <DetailOverlay open={activeOverlay === "metal_margins"} onClose={closeOverlay} title="Badkosten und Marge" subtitle="Vorbereitung für finanzielle Performance-Rechnung.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-success-green/10 border border-success-green/20 rounded-xl p-4">
            <h4 className="font-bold text-success-green mb-1">Preis-/Mengenlogik vorbereitet</h4>
            <p className="text-sm text-success-green/80">Die mathematische Grundlage zur Echtzeit-Kalkulation der Margen ist integriert. Live-Börsenkurse (LME) folgen in einem späteren Release.</p>
          </div>
          
          <div className="bg-white border border-neutral-gray-200 rounded-xl overflow-hidden">
            <div className="p-3 bg-navy-900 text-white font-bold text-sm">Beispiel-Kalkulation (Gold)</div>
            <div className="p-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-text-muted">Einkaufsbasis (Elektrolyt):</span> <span>65.00 € / g</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Tagespreis (Demo):</span> <span>68.50 € / g</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Theoretischer Verbrauch (Auftrag X):</span> <span>0.5 g</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Materialkosten (Verbrauch):</span> <span className="text-error-red">32.50 €</span></div>
              <div className="flex justify-between pt-2 border-t border-neutral-gray-100 font-bold"><span className="text-navy-900">Berechneter Preis (Kunde):</span> <span className="text-success-green">85.00 €</span></div>
              <div className="flex justify-between font-bold"><span className="text-navy-900">Deckungsbeitrag (Material):</span> <span className="text-success-green">52.50 €</span></div>
            </div>
          </div>
        </div>
      </DetailOverlay>

      {/* 7: Sperrungen und Risiken */}
      <DetailOverlay open={activeOverlay === "bath_locks"} onClose={closeOverlay} title="Sperrungen und Risiken" subtitle="Anlagen, die derzeit nicht für die Produktion freigegeben sind.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-bg-app-soft p-5 rounded-xl border border-neutral-gray-200 text-center">
            <CheckCircle2 className="w-12 h-12 text-success-green mx-auto mb-3" />
            <h4 className="font-bold text-xl text-navy-900 mb-1">Keine Sperrungen</h4>
            <p className="text-sm text-text-muted">Aktuell sind alle Anlagen für die Produktion freigegeben.</p>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Wie Sperrungen funktionieren (Info)</h4>
            <p className="text-sm text-text-muted mb-2">Wenn ein Bad im Labor auf "Gesperrt" gesetzt wird:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-text-muted">
              <li>Kann in der App kein Auftrag auf diese Station gebucht werden.</li>
              <li>Werden Mitarbeiter beim Scannen eines Laufszettels gewarnt.</li>
              <li>Wird eine Warnung auf dem Warendurchlauf-Dashboard angezeigt.</li>
            </ul>
          </div>
        </div>
      </DetailOverlay>

      <FeedbackFooter pageTitle="Bäder" route="/baeder" variant="full" />
    </div>
  );
}
