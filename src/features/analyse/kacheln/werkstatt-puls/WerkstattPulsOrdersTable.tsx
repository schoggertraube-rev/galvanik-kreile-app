import React from 'react';
import { WerkstattPulsData } from '@/lib/analyse/dataContracts';

interface Props {
  data: WerkstattPulsData;
}

export function WerkstattPulsOrdersTable({ data }: Props) {
  const { affectedOrders } = data;

  const criticalCount = affectedOrders.filter(o => o.status === 'critical').length;
  const missingCount = affectedOrders.filter(o => o.status === 'missing_due_date').length;
  const watchCount = affectedOrders.filter(o => o.status === 'watch').length;

  return (
    <section>
      <div className="card">
        <div className="card-h">
          <h3>Verzögerte und gefährdete Aufträge</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {criticalCount > 0 && <span className="pill pill-bad" style={{ fontSize: 10 }}>{criticalCount} kritisch</span>}
            {missingCount > 0 && <span className="pill pill-warn" style={{ fontSize: 10 }}>{missingCount} ohne Zusage</span>}
            {watchCount > 0 && <span className="pill pill-warn" style={{ fontSize: 10 }}>{watchCount} gefährdet</span>}
            {affectedOrders.length === 0 && <span className="pill pill-ok" style={{ fontSize: 10 }}>Keine Vorfälle</span>}
          </div>
        </div>
        
        {affectedOrders.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
            Aktuell keine kritischen Aufträge vorhanden. Alles läuft im Plan.
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
                  let verzugClass = '';
                  let verzugText = '';

                  if (o.status === 'missing_due_date') {
                    verzugClass = 'info';
                    verzugText = 'Nicht messbar: kein Termin';
                  } else if (o.status === 'critical') {
                    verzugClass = 'bad';
                    verzugText = o.delayDays ? `${o.delayDays} Tage überfällig` : 'Überfällig';
                  } else if (o.status === 'watch') {
                    verzugClass = 'warn';
                    verzugText = 'Gefährdet';
                  } else {
                    verzugClass = 'ok';
                    verzugText = 'Im Plan';
                  }

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
