import React from 'react';
import { WerkstattPulsData } from '@/lib/analyse/dataContracts';

interface Props {
  data: WerkstattPulsData;
}

export function WerkstattPulsInsightBox({ data }: Props) {
  const { insight } = data;

  if (!insight.available) {
    return (
      <div className="ki-card">
        <div className="ki-head">
          <span className="ki-title" style={{ color: 'var(--ink-2)' }}>Keine belastbare Engpass-Einschätzung</span>
        </div>
        <div className="ki-text">
          Es liegen keine Stationsereignisse oder wartenden Teile vor.
        </div>
      </div>
    );
  }

  return (
    <div className="ki-card">
      <div className="ki-head">
        <div className="ki-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        </div>
        <span className="ki-title">System-Einschätzung</span>
        <span className="ki-badge">Regelbasierte Analyse</span>
      </div>
      <div className="ki-text">
        <strong>Beobachtung:</strong> {insight.observation}
      </div>
      {insight.recommendation && (
        <div className="ki-rec">
          <div className="ki-rec-label">Empfehlung</div>
          {insight.recommendation}
        </div>
      )}
      {insight.actionLinks && insight.actionLinks.length > 0 && (
        <div className="ki-actions">
          {insight.actionLinks.map((link, idx) => (
            <a key={idx} href={link.href} className="ki-btn">
              {link.label}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
