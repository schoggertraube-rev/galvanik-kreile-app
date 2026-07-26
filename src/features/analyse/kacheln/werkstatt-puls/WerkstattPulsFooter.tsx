import React from 'react';
import { WerkstattPulsData } from '@/lib/analyse/dataContracts';

interface Props {
  data: WerkstattPulsData;
}

export function WerkstattPulsFooter({ data }: Props) {
  const { connectedLinks, dataSources } = data;

  return (
    <>
      <section>
        <h2 className="h2">Vernetzt mit</h2>
        <div className="links-grid">
          {connectedLinks.map((link, idx) => (
            <a key={idx} href={link.enabled ? link.href : '#'} className="link-tile" style={{ opacity: link.enabled ? 1 : 0.6, cursor: link.enabled ? 'pointer' : 'not-allowed' }}>
              <div className="link-tile-title">{link.label}</div>
              <div className="link-tile-val">{link.value}</div>
              {!link.enabled && link.emptyReason && (
                <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 4 }}>{link.emptyReason}</div>
              )}
            </a>
          ))}
        </div>
      </section>

      <div className="data-foot">
        <strong>Datenherkunft & Gültigkeit:</strong>
        {dataSources.map((ds, idx) => {
          let dotClass = 'gray';
          if (ds.status === 'ready') dotClass = 'green';
          else if (ds.status === 'partial') dotClass = 'amber';
          else if (ds.status === 'missing_input' || ds.status === 'unavailable') dotClass = 'red';
          const stateLabel = {
            ready: 'belegt',
            confirmed_empty: 'bestätigt leer',
            partial: 'teilweise belegt',
            missing_input: 'Eingabe fehlt',
            not_configured: 'nicht eingerichtet',
            unavailable: 'nicht verfügbar',
          }[ds.status];

          return (
            <span key={idx}>
              <span className={`dot ${dotClass}`}></span>
              {ds.label}: {stateLabel}
              {ds.recordCount !== null && ` (${ds.recordCount})`}
            </span>
          );
        })}
      </div>
    </>
  );
}
