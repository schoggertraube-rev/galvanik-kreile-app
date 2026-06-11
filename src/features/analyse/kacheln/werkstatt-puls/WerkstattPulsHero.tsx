import React from 'react';
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
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Nicht messbar (Keine fertigen Aufträge)</div>
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

      {/* Score-Ring */}
      <div className="score-ring">
        <svg viewBox="0 0 120 120">
          <defs>
            <linearGradient id="ringG" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7A3FB0"/>
              <stop offset="60%" stopColor="#C2185B"/>
              <stop offset="100%" stopColor="#F2643C"/>
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="50" fill="none" stroke="#F0E6D3" strokeWidth="9"/>
          {hero.werkstattScore !== null && (
            <circle cx="60" cy="60" r="50" fill="none" stroke="url(#ringG)" strokeWidth="9"
              strokeDasharray="314" strokeDashoffset={314 - (314 * hero.werkstattScore) / 100} strokeLinecap="round"/>
          )}
        </svg>
        <div className="score-num">
          {hero.werkstattScore !== null ? (
            <>{hero.werkstattScore}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-3)' }}>/100</span></>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>N/A</span>
          )}
        </div>
        <div className="score-label">Werkstatt-Score</div>
      </div>
    </div>
  );
}
