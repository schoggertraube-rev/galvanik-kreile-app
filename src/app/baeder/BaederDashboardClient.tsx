"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";

import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Beaker, AlertTriangle, CalendarDays, FlaskConical, 
  TrendingDown, DollarSign, ShieldAlert, ArrowRight, Info
} from 'lucide-react';
import { DetailOverlay } from '@/components/ui/DetailOverlay';
import type { BaederOverviewItem } from './actions';

interface Props {
  baederData?: BaederOverviewItem[];
  loadError?: string | null;
}

export function BaederDashboardClient({ baederData = [], loadError = null }: Props) {
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);

  const baederCount = baederData.length;
  const kritischeCount = baederData.filter((bath) => bath.status === "critical").length;
  const messungenCount = baederData.reduce((acc, b) => acc + (b.messwerte?.length || 0), 0);

  const closeOverlay = () => setActiveOverlay(null);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 font-sans antialiased text-navy-900 min-h-screen bg-[#F0EBE0]">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Baeder',href:'/baeder'}]} />
        <BackButton label="Home" href="/" />
      </div>
      
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-navy-900 mb-2 font-serif">Bäder und Chemie</h1>
        <p className="text-text-muted text-sm md:text-base">Zentrale für Galvanik-Bäder, Messwerte und Betriebsstoffe.</p>
      </header>

      {loadError && (
        <div role="alert" className="mb-6 rounded-xl border border-error-red/30 bg-error-red/10 p-4 text-sm font-medium text-error-red">
          Baddaten konnten nicht geladen werden: {loadError}
        </div>
      )}

      {/* Bäder Kontrollbereich */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-navy-900 font-serif">Bad-Zentrale</h2>
          <span className="bg-accent-orange/10 text-accent-orange text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            {loadError ? "Daten nicht verfÃ¼gbar" : "Persistierte Daten"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          
          {/* 1. Badstatus */}
          <button onClick={() => setActiveOverlay("bath_status")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-navy-900/10 rounded-xl flex items-center justify-center text-navy-900">
                  <Beaker className="w-6 h-6" />
                </div>
                <span className="text-2xl font-bold text-navy-900">{baederCount}</span>
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
                <span className="text-2xl font-bold text-error-red">{kritischeCount}</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Kritische Bäder</h3>
              <p className="text-sm text-error-red font-medium">Sofortiger Handlungsbedarf</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details prüfen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 3. Persistierte Messhistorie */}
          <button onClick={() => setActiveOverlay("measurement_plan")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-kreile-yellow/20 rounded-xl flex items-center justify-center text-navy-900">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <span className="text-2xl font-bold text-navy-900">{messungenCount}</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Messhistorie</h3>
              <p className="text-sm text-text-muted font-medium">Persistierte Messungen</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Historie ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 4. Chemie und Bestand */}
          <Link href="/lager" className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
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
          </Link>

          {/* 5. Metallverbrauch */}
          <button disabled title="Metallverbrauch ist noch nicht belastbar instrumentiert" className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between opacity-70 cursor-not-allowed">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-accent-orange/10 rounded-xl flex items-center justify-center text-accent-orange">
                  <TrendingDown className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Metallverbrauch</h3>
              <p className="text-sm text-text-muted font-medium">Noch nicht belastbar instrumentiert</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Auswertung deaktiviert
            </div>
          </button>

          {/* 6. Badkosten / Metallmarge */}
          <button disabled title="Badkosten und Metallmarge sind noch nicht belastbar instrumentiert" className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between opacity-70 cursor-not-allowed">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-success-green/10 rounded-xl flex items-center justify-center text-success-green">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Kosten / Marge</h3>
              <p className="text-sm text-text-muted font-medium">Noch nicht belastbar instrumentiert</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Auswertung deaktiviert
            </div>
          </button>

          {/* 7. Sperrungen und Risiken */}
          <button disabled title="Badsperren sind noch nicht an eine persistierte Verriegelungslogik angebunden" className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between opacity-70 cursor-not-allowed md:col-span-2 lg:col-span-3">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-neutral-gray-100 rounded-xl flex items-center justify-center text-navy-900">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold bg-neutral-gray-100 text-navy-900 px-3 py-1 rounded-full">Sicherheit</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Sperrungen und Betriebsrisiken</h3>
              <p className="text-sm text-text-muted font-medium">Persistierte Verriegelungslogik fehlt noch.</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Funktion deaktiviert
            </div>
          </button>

        </div>
      </div>

      {/* Detail Overlays */}
      
      {/* 1: Badstatus */}
      <DetailOverlay open={activeOverlay === "bath_status"} onClose={closeOverlay} title="Badstatus Gesamt" subtitle="Übersicht aller galvanischen Bäder.">
    <div className="space-y-6 text-navy-900">
      <div className="bg-neutral-gray-100 border border-neutral-gray-200 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-navy-900">Aktuelle Bäder: {baederCount}</h4>
          <p className="text-sm text-text-muted">{baederCount === 0 ? "Noch keine Bäder angelegt." : "Alle Bäder aus der Datenbank."}</p>
        </div>
      </div>
      {baederCount > 0 && (
        <ul className="space-y-3">
          {baederData.map((b) => (
             <li key={b.id} className="bg-white p-3 rounded-lg border border-neutral-gray-100">
               <p className="font-bold">{b.name} <span className="text-xs text-text-muted ml-2">Status: {b.status}</span></p>
             </li>
          ))}
        </ul>
      )}
    </div>
  </DetailOverlay>

      {/* 2: Kritische Bäder */}
      <DetailOverlay open={activeOverlay === "critical_baths"} onClose={closeOverlay} title="Kritische Bäder" subtitle="Bäder mit sofortigem Handlungsbedarf.">
    <div className="space-y-6 text-navy-900">
      <div className="bg-neutral-gray-100 border border-neutral-gray-200 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-navy-900">Warnung / Kritisch: {kritischeCount}</h4>
          <p className="text-sm text-text-muted">{kritischeCount === 0 ? "Keine Bäder in kritischem Zustand." : "Bitte sofort prüfen!"}</p>
        </div>
      </div>
    </div>
  </DetailOverlay>

      {/* 3: Messplan heute */}
      <DetailOverlay open={activeOverlay === "measurement_plan"} onClose={closeOverlay} title="Messplan" subtitle="Historie der Bad-Messungen.">
    <div className="space-y-6 text-navy-900">
      <div className="bg-neutral-gray-100 border border-neutral-gray-200 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-navy-900">Anzahl Messungen: {messungenCount}</h4>
          <p className="text-sm text-text-muted">{messungenCount === 0 ? "Noch keine Messwerte erfasst." : "Die letzten Messwerte aus der Datenbank."}</p>
        </div>
      </div>
    </div>
  </DetailOverlay>

      {/* 4: Chemie und Bestand */}
      <DetailOverlay open={activeOverlay === "chemicals_inventory"} onClose={closeOverlay} title="Chemiebestand" subtitle="Kritische Bestände im Chemielager.">
    <div className="space-y-6 text-navy-900">
      <div className="bg-neutral-gray-100 border border-neutral-gray-200 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-navy-900">Keine Daten</h4>
          <p className="text-sm text-text-muted">Chemiebestand wird aus dem Lagermodul bezogen.</p>
        </div>
      </div>
    </div>
  </DetailOverlay>

      {/* 5: Metallverbrauch */}
      <DetailOverlay open={activeOverlay === "metal_consumption"} onClose={closeOverlay} title="Metallverbrauch" subtitle="Übersicht über den Metallverbrauch.">
    <div className="space-y-6 text-navy-900">
      <div className="bg-neutral-gray-100 border border-neutral-gray-200 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-navy-900">Keine Daten</h4>
          <p className="text-sm text-text-muted">Keine belastbare Verbrauchsbuchung vorhanden; Auswertung deaktiviert.</p>
        </div>
      </div>
    </div>
  </DetailOverlay>

      {/* 6: Badkosten / Metallmarge */}
      <DetailOverlay open={activeOverlay === "metal_margins"} onClose={closeOverlay} title="Edelmetall Margen" subtitle="Aktuelle Edelmetall Margen.">
    <div className="space-y-6 text-navy-900">
      <div className="bg-neutral-gray-100 border border-neutral-gray-200 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-navy-900">Keine Daten</h4>
          <p className="text-sm text-text-muted">Keine belastbare Kosten- oder Margenbasis vorhanden; Auswertung deaktiviert.</p>
        </div>
      </div>
    </div>
  </DetailOverlay>

      {/* 7: Sperrungen und Risiken */}
      <DetailOverlay open={activeOverlay === "bath_locks"} onClose={closeOverlay} title="Sperrungen" subtitle="Aktuell gesperrte Bäder.">
    <div className="space-y-6 text-navy-900">
      <div className="bg-neutral-gray-100 border border-neutral-gray-200 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-navy-900">Keine Daten</h4>
          <p className="text-sm text-text-muted">Sperrstatus ist noch nicht persistiert; Funktion deaktiviert.</p>
        </div>
      </div>
    </div>
  </DetailOverlay>

      <FeedbackFooter pageTitle="Bäder" route="/baeder" variant="full" />
    </div>
  );
}
