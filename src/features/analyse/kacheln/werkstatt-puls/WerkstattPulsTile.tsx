"use client";
import React, { useState } from 'react';
import { KachelShell } from '../../components/KachelShell';
import { useWerkstattPuls } from '../../hooks/useWerkstattPuls';
import { KpiMiniCard } from '../../components/KpiMiniCard';
import { WerkstattPulsOverlay } from './WerkstattPulsOverlay';

export const WerkstattPulsTile: React.FC = () => {
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const { data, isLoading, error } = useWerkstattPuls();

  if (isLoading) {
    return <div className="h-48 bg-gray-100 animate-pulse rounded-xl"></div>;
  }

  if (error || !data) {
    return <div className="h-48 bg-red-50 text-red-500 rounded-xl p-6">Fehler beim Laden der Daten.</div>;
  }

  const { termintreue, durchlauf, wochenziel, snapshotTrend } = data;

  const wochenzielSoll = 25; // TODO: configurable
  const wochenzielIst = wochenziel.fertig_diese_woche;
  const wochenzielPct = wochenzielSoll > 0 ? Math.min(100, Math.round((wochenzielIst / wochenzielSoll) * 100)) : 0;

  // Determine status
  let status: 'STABIL' | 'BEOBACHTEN' | 'HANDLUNGSBEDARF' = 'STABIL';
  if (termintreue.termintreue_pct !== null) {
    if (termintreue.termintreue_pct < 80) status = 'HANDLUNGSBEDARF';
    else if (termintreue.termintreue_pct < 90) status = 'BEOBACHTEN';
  } else {
    status = 'STABIL';
  }

  // Station colors based on engpass (simplified for MVP: top 2 get red/yellow if any)
  const stationNames = ['Schleifen', 'Politur', 'Galvanik', 'Vorbeh.', 'QK/Vers.'];

  const termintreueDiff = snapshotTrend?.vorjahr !== undefined && termintreue.termintreue_pct !== null
    ? termintreue.termintreue_pct - snapshotTrend.vorjahr
    : null;

  return (
    <>
      <KachelShell
        title="Werkstatt-Puls"
        subtitle="Durchsatz · Stationen · Wochenziel"
        status={status}
        onClick={() => setIsOverlayOpen(true)}
      >
        <div className="grid grid-cols-3 gap-4 mb-6">
          <KpiMiniCard 
            label="Termintreue" 
            value={termintreue.termintreue_pct !== null ? `${termintreue.termintreue_pct} %` : '–'} 
            subValue={termintreueDiff !== null ? `${Math.abs(termintreueDiff)} Pkt. vs. Vj` : 'Vorjahr: wird aufgebaut'}
            trend={termintreueDiff !== null ? (termintreueDiff >= 0 ? 'up' : 'down') : 'neutral'}
          />
          <KpiMiniCard 
            label="Ø Durchlaufzeit" 
            value={durchlauf.avg_tage ? `${durchlauf.avg_tage} T` : '–'} 
            subValue="Vorjahr: wird aufgebaut"
            trend="neutral"
          />
          <div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 block">Wochenziel</span>
            <span className="text-2xl font-bold text-gray-900">{wochenzielIst} / {wochenzielSoll}</span>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${wochenzielPct}%` }}></div>
            </div>
            <span className="text-xs text-gray-500 mt-1 block">{wochenzielPct}%</span>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-medium text-gray-500">
          {stationNames.map((name, i) => (
            <React.Fragment key={name}>
              <span className={i === 2 ? 'text-red-500 font-bold' : ''}>{name}</span>
              {i < stationNames.length - 1 && <span className="text-gray-300">···</span>}
            </React.Fragment>
          ))}
        </div>
      </KachelShell>

      <WerkstattPulsOverlay 
        isOpen={isOverlayOpen} 
        onClose={() => setIsOverlayOpen(false)} 
        data={data}
      />
    </>
  );
};
