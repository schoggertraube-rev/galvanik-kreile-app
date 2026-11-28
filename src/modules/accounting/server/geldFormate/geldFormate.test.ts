// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { leseCsvAuszug, type ImportProfil } from './csvProfil';
import { leseKassenZaehlung } from './kassenZaehlung';
import { lesePspAbrechnung } from './pspCsv';

const quelle = { trenner: ',', dezimal: '.', datumsformat: 'YYYY-MM-DD', kodierung: 'utf-8', waehrung: 'EUR' } as const;
const original = (name: string) => readFileSync(new URL('./__fixtures__/' + name, import.meta.url));

it('liest Kontoauszug und getrennte Buchungs- und Wertstellungstage', () => {
  const result = leseCsvAuszug(original('TEST-AUSZUG-NOV.csv'), {
    ...quelle, spalten: { satzart: 'satz', referenz: 'referenz', buchungstag: 'buchungstag', valuta: 'valuta',
      betrag: 'betrag_eur', verwendung: 'verwendung' },
  });
  expect(result.fehler).toEqual([]);
  expect(result.kopf).toEqual({ anfangCents: 100000, endeCents: 125700, von: '2026-11-01', bis: '2026-11-30' });
  expect(result.zeilen.map(zeile => zeile.betragCents)).toEqual([12000, 10000, 11700, -8000]);
  expect(result.zeilen[3]).toMatchObject({ transaktionsRef: 'TEST-B4', buchungstag: '2026-11-30', valuta: '2026-12-01' });
});

it('liest Verkauf, Gebühr und Auszahlung aus der Original-Kartenabrechnung', () => {
  const result = lesePspAbrechnung(original('TEST-Kartenabrechnung.csv'), {
    ...quelle, spalten: { satzart: 'satz', referenz: 'referenz', buchungstag: 'tag', betrag: 'betrag_eur', verwendung: 'bezug' },
  });
  expect(result.fehler).toEqual([]);
  expect(result.kopf.endeCents).toBe(0);
  expect(result.zeilen.map(zeile => [zeile.art, zeile.betragCents, zeile.transaktionsRef])).toEqual([
    ['kartenverkauf', 11900, 'P1-S'], ['anbietergebuehr', -200, 'P1-F'], ['anbieterauszahlung', -11700, 'P1-A'],
  ]);
  expect(result.zeilen.map(zeile => zeile.settlementId)).toEqual([null, null, null]);
});

it('liest die ausdrücklich zugeordnete Settlement-Spalte unverändert', () => {
  const bytes = new TextEncoder().encode('satz,referenz,tag,wert,charge\nAuszahlung,P1-A,2026-11-14,-117,"  TEST-X / 4  "\nAuszahlung,P2-A,2026-11-15,-50,');
  const result = lesePspAbrechnung(bytes, {
    ...quelle, spalten: { satzart: 'satz', referenz: 'referenz', buchungstag: 'tag', betrag: 'wert', settlementId: 'charge' },
  });
  expect(result.fehler).toEqual([]);
  expect(result.zeilen.map(zeile => zeile.settlementId)).toEqual(['  TEST-X / 4  ', null]);
});

it('liest die Original-Kassenzählung als Anfangs- und Schlussbestand', () => {
  expect(leseKassenZaehlung(original('TEST-Kassenzaehlung.csv'), {
    ...quelle, spalten: { satzart: 'satz', buchungstag: 'datum', betrag: 'betrag_eur' },
  })).toEqual({ anfangCents: 6000, endeCents: 9000, tag: '2026-11-30', fehler: [] });
});

it('folgt dem Quellenprofil und ordnet fehlerhafte Zeilen dem Original zu', () => {
  const profil: ImportProfil = { ...quelle, trenner: ';', dezimal: ',', datumsformat: 'DD.MM.YYYY',
    spalten: { buchungstag: 'tag', betrag: 'wert', verwendung: 'zweck' } };
  const text = 'tag;wert;zweck\r\n01.11.2026;-1.234,56;"TEST mit ; und ""Zitat""\nFortsetzung"\r\n31.11.2026;10;TEST';
  const result = leseCsvAuszug(new TextEncoder().encode(text), profil);
  expect(result.zeilen).toHaveLength(1);
  expect(result.zeilen[0]).toMatchObject({
    zeile: 2, buchungstag: '2026-11-01', betragCents: -123456, verwendungszweck: 'TEST mit ; und "Zitat"\nFortsetzung',
  });
  expect(result.fehler).toEqual([{ zeile: 4, feld: 'buchungstag', code: 'WERT_UNGUELTIG' }]);
});

it('meldet fehlende Spalten und ein unvollständiges Zitat', () => {
  const profil = { ...quelle, spalten: { buchungstag: 'tag', betrag: 'wert' } };
  const encode = (text: string) => new TextEncoder().encode(text);
  expect(leseCsvAuszug(encode('tag,währung\n2026-11-01,EUR'), profil).fehler)
    .toEqual([{ zeile: 1, feld: 'betrag', code: 'SPALTE_FEHLT' }]);
  const partial = leseCsvAuszug(encode('tag,wert\n2026-11-01,2.50\n"2026-11-02,12'), profil);
  expect(partial.zeilen.map(zeile => zeile.betragCents)).toEqual([250]);
  expect(partial.fehler).toEqual([{ zeile: 3, feld: 'format', code: 'WERT_UNGUELTIG' }]);
  expect(leseCsvAuszug(encode('"tag,wert'), profil).fehler)
    .toEqual([{ zeile: 1, feld: 'format', code: 'FORMAT_UNBEKANNT' }]);
});
