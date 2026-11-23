import React from 'react';
import { WERKSTATT_PULS_COPY } from '@/ui/situationCatalog';
import { WerkstattPulsData } from '@/lib/analyse/dataContracts';

interface Props {
  data: WerkstattPulsData;
}

export function WerkstattPulsHero({ data }: Props) {
  const { hero } = data;

  const wochenzielPct = (hero.wochenzielSoll && hero.wochenzielIst !== null)
    ? Math.min(100, Math.round((hero.wochenzielIst / hero.wochenzielSoll) * 100))
    : 0;

  return (
    <div className="hero">
      <div className="hero-kpis">
        {/* Termintreue */}
        <div>
          <div className="kpi-label">Termintreue</div>
          {hero.termintreuePct !== null ? (
            <>
              <div>
                <span className="kpi-value">
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
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{WERKSTATT_PULS_COPY.fehlt}</div>
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
             <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Keine fertigen Aufträge</div>
          )}
        </div>

        {/* Wochenziel */}
        <div>
          <div className="kpi-label">Wochenziel</div>
          {hero.wochenzielSoll ? (
            <>
              <div>
                <span className="kpi-value">{hero.wochenzielIst}</span>
                <span className="kpi-unit"> / {hero.wochenzielSoll}</span>
              </div>
              <div className="kpi-trend">{hero.wochenzielSoll - (hero.wochenzielIst || 0)} fehlen</div>
              <div className="progress" style={{ marginTop: 14 }}>
                <div style={{ width: `${wochenzielPct}%`, background: 'linear-gradient(90deg,#1F8079,#16A34A)' }}></div>
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="kpi-value">{hero.wochenzielIst}</span>
              </div>
              <div className="kpi-trend">Diese Woche fertig</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 14 }}>Ziel nicht konfiguriert</div>
            </>
          )}
        </div>

        {/* Offene */}
        <div>
          <div className="kpi-label">Kritische Aufträge</div>
          <div><span className={`kpi-value ${hero.kritischeAuftraegeN > 0 ? 'bad' : ''}`}>{hero.kritischeAuftraegeN}</span></div>
          <div className="kpi-trend">davon {hero.kritischeAuftraegeN} verspätet</div>
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
