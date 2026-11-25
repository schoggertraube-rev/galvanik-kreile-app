import { createHash } from "node:crypto";
import { foldSearchText } from "@/lib/domain/searchText";

export type LagerBelegart = "lieferschein" | "lieferantenrechnung";

export type LagerBelegPosition = Readonly<{
  /** ^[A-Za-z0-9_.:-]{1,64}$. Der Eingang vergibt und speichert den Schlüssel am Original. */
  positionKey: string;
  /** Zeilentext mit höchstens 500 Zeichen. */
  bezeichnung: string | null;
  lieferantenArtikelNr: string | null;
  /** 8, 12, 13 oder 14 Ziffern. */
  ean: string | null;
  /** Dezimaltext mit Punkt und bis zu drei Nachkommastellen, Vorzeichen erlaubt. */
  menge: string | null;
  einheitText: string | null;
  /** Netto in der Belegwährung mit höchstens vier Nachkommastellen. */
  einzelpreis: string | null;
  /** Bezugsmenge des Einzelpreises in Belegeinheit, null entspricht 1. */
  preisBezugMenge: string | null;
  rabattProzent: string | null;
  positionsNetto: string | null;
  /** Kleinste Sicherheit der gelesenen Felder, null bei unbekannter Sicherheit. */
  sicherheit: number | null;
}>;

export type LagerBeleg = Readonly<{
  /** intake_item.id des Eingangs. */
  itemId: string;
  /** intake_file.id und SHA-256 des führenden Originals. */
  fileId: string;
  dokumentSha256: string;
  belegart: LagerBelegart;
  belegnummer: string | null;
  /** JJJJ-MM-TT. */
  belegdatum: string | null;
  lieferantId: string | null;
  lieferantSicherheit: number | null;
  /** Höchstens drei Kandidaten aus der Erkennung. */
  lieferantKandidaten: ReadonlyArray<{ id: string; name: string; grund: string }>;
  /** ISO 4217, null bei unbekannter Währung. */
  waehrung: string | null;
  /** supplier_invoice.id nach dem Speichern einer Lieferantenrechnung. */
  rechnungId: string | null;
  bezug: Readonly<{ lieferscheinNummern: readonly string[]; bestellNummer: string | null }>;
  erkennungFertig: boolean;
  /** Falsch bei ungültiger oder doppelter Rechnung oder Eingang ohne Vorgang. */
  gueltig: boolean;
  positionen: readonly LagerBelegPosition[];
}>;

export type LagerBelegZeilenstand = "bereit" | "bestaetigen" | "artikel_fehlt" | "einheit_offen" | "menge_fehlt"
  | "basiseinheit_fehlt" | "gebucht" | "gedeckt" | "kein_lagerartikel" | "gutschrift";

export type LagerBelegVorschlag = Readonly<{
  itemId: string;
  version: number;
  belegart: LagerBelegart;
  belegnummer: string | null;
  stand: "liest" | "kein_beleg" | "dublette" | "lieferant_fehlt" | "ort_fehlt" | "offen" | "teilweise" | "gebucht" | "kein_lager" | "ausgeschaltet";
  dubletteVonItemId: string | null;
  lieferant: { id: string; name: string } | null;
  lieferantKandidaten: ReadonlyArray<{ id: string; name: string; grund: string }>;
  ortBeleg: { id: string; name: string } | null;
  wareneingangId: string | null;
  lieferungen: ReadonlyArray<{ wareneingangId: string; grund: "nummer" | "lieferant_positionen" | "schutzfrage"; text: string }>;
  zeilen: ReadonlyArray<{
    positionKey: string;
    stand: LagerBelegZeilenstand;
    unsicher: boolean;
    bezeichnung: string | null;
    vonHand: boolean;
    ort: { id: string; name: string } | null;
    nebenkostenArt: string | null;
    artikel: { id: string; name: string; basiseinheit: string | null; version: number } | null;
    zuordnungArt: "lieferantennummer" | "ean" | "gelernt" | "bezeichnung" | "hand" | "neu" | null;
    kandidaten: ReadonlyArray<{ artikelId: string; name: string; grund: string }>;
    neuerArtikel: { name: string; basiseinheit: string | null; rubrikId: string | null; groesse: string | null } | null;
    mengeBeleg: string | null;
    einheitText: string | null;
    faktor: string | null;
    mengeBasis: string | null;
    gebuchtBasis: string;
    abweichung: { berechnetBasis: string; geliefertBasis: string } | null;
    eventId: string | null;
    /** Nur mit lager.werte. */
    preis?: { einzelpreisBasis: string | null; waehrung: string | null; bisher: string | null; abweichungProzent: string | null; preisId: string | null };
  }>;
  knopf: { befehl: "uebernehmen"; anzahlBereit: number; text: string } | null;
  rueckgaengig: boolean;
}>;

type Kennungsart = "lieferant" | "ean" | "lieferant_text";

export function kennungNormal(wert: string, art: Kennungsart = "lieferant"): string {
  switch (art) {
    case "lieferant":
      return wert.normalize("NFC").trim().toLocaleUpperCase("de-DE").replaceAll(" ", "");
    case "ean":
      return wert.replace(/\D/g, "");
    case "lieferant_text": {
      const text = foldSearchText(wert.normalize("NFC")).replace(/\s+/gu, " ");
      return [...text].slice(0, 128).join("");
    }
  }
}

type BelegSchluesselEingabe =
  | Readonly<Pick<LagerBeleg, "lieferantId" | "belegart" | "belegnummer" | "dokumentSha256"> & { art: "beleg" }>
  | Readonly<{ art: "frage_offen" | "eigener_beleg"; itemId: string }>;

export function belegSchluessel(eingabe: BelegSchluesselEingabe): string {
  const hash = createHash("sha256");
  switch (eingabe.art) {
    case "frage_offen":
      return hash.update(`f|${eingabe.itemId}`).digest("hex");
    case "eigener_beleg":
      return hash.update(`e|${eingabe.itemId}`).digest("hex");
    case "beleg": {
      const nummer = kennungNormal(eingabe.belegnummer ?? "");
      if (eingabe.lieferantId && nummer) {
        return hash.update(`n|${eingabe.lieferantId}|${eingabe.belegart}|${nummer}`).digest("hex");
      }
      return hash.update(`d|${eingabe.dokumentSha256}`).digest("hex");
    }
  }
}
