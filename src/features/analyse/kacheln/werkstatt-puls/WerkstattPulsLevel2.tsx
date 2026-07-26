import React from 'react';
import { ArrowLeft } from 'lucide-react';
import './WerkstattPulsLevel2.css';
import { WerkstattPulsData } from '@/lib/analyse/dataContracts';
import type { ClaimEvidenceV1 } from '@/lib/analytics/evidenceContract';
import { WerkstattPulsHero } from './WerkstattPulsHero';
import { WerkstattPulsInsightBox } from './WerkstattPulsInsightBox';
import { WerkstattPulsTrend } from './WerkstattPulsTrend';
import { WerkstattPulsStationArena } from './WerkstattPulsStationArena';
import { WerkstattPulsOrdersTable } from './WerkstattPulsOrdersTable';
import { WerkstattPulsEconomics } from './WerkstattPulsEconomics';
import { WerkstattPulsFooter } from './WerkstattPulsFooter';

interface Props {
  data: WerkstattPulsData;
  evidence: ClaimEvidenceV1[];
  onClose: () => void;
}

export function WerkstattPulsLevel2({ data, evidence, onClose }: Props) {
  const periodLabel = data.period === 'today' ? 'Heute' : data.period === 'week' ? 'Woche' : data.period === 'month' ? 'Monat' : 'Freier Zeitraum';
  return (
    <div className="page" style={{ paddingTop: 0 }} data-evidence-claims={evidence.length}>
      {/* BACK BUTTON */}
      <div style={{ marginBottom: 24, marginTop: 12 }}>
        <button onClick={onClose} className="flex items-center gap-2 text-[var(--ink-2)] hover:text-[var(--magenta)] transition-colors text-sm font-semibold">
          <ArrowLeft className="w-4 h-4" />
          Zurück zur Analyse-Übersicht
        </button>
      </div>

      {/* HEADER */}
      <div className="header-row">
        <div className="title-block">
          <div className="title-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h4l3-9 4 18 3-9h4"/>
            </svg>
          </div>
          <div>
            <h1 className="wp-h1">Werkstatt-Puls</h1>
            <div className="subtitle">
              Durchsatz · Stationen · Wochenziel 
              {data.dataStatus.lastUpdatedAt && ` — Datenstand ${new Date(data.dataStatus.lastUpdatedAt).toLocaleString('de-DE')}`}
            </div>
          </div>
        </div>
        <div className="controls">
          <span className="pill pill-mute">Zeitraum: {periodLabel}</span>
          <span className="pill pill-mute">
            {data.trend.comparison?.available ? 'Vergleichsdaten gespeichert' : 'Kein Vergleichsdatensatz'}
          </span>
          {data.hero.scoreStatus === 'critical' && <span className="pill pill-bad">HANDLUNGSBEDARF</span>}
          {data.hero.scoreStatus === 'watch' && <span className="pill pill-warn">BEOBACHTEN</span>}
          {data.hero.scoreStatus === 'ok' && <span className="pill pill-ok">OK</span>}
          {data.hero.scoreStatus === 'insufficient_data' && <span className="pill pill-mute">DATEN FEHLEN</span>}
        </div>
      </div>

      <WerkstattPulsHero data={data} />
      <WerkstattPulsInsightBox data={data} />
      
      <div className="grid-2">
        <WerkstattPulsTrend data={data} />
        {/* Engpass-Ranking is integrated in StationArena logically, but visually placed next to Trend in HTML. Let's extract it. */}
        <WerkstattPulsStationArena.Ranking data={data} />
      </div>

      <WerkstattPulsStationArena.Cards data={data} />
      <WerkstattPulsOrdersTable data={data} />
      <WerkstattPulsEconomics data={data} />
      <WerkstattPulsFooter data={data} />
    </div>
  );
}
