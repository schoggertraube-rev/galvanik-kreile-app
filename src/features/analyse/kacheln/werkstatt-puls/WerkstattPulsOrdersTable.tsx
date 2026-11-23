import React from 'react';
import { WERKSTATT_PULS_COPY } from '@/ui/situationCatalog';
import { WerkstattPulsData } from '@/lib/analyse/dataContracts';

interface Props {
  data: WerkstattPulsData;
}

export function WerkstattPulsOrdersTable({ data }: Props) {
  const affectedOrders = data.affectedOrders.filter(order =>
    order.status === 'critical' || order.status === 'missing_due_date');

  const criticalCount = affectedOrders.filter(o => o.status === 'critical').length;
  const missingCount = affectedOrders.filter(o => o.status === 'missing_due_date').length;

  return (
    <section>
      <div className="card">
        <div className="card-h">
          <h3>{WERKSTATT_PULS_COPY.auftraege}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {criticalCount > 0 && <span className="pill pill-bad" style={{ fontSize: 10 }}>{criticalCount} {WERKSTATT_PULS_COPY.ueberfaellig}</span>}
            {missingCount > 0 && <span className="pill pill-warn" style={{ fontSize: 10 }}>{missingCount} {WERKSTATT_PULS_COPY.ohneZusage}</span>}
          </div>
        </div>
        
        {affectedOrders.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
            {WERKSTATT_PULS_COPY.keineBetroffenen}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Auftrag</th>
                  <th>Kunde</th>
                  <th>Station</th>
                  <th>Zugesagt</th>
                  <th>Verzug / Status</th>
                  <th>Priorität</th>
                </tr>
              </thead>
              <tbody>
                {affectedOrders.map(o => {
                  const ueberfaellig = o.status === 'critical';
                  const verzugClass = ueberfaellig ? 'bad' : 'info';
                  const verzugText = ueberfaellig
                    ? o.delayDays ? WERKSTATT_PULS_COPY.tageUeberfaellig(o.delayDays) : WERKSTATT_PULS_COPY.ueberfaellig
                    : WERKSTATT_PULS_COPY.ohneZusage;

                  return (
                    <tr key={o.orderId} onClick={() => window.location.href = o.openUrl}>
                      <td>
                        <div className="order-num">{o.orderNumber}</div>
                        <div className="order-title">{o.title}</div>
                      </td>
                      <td>{o.customerName}</td>
                      <td>{o.stationName}</td>
                      <td>{o.promisedDueDate ? new Date(o.promisedDueDate).toLocaleDateString('de-DE') : '—'}</td>
                      <td className={`verzug-cell ${verzugClass}`}>{verzugText}</td>
                      <td>{o.priority}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
