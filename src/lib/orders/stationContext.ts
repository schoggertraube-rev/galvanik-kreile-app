// Station → Kontext-Variante Mapping
// Kein Mock, nur Logik

export type StationVariant = 'erfassung' | 'versand' | 'wareneingang_readonly';

export const STATION_ORDER = ['wareneingang', 'entmetallisierung', 'schleiferei', 'galvanik', 'warenausgang'] as const;
export const STATION_LABELS: Record<string, string> = {
  wareneingang: 'Wareneingang',
  entmetallisierung: 'Entmetallisierung',
  schleiferei: 'Schleiferei',
  galvanik: 'Galvanik',
  warenausgang: 'Warenausgang',
};

// Default Arbeitsschritte pro Station (wenn company_settings.station_steps leer)
export const DEFAULT_STATION_STEPS: Record<string, string[]> = {
  wareneingang: ['Annahme & Prüfung'],
  entmetallisierung: ['Aufhängen', 'Entmetallisieren', 'Spülen', 'Trocknen'],
  schleiferei: ['Grobschliff', 'Feinschliff / Politur', 'Kupfer-Zwischenschliff'],
  galvanik: ['Aufhängen', 'Bad-Vorbereitung', 'Beschichtungszeit', 'Nachspülen', 'Abhängen'],
  warenausgang: ['Verpackung & Versand'],
};

export function getStationVariant(
  station: string,
  currentStationIndex: number,
  stationIndex: number,
  isCompleted: boolean
): StationVariant {
  if (station === 'warenausgang') return 'versand';
  if (station === 'wareneingang' && (stationIndex < currentStationIndex || isCompleted)) {
    return 'wareneingang_readonly';
  }
  return 'erfassung';
}

export function resolveActiveStation(
  routeStation: string | null | undefined,
  propsStation: string | null | undefined,
  orderCurrentStation: string | null | undefined,
  orderStation: string | null | undefined
): string {
  return routeStation || propsStation || orderCurrentStation || orderStation || 'wareneingang';
}
