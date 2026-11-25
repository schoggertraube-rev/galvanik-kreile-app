import "server-only";

import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

export type LagerEntnahmeRegel = "umlagerung" | "verbrauch";
export type LagerBilanzbewertung = "letzter_ek" | "gleitender_durchschnitt" | "hoechster_ek";

/** Die vom Fundament gelesenen Schlüssel; Lager definiert weder Werte noch Ersatzwerte. */
export type LagerEinstellungen = Readonly<{
  material_aufschlag_prozent: number | null;
  lager_regelversion: string | null;
  entnahme_regel_je_rubrik: Readonly<Record<string, LagerEntnahmeRegel>> | null;
  automatische_inventur_aktiv: boolean | null;
  bilanzbewertung_methode: LagerBilanzbewertung | null;
}>;

export type LagerEinstellungenLeser = (
  tenantId: string,
  tx?: PrivilegedTenantTransaction,
) => Promise<Partial<LagerEinstellungen> | null | undefined>;

type LagerBewertungsfehler = Readonly<{
  ok: false;
  schluessel: "material_aufschlag_prozent" | "lager_regelversion" | "bilanzbewertung_methode";
}>;

export type LagerRegelFehler = LagerBewertungsfehler | Readonly<{
  ok: false;
  schluessel: "entnahme_regel_je_rubrik" | "artikel_rubrik";
}>;

export type LagerRegeln = Readonly<{
  ok: true;
  aufschlag: number;
  version: string;
  bilanzbewertung: LagerBilanzbewertung;
  entnahme?: LagerEntnahmeRegel;
}>;

export type LagerRegelnErgebnis = LagerRegeln | LagerRegelFehler;

const bewertungen = new Set<LagerBilanzbewertung>([
  "letzter_ek",
  "gleitender_durchschnitt",
  "hoechster_ek",
]);

function istAufschlag(wert: unknown): wert is number {
  return typeof wert === "number" && Number.isFinite(wert) && wert >= 0 && wert < 10_000;
}

function istVersion(wert: unknown): wert is string {
  return typeof wert === "string" && wert.trim() === wert && wert.length > 0 && wert.length <= 120
    && !wert.includes("\u0000");
}

function istBewertung(wert: unknown): wert is LagerBilanzbewertung {
  return typeof wert === "string" && bewertungen.has(wert as LagerBilanzbewertung);
}

function istEntnahme(wert: unknown): wert is LagerEntnahmeRegel {
  return wert === "umlagerung" || wert === "verbrauch";
}

/**
 * Liefert nur belegte Einstellungen. Der aufrufende Befehl übersetzt den fehlenden
 * Schlüssel in den verbindlichen Katalogtext und schreibt davor keine Bewegung.
 */
export function bestimmeLagerRegeln(
  einstellungen: Partial<LagerEinstellungen> | null | undefined,
): LagerRegeln | LagerBewertungsfehler;
export function bestimmeLagerRegeln(
  einstellungen: Partial<LagerEinstellungen> | null | undefined,
  rubrikId: string | null | undefined,
): LagerRegelnErgebnis;
export function bestimmeLagerRegeln(
  einstellungen: Partial<LagerEinstellungen> | null | undefined,
  rubrikId?: string | null,
): LagerRegelnErgebnis {
  if (!istAufschlag(einstellungen?.material_aufschlag_prozent)) {
    return { ok: false, schluessel: "material_aufschlag_prozent" };
  }
  if (!istVersion(einstellungen?.lager_regelversion)) {
    return { ok: false, schluessel: "lager_regelversion" };
  }
  if (!istBewertung(einstellungen?.bilanzbewertung_methode)) {
    return { ok: false, schluessel: "bilanzbewertung_methode" };
  }

  const regeln: LagerRegeln = {
    ok: true,
    aufschlag: einstellungen.material_aufschlag_prozent,
    version: einstellungen.lager_regelversion,
    bilanzbewertung: einstellungen.bilanzbewertung_methode,
  };
  if (rubrikId === undefined) return regeln;
  if (!rubrikId) return { ok: false, schluessel: "artikel_rubrik" };
  const entnahme = einstellungen.entnahme_regel_je_rubrik?.[rubrikId];
  if (!istEntnahme(entnahme)) return { ok: false, schluessel: "entnahme_regel_je_rubrik" };
  return { ...regeln, entnahme };
}

export function leseBilanzbewertungMethode(
  einstellungen: Partial<LagerEinstellungen> | null | undefined,
): LagerBilanzbewertung | null {
  return istBewertung(einstellungen?.bilanzbewertung_methode) ? einstellungen.bilanzbewertung_methode : null;
}
