import type { LagerUnit } from "./quantity";

type ArtikelFelder = {
  name: string;
  variante: string | null;
  groesse: string | null;
  basiseinheit: LagerUnit | null;
  rubrikId: string | null;
};

export type Stammbefehl =
  | { art: "rubrik.speichern"; id: string | null; version: number; name: string }
  | ({ art: "artikel.speichern"; id: string | null; version: number } & ArtikelFelder)
  | { art: "artikel.foto_zuordnen"; id: string; version: number; fotoId: string; eingangId?: string }
  | {
      art: "artikel.kennung"; id: string; version: number; kennungsart: "lieferant" | "synonym" | "qr";
      wert: string; lieferantId: string | null;
    }
  | { art: "artikel.entwurf"; name: string | null; fotoId: string | null }
  | {
      art: "gebinde.versionieren"; artikelId: string; schluessel: string; version: number;
      gebindeart: string; name: string; menge: string; einheit: LagerUnit; gueltigAb: string;
      umrechnung: { menge: string; einheit: LagerUnit; belegId: string } | null;
    }
  | {
      art: "artikel.metall"; id: string; version: number; metall: string | null;
      feinPct: string | null; kursMetall: boolean | null; paragraph13bMetall: boolean | null;
    };

export type Stammauftrag = { befehlId: string; daten: Stammbefehl };
export type Stammbeleg = { id: string; version: number };
export type Stammfehler = "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT" | "UNAVAILABLE";
export type Stammantwort =
  | { ok: true; data: Stammbeleg; wiederholt: boolean }
  | { ok: false; code: Stammfehler }
  | { ok: false; code: "LAGER_AUSGESCHALTET"; message: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const artikelId = /^[A-Za-z0-9_-]{1,128}$/;
const einheiten = new Set<unknown>(["stk", "paar", "ml", "l", "g", "kg", "mm", "cm", "m"]);

function objekt(wert: unknown): wert is Record<string, unknown> {
  return wert !== null && typeof wert === "object" && !Array.isArray(wert);
}
function felder(wert: Record<string, unknown>, erwartet: string) {
  return Object.keys(wert).sort().join(",") === erwartet;
}
function kurztext(wert: unknown, max = 120): wert is string {
  return typeof wert === "string" && wert === wert.trim() && wert.length > 0 && wert.length <= max && !wert.includes("\u0000");
}
function option<T>(wert: unknown, korrekt: (wert: unknown) => wert is T): wert is T | null {
  return wert === null || korrekt(wert);
}
function uuidWert(wert: unknown): wert is string {
  return typeof wert === "string" && uuid.test(wert) && wert.length === 36;
}
function artikelKennung(wert: unknown): wert is string {
  return kurztext(wert, 128) && artikelId.test(wert);
}
function version(wert: unknown): wert is number {
  return typeof wert === "number" && Number.isInteger(wert) && wert >= 0 && wert < 2147483647;
}
function einheit(wert: unknown): wert is LagerUnit {
  return einheiten.has(wert);
}
function gebindemenge(wert: unknown, unit: LagerUnit) {
  if (!kurztext(wert, 15)) return false;
  const ganz = unit === "stk" || unit === "paar";
  return (ganz ? /^(?:0|[1-9][0-9]{0,10})$/ : /^(?:0|[1-9][0-9]{0,10})(?:\.[0-9]{1,3})?$/).test(wert)
    && /[1-9]/.test(wert);
}
function fachzeit(wert: unknown) {
  if (!kurztext(wert, 24) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(wert) || wert.startsWith("0000")) return false;
  const datum = new Date(wert);
  return Number.isFinite(datum.getTime()) && datum.toISOString() === wert;
}
function bool(wert: unknown): wert is boolean {
  return typeof wert === "boolean";
}
function feingehalt(wert: unknown): wert is string {
  return kurztext(wert, 15) && /^(100(?:\.0+)?|(?:0|[1-9][0-9]?)(?:\.[0-9]+)?)$/.test(wert);
}
function befehl(wert: unknown): wert is Stammbefehl {
  if (!objekt(wert)) return false;
  switch (wert.art) {
    case "rubrik.speichern":
      return felder(wert, "art,id,name,version") && kurztext(wert.name) && version(wert.version)
        && (wert.id === null ? wert.version === 0 : uuidWert(wert.id) && wert.version > 0);
    case "artikel.speichern":
      return felder(wert, "art,basiseinheit,groesse,id,name,rubrikId,variante,version")
        && option(wert.basiseinheit, einheit) && kurztext(wert.name) && option(wert.variante, kurztext)
        && option(wert.groesse, kurztext) && option(wert.rubrikId, uuidWert) && version(wert.version)
        && (wert.id === null ? wert.version === 0 : artikelKennung(wert.id) && wert.version > 0);
    case "artikel.foto_zuordnen":
      return (felder(wert, "art,fotoId,id,version")
        || (felder(wert, "art,eingangId,fotoId,id,version") && uuidWert(wert.eingangId)))
        && artikelKennung(wert.id)
        && version(wert.version) && wert.version > 0 && uuidWert(wert.fotoId);
    case "artikel.kennung":
      return felder(wert, "art,id,kennungsart,lieferantId,version,wert")
        && artikelKennung(wert.id) && version(wert.version) && wert.version > 0 && kurztext(wert.wert, 128)
        && (wert.kennungsart === "lieferant" ? artikelKennung(wert.lieferantId)
          : (wert.kennungsart === "synonym" || wert.kennungsart === "qr") && wert.lieferantId === null);
    case "artikel.entwurf":
      return felder(wert, "art,fotoId,name") && option(wert.name, kurztext)
        && option(wert.fotoId, uuidWert) && (wert.name !== null || wert.fotoId !== null);
    case "gebinde.versionieren":
      return felder(wert, "art,artikelId,einheit,gebindeart,gueltigAb,menge,name,schluessel,umrechnung,version")
        && artikelKennung(wert.artikelId) && kurztext(wert.schluessel) && version(wert.version)
        && kurztext(wert.gebindeart) && kurztext(wert.name) && fachzeit(wert.gueltigAb)
        && einheit(wert.einheit) && gebindemenge(wert.menge, wert.einheit)
        && (wert.umrechnung === null || objekt(wert.umrechnung) && felder(wert.umrechnung, "belegId,einheit,menge")
          && einheit(wert.umrechnung.einheit) && gebindemenge(wert.umrechnung.menge, wert.umrechnung.einheit)
          && uuidWert(wert.umrechnung.belegId));
    case "artikel.metall":
      return felder(wert, "art,feinPct,id,kursMetall,metall,paragraph13bMetall,version")
        && artikelKennung(wert.id) && version(wert.version) && wert.version > 0
        && option(wert.metall, kurztext) && option(wert.feinPct, feingehalt)
        && option(wert.kursMetall, bool) && option(wert.paragraph13bMetall, bool)
        && (wert.metall !== null || wert.feinPct === null && wert.kursMetall === null && wert.paragraph13bMetall === null);
    default:
      return false;
  }
}

export function istStammauftrag(wert: unknown): wert is Stammauftrag {
  return objekt(wert) && felder(wert, "befehlId,daten") && uuidWert(wert.befehlId) && befehl(wert.daten);
}

export function stammAbsicht(daten: Stammbefehl): string {
  return JSON.stringify(daten, (_key, objektWert: unknown) => objekt(objektWert)
    ? Object.fromEntries(Object.entries(objektWert).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
    : objektWert);
}
