import React from 'react';

interface StationData {
  station: string;
  avg_tage: number;
  n: number;
  teile_aktuell: number;
}

interface StationDurchlaufListProps {
  stationen: StationData[];
}

const STATION_NAMES: Record<string, string> = {
  wareneingang: 'Wareneingang',
  entmetallisierung: 'Entmetallisierung',
  schleifen: 'Schleifen',
  galvanik: 'Galvanik',
  qk_versand: 'QK/Versand',
};

export const StationDurchlaufList: React.FC<StationDurchlaufListProps> = ({ stationen }) => {
  if (!stationen || stationen.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
        Noch keine Stationsdaten erfasst. Stationswechsel-Events werden ab dem ersten echten Durchlauf gesammelt.
      </div>
    );
  }

  // Sort by avg_tage desc
  const sorted = [...stationen].sort((a, b) => b.avg_tage - a.avg_tage);

  return (
    <div className="space-y-3">
      {sorted.map((s, idx) => (
        <div key={s.station} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
              {idx + 1}
            </div>
            <div>
              <div className="font-semibold text-gray-900">{STATION_NAMES[s.station] || s.station}</div>
              <div className="text-sm text-gray-500">{s.n} Aufträge gemessen</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900">{s.avg_tage} Tage Ø</div>
            {s.teile_aktuell > 0 ? (
              <div className="text-xs text-red-600 font-medium">Engpass: {s.teile_aktuell} Aufträge im Stau</div>
            ) : (
              <div className="text-xs text-green-600 font-medium">Leer / Fließend</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
