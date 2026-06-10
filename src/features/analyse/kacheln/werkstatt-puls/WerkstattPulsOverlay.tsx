"use client";
import React, { useState } from 'react';
import { OverlayShell } from '../../components/OverlayShell';
import { WerkstattPulsData } from '../../hooks/useWerkstattPuls';
import { StationDurchlaufList } from './StationDurchlaufList';
import { TermintreueChart } from './TermintreueChart';
import { KiEinschaetzung } from '../../components/KiEinschaetzung';
import { useKiInsight } from '../../hooks/useKiInsight';

interface WerkstattPulsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  data: WerkstattPulsData;
}

export const WerkstattPulsOverlay: React.FC<WerkstattPulsOverlayProps> = ({ isOpen, onClose, data }) => {
  const [activeTab, setActiveTab] = useState<'Tag' | 'Woche' | 'Monat' | 'Quartal'>('Woche');
  
  const { termintreue, durchlauf, stationen, engpass, wochenziel, snapshotTrend } = data;

  const schwachsteStation = stationen.length > 0 
    ? [...stationen].sort((a, b) => b.avg_tage - a.avg_tage)[0].station 
    : 'Keine';

  const teileImStau = engpass.length > 0 
    ? engpass.reduce((acc, curr) => acc + curr.teile_wartend, 0)
    : 0;

  const kiQueryData = {
    termintreue_pct: termintreue.termintreue_pct,
    trend_vorjahr: snapshotTrend?.vorjahr ?? null,
    durchlaufzeit_avg: durchlauf.avg_tage,
    schwachste_station: schwachsteStation,
    teile_im_stau: teileImStau,
    wochenziel_ist: wochenziel.fertig_diese_woche,
    wochenziel_soll: 25 // Configurable later
  };

  const { data: kiData, isLoading: kiLoading, error: kiError } = useKiInsight('werkstatt-puls', kiQueryData);

  return (
    <OverlayShell isOpen={isOpen} onClose={onClose} title="Werkstatt-Puls">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {['Tag', 'Woche', 'Monat', 'Quartal'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        {/* Section A: Hero */}
        <section className="text-center space-y-4 py-4">
          <h3 className="text-sm font-bold tracking-widest text-gray-500 uppercase">Wie pünktlich lieferst du?</h3>
          <div className="text-6xl font-black text-gray-900">
            {termintreue.termintreue_pct !== null ? `${termintreue.termintreue_pct}%` : '–'}
          </div>
          {snapshotTrend && snapshotTrend.vorjahr !== null && (
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
              ▼ {termintreue.termintreue_pct !== null ? termintreue.termintreue_pct - snapshotTrend.vorjahr : '-'} Pkt. vs Vorjahr
            </div>
          )}
          <p className="text-sm text-gray-500">Tendenz fallend seit 2 Wochen</p>
        </section>

        {/* Section B: Chart */}
        <section className="space-y-4">
          <h3 className="font-semibold text-gray-900">Termintreue im Zeitverlauf</h3>
          <TermintreueChart currentWeekPct={termintreue.termintreue_pct} />
          <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg flex items-start gap-3">
            <span className="text-xl">💡</span>
            <p><strong>So liest du das:</strong> Die blaue Fläche zeigt deine Pünktlichkeit diese Woche. Die gestrichelte Linie ist der Vergleichswert aus dem Vorjahr. Werte unter 80% bedeuten meist, dass Teile in einer Station zu lange liegen.</p>
          </div>
        </section>

        {/* Section C: Stations */}
        <section className="space-y-4">
          <h3 className="font-semibold text-gray-900">Durchlaufzeit pro Station</h3>
          <StationDurchlaufList stationen={stationen} />
        </section>

        {/* Section D: KI */}
        <section className="space-y-4">
          <KiEinschaetzung isLoading={kiLoading} error={kiError} data={kiData} />
        </section>
      </div>
    </OverlayShell>
  );
};
