export type StationKey = 
  | "wareneingang" 
  | "entmetallisierung" 
  | "schleiferei" 
  | "beschichtung" 
  | "warenausgang";

export interface StationConfig {
  key: StationKey;
  name: string;
  fullName: string;
  stepNumber: number;
  iconName: string;
  colorClass: string;
  standardLoad: number;
  partsWaiting: number;
  nextFreeSlot: string;
  blockerSymbol: string;
  action: string;
  sizeClass: string;
}

export const STATION_CONFIGS: Record<StationKey, StationConfig> = {
  wareneingang: {
    key: "wareneingang",
    name: "Wareneingang",
    fullName: "1. Wareneingang",
    stepNumber: 1,
    iconName: "Camera",
    colorClass: "bg-slate-50/50 border-slate-200 text-slate-900 shadow-slate-100",
    standardLoad: 65,
    partsWaiting: 2,
    nextFreeSlot: "Heute Nachmittag",
    blockerSymbol: "⏱️ Freigabe offen",
    action: "Kunden kontaktieren",
    sizeClass: "col-span-1 row-span-1 min-h-[95px]"
  },
  entmetallisierung: {
    key: "entmetallisierung",
    name: "Entmetallisierung",
    fullName: "2. Entmetallisierung",
    stepNumber: 2,
    iconName: "Layers",
    colorClass: "bg-yellow-50/50 border-yellow-200 text-yellow-950 shadow-yellow-100",
    standardLoad: 55,
    partsWaiting: 3,
    nextFreeSlot: "Morgen 14:30",
    blockerSymbol: "🧪 Badprozess läuft",
    action: "Entlackung vorantreiben",
    sizeClass: "col-span-1 row-span-1 min-h-[95px]"
  },
  schleiferei: {
    key: "schleiferei",
    name: "Schleiferei",
    fullName: "3. Schleiferei / Vorarbeit",
    stepNumber: 3,
    iconName: "Disc",
    colorClass: "bg-red-50 border-red-200 text-red-950 shadow-red-100 animate-pulse",
    standardLoad: 95,
    partsWaiting: 8,
    nextFreeSlot: "Morgen 11:00",
    blockerSymbol: "⚠️ Engpass / Überlastet",
    action: "Zusatzschicht prüfen",
    sizeClass: "col-span-2 row-span-2 min-h-[160px]"
  },
  beschichtung: {
    key: "beschichtung",
    name: "Beschichtung",
    fullName: "4. Beschichtung (Galvanik)",
    stepNumber: 4,
    iconName: "Droplets",
    colorClass: "bg-orange-50 border-orange-200 text-orange-950 shadow-orange-100",
    standardLoad: 85,
    partsWaiting: 6,
    nextFreeSlot: "Morgen 16:00",
    blockerSymbol: "🔥 Hohe Auslastung",
    action: "Badkapazität splitten",
    sizeClass: "col-span-1 row-span-2 min-h-[160px]"
  },
  warenausgang: {
    key: "warenausgang",
    name: "Warenausgang",
    fullName: "5. Warenausgang / QS",
    stepNumber: 5,
    iconName: "Truck",
    colorClass: "bg-emerald-50/50 border-emerald-200 text-emerald-950 shadow-emerald-100",
    standardLoad: 25,
    partsWaiting: 1,
    nextFreeSlot: "Sofort frei",
    blockerSymbol: "✅ QS Freigegeben",
    action: "Versand vorbereiten",
    sizeClass: "col-span-2 row-span-1 min-h-[95px]"
  }
};

export function getAllStations(): StationConfig[] {
  return Object.values(STATION_CONFIGS).sort((a, b) => a.stepNumber - b.stepNumber);
}

export function getStationConfig(key: string): StationConfig {
  const norm = (key || "wareneingang").toLowerCase() as StationKey;
  return STATION_CONFIGS[norm] || STATION_CONFIGS.wareneingang;
}
