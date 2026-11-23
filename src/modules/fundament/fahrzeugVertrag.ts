export type FahrzeugEingabe = Readonly<{
  id: string;
  version: number;
  kennzeichen: string;
  art: string;
  kraftstoff: string;
  tankkarte: string | null;
  fahrerId: string | null;
  startKm: number;
  aktiv: boolean;
}>;

export type FahrzeugAuswahl = Pick<FahrzeugEingabe,"id"|"kennzeichen"|"art">;
export type FahrerAuswahl = Readonly<{ id: string; name: string }>;
export type FahrzeugPflege = Readonly<{ fahrzeuge: readonly FahrzeugEingabe[]; fahrer: readonly FahrerAuswahl[] }>;
export type FahrzeugSpeichern =
  | Readonly<{ code: "OK"; fahrzeug: FahrzeugEingabe }>
  | Readonly<{ code: "FORBIDDEN" | "INVALID" | "CONFLICT" | "UNAVAILABLE" }>;
