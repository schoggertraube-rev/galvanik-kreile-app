import { istLagerFachzeit, lagerBefehlsUuid } from "./lagerBuchungsauftrag";
import type { LagerUnit } from "./quantity";

export type InventurZaehlauftrag = Readonly<{
  befehlId: string;
  sessionId: string;
  artikelId: string;
  ortId: string;
  version: number;
  countedAt: string;
  einheit: LagerUnit | null;
  menge: string | null;
  mengenqualitaet: "exakt" | "geschaetzt" | null;
  gebinde?: Readonly<{ id: string; anzahl: string; rest: string }>;
  bewegungRevision?: string;
}>;

const artikel = /^[A-Za-z0-9_-]{1,128}$/u;
const dezimal = /^(?:0|[1-9]\d{0,10})(?:\.\d{1,3})?$/u;
const ganzzahl = /^(?:0|[1-9]\d{0,10})$/u;
const einheiten = new Set<LagerUnit>(["stk", "paar", "ml", "l", "g", "kg", "mm", "cm", "m"]);
const felder = new Set(["befehlId", "sessionId", "artikelId", "ortId", "version", "countedAt", "einheit", "menge", "mengenqualitaet", "gebinde", "bewegungRevision"]);

/** Reiner und offline-tauglicher Vertrag für eine Inventurzählung aus B1a-4. */
export function leseInventurZaehlauftrag(input: unknown): InventurZaehlauftrag | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const wert = input as Record<string, unknown>;
  if (Object.keys(wert).some((feld) => !felder.has(feld))) return null;
  const gebinde = wert.gebinde as Record<string, unknown> | undefined;
  if (typeof wert.befehlId !== "string" || !lagerBefehlsUuid.test(wert.befehlId)
    || typeof wert.sessionId !== "string" || !lagerBefehlsUuid.test(wert.sessionId)
    || typeof wert.artikelId !== "string" || !artikel.test(wert.artikelId)
    || typeof wert.ortId !== "string" || !lagerBefehlsUuid.test(wert.ortId)
    || !Number.isInteger(wert.version) || (wert.version as number) < 0 || (wert.version as number) >= 2147483647
    || !istLagerFachzeit(wert.countedAt)
    || !(wert.einheit === null || typeof wert.einheit === "string" && einheiten.has(wert.einheit as LagerUnit))
    || !(wert.menge === null || typeof wert.menge === "string" && dezimal.test(wert.menge))
    || !(wert.mengenqualitaet === null || wert.mengenqualitaet === "exakt" || wert.mengenqualitaet === "geschaetzt")
    || !(wert.bewegungRevision === undefined || typeof wert.bewegungRevision === "string" && /^[0-9a-f]{64}$/u.test(wert.bewegungRevision))
    || !(gebinde === undefined || gebinde !== null && typeof gebinde === "object" && Object.keys(gebinde).every((feld) => ["id", "anzahl", "rest"].includes(feld))
      && Object.keys(gebinde).length === 3 && typeof gebinde.id === "string" && lagerBefehlsUuid.test(gebinde.id)
      && typeof gebinde.anzahl === "string" && ganzzahl.test(gebinde.anzahl)
      && typeof gebinde.rest === "string" && dezimal.test(gebinde.rest))) return null;
  return input as InventurZaehlauftrag;
}
