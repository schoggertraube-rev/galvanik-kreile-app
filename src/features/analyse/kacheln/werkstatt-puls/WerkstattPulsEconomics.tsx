import React from 'react';
import { WerkstattPulsData } from '@/lib/analyse/dataContracts';

interface Props {
  data: WerkstattPulsData;
}

export function WerkstattPulsEconomics({ data }: Props) {
  const { economics } = data;

  if (economics.confidence === 'none') {
    return (
      <section>
        <h2 className="h2">Wirtschaftliche Auswirkung (Engpass & Risiko)</h2>
        <div style={{ padding: '20px 24px', background: 'var(--paper)', borderRadius: 'var(--radius-s)', border: '1px solid var(--cream-line)', color: 'var(--ink-2)' }}>
          Wirtschaftliche Auswirkung noch nicht belastbar. Grund: fehlende DB-/Arbeitszeit-/Rechnungsdaten.
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="h2">Wirtschaftliche Auswirkung (Engpass & Risiko)</h2>
      <div className="econ-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '16px' }}>
        
        <div className="econ-tile" style={{ background: 'var(--paper)', border: '1px solid var(--cream-line)', borderRadius: '12px', padding: '16px' }}>
          <div className="econ-key" style={{ fontSize: '11px', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Auftragswert im Engpass</div>
          <div className="econ-val" style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: 'var(--ink)' }}>
            {economics.engpassRevenueEur ? `${economics.engpassRevenueEur.toLocaleString('de-DE')} €` : '—'}
          </div>
          <div className="econ-note" style={{ fontSize: '11px', color: 'var(--ink-2)', marginTop: '4px' }}>
            Gesamterwarteter Umsatz im Stau
          </div>
        </div>

        <div className="econ-tile" style={{ background: 'var(--paper)', border: '1px solid var(--cream-line)', borderRadius: '12px', padding: '16px' }}>
          <div className="econ-key" style={{ fontSize: '11px', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>DB im Engpass</div>
          <div className="econ-val" style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: 'var(--ink)' }}>
            {economics.engpassDbEur ? `${economics.engpassDbEur.toLocaleString('de-DE')} €` : '—'}
          </div>
          <div className="econ-note" style={{ fontSize: '11px', color: 'var(--ink-2)', marginTop: '4px' }}>
            Erwarteter Deckungsbeitrag im Stau
          </div>
        </div>

        <div className="econ-tile" style={{ background: 'var(--paper)', border: '1px solid var(--cream-line)', borderRadius: '12px', padding: '16px' }}>
          <div className="econ-key" style={{ fontSize: '11px', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Belegte Verzögerungskosten</div>
          <div className="econ-val" style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: 'var(--red)' }}>
            {economics.actualDelayCostEur ? `${economics.actualDelayCostEur.toLocaleString('de-DE')} €` : '0 €'}
          </div>
          <div className="econ-note" style={{ fontSize: '11px', color: 'var(--ink-2)', marginTop: '4px' }}>
            Gebuchte Strafen / Sonderfrachten
          </div>
        </div>

        <div className="econ-tile" style={{ background: 'var(--paper)', border: '1px solid var(--cream-line)', borderRadius: '12px', padding: '16px' }}>
          <div className="econ-key" style={{ fontSize: '11px', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Modelliertes Terminrisiko</div>
          <div className="econ-val" style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: 'var(--amber)' }}>
            {economics.modelDelayRiskEur ? `${economics.modelDelayRiskEur.toLocaleString('de-DE')} €` : '0 €'}
          </div>
          <div className="econ-note" style={{ fontSize: '11px', color: 'var(--ink-2)', marginTop: '4px' }}>
            Aus Modellannahme (2% DB-Verlust / Tag)
          </div>
        </div>

      </div>
      <div style={{ fontSize: '11px', color: 'var(--ink-3)', marginTop: '12px' }}>
        Datenqualität: {economics.confidence === 'high' ? 'Sehr gut' : economics.confidence === 'medium' ? 'Befriedigend' : 'Gering'} · Betroffene Aufträge: {economics.affectedOrderCount}
      </div>
    </section>
  );
}
