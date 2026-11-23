import React from 'react';
import { WERKSTATT_PULS_COPY } from '@/ui/situationCatalog';
import type { WerkstattPulsData } from '@/lib/analyse/dataContracts';

export function WerkstattPulsStationArena({ data }: { data: WerkstattPulsData }) {
  const stationen = data.auftraegeJeStation;
  return (
    <section className="card">
      <div className="card-h"><h3>{WERKSTATT_PULS_COPY.stationszahlen}</h3></div>
      <div className="card-body">
        {stationen?.length ? <ul>{stationen.map(({ station, auftraege }) => (
          <li key={station}><a href={`/orders?station=${encodeURIComponent(station)}&returnTo=/performance?tile=werkstatt_puls`}>{WERKSTATT_PULS_COPY.station[station] ?? station} · {auftraege}</a></li>
        ))}</ul> : <p>{WERKSTATT_PULS_COPY.fehlt}</p>}
      </div>
    </section>
  );
}
