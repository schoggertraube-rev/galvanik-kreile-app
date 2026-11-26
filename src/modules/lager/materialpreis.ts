import { InvoiceMaterialUnitError, invoiceElectronicUnit, invoiceMaterialLineNetCents, isInvoiceMaterialUnitCode, type InvoiceMaterialUnitCode } from "@/lib/domain/invoiceElectronicFields";
import type { LagerUnit } from "./quantity";

function dezimal(wert: string) {
  const teile = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/u.exec(wert);
  const nachkomma = teile?.[2] ?? "";
  if (!teile || teile[0] !== wert) {
    throw Error("LAGER_MATERIAL_BETRAG_UNGUELTIG");
  }
  return {
    wert: BigInt(teile[1] + nachkomma),
    skala: BigInt(10) ** BigInt(nachkomma.length),
  };
}

function rundeQuotient(zaehler: bigint, nenner: bigint): bigint {
  return (zaehler + nenner / BigInt(2)) / nenner;
}

export function materialVerkaufspreis(kalkEk: string, aufschlagProzent: string): string {
  const einkaufspreis = dezimal(kalkEk);
  const aufschlag = dezimal(aufschlagProzent);
  const prozentbasis = BigInt(100) * aufschlag.skala;
  const skala = BigInt(10000);
  const vierstellig = rundeQuotient(
    einkaufspreis.wert * (prozentbasis + aufschlag.wert) * skala,
    einkaufspreis.skala * prozentbasis,
  );
  const nachkomma = String(vierstellig % skala).padStart(4, "0");
  return `${vierstellig / skala}.${nachkomma}`;
}

export function materialPositionsbetragCent(verkaufspreis: string, mengenSumme: string): number {
  const cent = invoiceMaterialLineNetCents(verkaufspreis, mengenSumme);
  if (cent === null) throw Error("LAGER_MATERIAL_BETRAG_UNGUELTIG");
  return cent;
}

function materialDezimalSkaliert(wert: string, skala: bigint): bigint {
  const dezimalwert = dezimal(wert);
  const zaehler = dezimalwert.wert * skala;
  if (zaehler % dezimalwert.skala !== BigInt(0)) throw Error("LAGER_MATERIAL_BETRAG_UNGUELTIG");
  return zaehler / dezimalwert.skala;
}

function materialMengeAlsText(tausendstel: bigint): string {
  const skala = BigInt(1000);
  const nachkomma = String(tausendstel % skala).padStart(3, "0").replace(/0+$/, "");
  return nachkomma ? `${tausendstel / skala}.${nachkomma}` : String(tausendstel / skala);
}

function materialWareneinsatzCent(neunStellen: bigint): number {
  const cent = rundeQuotient(neunStellen, BigInt(10000000));
  if (cent > BigInt(Number.MAX_SAFE_INTEGER)) throw Error("LAGER_MATERIAL_BETRAG_UNGUELTIG");
  return Number(cent);
}

export function lagerRechnungseinheit(einheit: string) {
  const code = invoiceElectronicUnit(einheit, "MATERIAL")?.code;
  if (!isInvoiceMaterialUnitCode(code)) throw new InvoiceMaterialUnitError(einheit);
  return code;
}

export type LagerRechnungsBuchung = {
  eventId: string;
  auftragId: string;
  artikelId: string;
  artikel: string;
  menge: string;
  einheit: LagerUnit;
  kalkEk: string | null;
  aufschlag: string | null;
  rechnungsnummer: string | null;
};

type LagerMaterialPosition = {
  auftragId: string;
  artikelId: string;
  artikel: string;
  einheit: LagerRechnungsBuchung["einheit"];
  einheitCode: InvoiceMaterialUnitCode;
  menge: string;
  verkaufspreis: string | null;
  betragCent: number | null;
  wareneinsatzCent: number | null;
  preisFehlt: boolean;
  gesperrtDurchRechnung: string | null;
  eventIds: string[];
};

type MaterialGruppe = Omit<LagerMaterialPosition, "menge" | "betragCent" | "wareneinsatzCent"> & {
  mengenSumme: bigint;
  einsatzSumme: bigint;
};

export function fasseMaterialpositionenZusammen(zeilen: readonly LagerRechnungsBuchung[]): LagerMaterialPosition[] {
  const gruppen = new Map<string, MaterialGruppe>();
  for (const zeile of zeilen) {
    if ((zeile.kalkEk === null) !== (zeile.aufschlag === null)) throw Error("LAGER_MATERIAL_BEWERTUNG_UNVOLLSTAENDIG");
    const verkaufspreis = zeile.kalkEk !== null && zeile.aufschlag !== null
      ? materialVerkaufspreis(zeile.kalkEk, zeile.aufschlag) : null;
    const key = JSON.stringify([zeile.auftragId, zeile.artikelId, zeile.einheit, verkaufspreis]);

    let gruppe = gruppen.get(key);
    if (!gruppe) {
      gruppe = {
        auftragId: zeile.auftragId, artikelId: zeile.artikelId, artikel: zeile.artikel,
        einheit: zeile.einheit, einheitCode: lagerRechnungseinheit(zeile.einheit), verkaufspreis,
        preisFehlt: verkaufspreis === null, gesperrtDurchRechnung: zeile.rechnungsnummer,
        eventIds: [], mengenSumme: BigInt(0), einsatzSumme: BigInt(0),
      };
      gruppen.set(key, gruppe);
    }

    const menge = materialDezimalSkaliert(zeile.menge, BigInt(1000));
    if (menge <= BigInt(0)) throw Error("LAGER_MATERIAL_MENGE_UNGUELTIG");
    if (zeile.kalkEk !== null) gruppe.einsatzSumme += menge * materialDezimalSkaliert(zeile.kalkEk, BigInt(1000000));
    if (gruppe.gesperrtDurchRechnung !== zeile.rechnungsnummer) throw Error("LAGER_MATERIAL_RECHNUNGSBEZUG_UNEINDEUTIG");
    gruppe.mengenSumme += menge;
    gruppe.eventIds.push(zeile.eventId);
  }

  return [...gruppen.values()].map(({ mengenSumme, einsatzSumme, ...gruppe }) => {
    const menge = materialMengeAlsText(mengenSumme);
    return { ...gruppe, menge,
      betragCent: gruppe.verkaufspreis === null ? null : materialPositionsbetragCent(gruppe.verkaufspreis, menge),
      wareneinsatzCent: gruppe.verkaufspreis === null ? null : materialWareneinsatzCent(einsatzSumme),
    };
  });
}
