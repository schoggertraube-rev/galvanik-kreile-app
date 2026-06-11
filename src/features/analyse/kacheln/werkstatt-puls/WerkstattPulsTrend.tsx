import React from 'react';
import { WerkstattPulsData } from '@/lib/analyse/dataContracts';

interface Props {
  data: WerkstattPulsData;
}

export function WerkstattPulsTrend({ data }: Props) {
  const { trend } = data;

  // We are currently returning an empty state for trend as per spec 
  // since kpi_snapshots are not yet implemented.
  
  return (
    <div className="card">
      <div className="card-h">
        <h3>Trend (Verlauf)</h3>
      </div>
      <div className="card-body">
        <div className="chart-frame" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>Noch kein Verlauf verfügbar</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', maxWidth: 300, margin: '0 auto' }}>
            {trend.comparison?.reasonIfMissing || "Für einen Wochenverlauf werden mindestens zwei auswertbare Wochen benötigt."}
          </div>
        </div>
      </div>
    </div>
  );
}
