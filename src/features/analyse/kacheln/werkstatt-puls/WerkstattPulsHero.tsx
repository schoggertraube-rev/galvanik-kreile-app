import React from 'react';
import { WerkstattPulsData } from '@/lib/analyse/dataContracts';

interface Props {
  data: WerkstattPulsData;
}

export function WerkstattPulsHero({ data }: Props) {
  const { hero } = data;

  return (
    <div className="hero">
      <div className="hero-kpis">
        {/* Termintreue */}
        <div>
          <div className="kpi-label">Termintreue</div>
          {hero.termintreuePct !== null ? (
            <>
              <div>
                <span className={`kpi-value ${hero.termintreuePct < 80 ? 'bad' : hero.termintreuePct < 90 ? 'warn' : ''}`}>
                  {hero.termintreuePct}
                </span>
                <span className="kpi-unit">%</span>
              </div>
              <div className="kpi-trend">
                Aus {hero.termintreueMessbarN} abgeschl. Aufträgen
              </div>
              {hero.ohneZusageterminN > 0 && (
                <div className="kpi-trend trend-down" style={{ marginTop: 4 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="0,2 10,2 5,9" fill="currentColor"/></svg>
                  {hero.ohneZusageterminN} ohne Termin
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              {hero.completedOrdersN > 0 ? 'Nicht messbar: abgeschlossene Aufträge ohne Kundenzusage' : 'Nicht messbar: keine abgeschlossenen Aufträge im Zeitraum'}
            </div>
          )}
        </div>

        {/* DLZ */}
        <div>
          <div className="kpi-label">Ø Durchlaufzeit</div>
          {hero.avgDurchlaufzeitTage !== null ? (
            <>
              <div>
                <span className={`kpi-value ${hero.avgDurchlaufzeitTage > 10 ? 'bad' : hero.avgDurchlaufzeitTage > 7 ? 'warn' : ''}`}>
                  {hero.avgDurchlaufzeitTage}
                </span>
                <span className="kpi-unit">T</span>
              </div>
              <div className="kpi-trend">
                Basierend auf {hero.avgDurchlaufzeitMessbarN} Aufträgen
              </div>
            </>
          ) : (
             <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
               {hero.completedOrdersN > 0
                 ? 'Nicht messbar: bestätigte Eingangszeit fehlt'
                 : 'Bestätigt leer: keine Abschlüsse im Zeitraum'}
             </div>
          )}
        </div>

        {/* Abschlüsse */}
        <div>
          <div className="kpi-label">Abgeschlossen im Zeitraum</div>
          <div>
            <span className="kpi-value">{hero.completedOrdersN}</span>
          </div>
          <div className="kpi-trend">Abschlussdatum liegt im gewählten Zeitraum</div>
        </div>

        {/* Offene */}
        <div>
          <div className="kpi-label">Aktuell überfällige Aufträge</div>
          <div><span className={`kpi-value ${hero.overdueOrdersN > 0 ? 'bad' : ''}`}>{hero.overdueOrdersN}</span></div>
          <div className="kpi-trend">Von {hero.offeneAuftraegeN} aktuell offenen Aufträgen</div>
        </div>

        {/* Dokumentation */}
        <div>
          <div className="kpi-label">Dokumentation</div>
          {hero.dokumentationsquotePct !== null ? (
            <>
              <div><span className="kpi-value" style={{ color: 'var(--green)' }}>{hero.dokumentationsquotePct}</span><span className="kpi-unit">%</span></div>
            </>
          ) : (
             <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Noch keine Messung</div>
          )}
        </div>
      </div>

    </div>
  );
}
