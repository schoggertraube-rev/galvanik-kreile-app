import React from 'react';
import { WerkstattPulsData } from '@/lib/analyse/dataContracts';

interface Props {
  data: WerkstattPulsData;
}

export const WerkstattPulsStationArena = {
  Ranking: ({ data }: Props) => {
    const { stations } = data;
    
    // Sort by engpassScore desc, limit to top 5
    const ranked = [...stations].sort((a, b) => (b.engpassScore || 0) - (a.engpassScore || 0)).slice(0, 5);

    return (
      <div className="card">
        <div className="card-h">
          <h3>Engpass-Ranking</h3>
          <span className="pill pill-mute" style={{ fontSize: 10 }}>Engpass-Score</span>
        </div>
        <div className="card-body" style={{ paddingTop: 8 }}>
          {ranked.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              Keine Stationen aktiv.
            </div>
          ) : (
            ranked.map((st, idx) => {
              const isR1 = idx === 0 && st.status === 'critical';
              const isR2 = idx === 1 && st.status === 'watch';
              const rowClass = `rank-row ${isR1 ? 'r1' : ''} ${isR2 ? 'r2' : ''}`;
              
              const barColor = st.status === 'critical' ? 'var(--red)' : 
                               st.status === 'watch' ? 'var(--amber)' : 
                               st.status === 'ok' ? 'var(--green)' : '#9CB8B4';

              return (
                <div key={st.stationId} className={rowClass}>
                  <div className="rank-num">{idx + 1}</div>
                  <div className="rank-bar-cell">
                    <div className="rank-name">{st.stationName}</div>
                    <div className="rank-bar">
                      <div style={{ width: `${st.auslastungPct || 0}%`, background: barColor }}></div>
                    </div>
                    <div className="rank-meta">
                      {st.auslastungPct}% Auslastung · {st.wartendN} wartend · Ø {st.avgWartezeitTage} T
                    </div>
                  </div>
                  <div className="rank-score">{st.engpassScore}</div>
                  <div style={{ marginLeft: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9099A8" strokeWidth="2"><path d="M9 6l6 6-6 6"/></svg>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  },

  Cards: ({ data }: Props) => {
    const { stations } = data;

    return (
      <section>
        <h2 className="h2">Stationen-Arena <span className="h2-sub">Klick auf eine Station öffnet die Auftragsliste</span></h2>
        
        {stations.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, background: 'var(--paper)', borderRadius: 'var(--radius)', border: '1px solid var(--cream-line)' }}>
            Keine Stationen mit wartenden Teilen erfasst.
          </div>
        ) : (
          <div className="grid-5">
            {stations.map(st => {
              let badgeClass = 'pill-mute';
              let badgeText = 'FREI';
              let numClass = '';
              let barColor = 'var(--ink-3)';
              
              if (st.status === 'critical') {
                badgeClass = 'pill-bad';
                badgeText = 'KRITISCH';
                numClass = 'crit';
                barColor = 'var(--red)';
              } else if (st.status === 'watch') {
                badgeClass = 'pill-warn';
                badgeText = 'BEOBACHTEN';
                barColor = 'var(--amber)';
              } else if (st.status === 'ok') {
                badgeClass = 'pill-ok';
                badgeText = 'OK';
                barColor = 'var(--green)';
              }

              return (
                <a key={st.stationId} href={st.openUrl} className={`station-card ${st.status}`}>
                  <div className="station-head">
                    <span className="station-name">{st.stationName}</span>
                    <span className={`pill ${badgeClass}`} style={{ fontSize: 9, padding: '3px 8px' }}>{badgeText}</span>
                  </div>
                  <div className="station-metrics">
                    <div className="stat-block">
                      <div className={`stat-num ${numClass}`}>{st.wartendN}</div>
                      <div className="stat-key">Wartend</div>
                    </div>
                    <div className="stat-block">
                      <div className="stat-num">{st.avgWartezeitTage}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-2)' }}>T</span></div>
                      <div className="stat-key">Ø Wartezeit</div>
                    </div>
                  </div>
                  <div>
                    <div className="stat-key" style={{ marginBottom: 4 }}>Auslastung {st.auslastungPct}%</div>
                    <div className="util-bar"><div style={{ width: `${st.auslastungPct}%`, background: barColor }}></div></div>
                  </div>
                  {st.hauptursache && (
                    <div className="station-cause" style={{ marginTop: 12 }}>{st.hauptursache}</div>
                  )}
                  <div className="station-link" style={{ marginTop: st.hauptursache ? 0 : 12 }}>
                    {st.wartendN} Aufträge öffnen →
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>
    );
  }
};
