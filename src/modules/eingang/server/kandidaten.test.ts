import { expect, it, vi } from 'vitest';
import { bildeSchluessel, klassifiziereTeil } from '@/lib/erfassung/klassifikator';
import { leseBelegteKundenTreffer, waehleKundenKandidaten, waehleVorgangsKandidaten, type KundenTreffer, type KundenTrefferregel } from './kandidaten';

// Synthetische Treffer der isolierten Auswahlprüfung.
const einstellungen = {
  eingang_vorschlaege_max: 3,
  eingang_kandidat_stufen: { ustid: 1, adresse: 1, domain: 0.8, telefon: 0.8, name: 0.6 },
  ki_sicherheitsschwelle: 0.8,
};
const treffer = (kundenId: string, regel: KundenTrefferregel): KundenTreffer => ({
  kundenId,
  regel,
  grundWert: 'TEST ' + regel,
});
const offen = { zuordnung: 'offen', quellenVollstaendig: true, einstellungen } as const;

it('behält den stärksten Vorgangsbeleg und sortiert gleiche Stufen nach dem jüngsten Vorgang', () => {
  const vorgeschlagen = waehleVorgangsKandidaten([
    { art: 'auftrag', id: 'A', regel: 'ware_erwartet', erstelltAm: 20 },
    { art: 'kv', id: 'B', regel: 'teil', erstelltAm: 30 },
    { art: 'auftrag', id: 'C', regel: 'teil', erstelltAm: 40 },
    { art: 'auftrag', id: 'A', regel: 'mailfaden', erstelltAm: 20 },
  ], {
    ...einstellungen, eingang_vorschlaege_max: 2,
    eingang_kandidat_stufen: { ...einstellungen.eingang_kandidat_stufen, mailfaden: 1, teil: 0.8, ware_erwartet: 0.6 },
  });
  expect(vorgeschlagen.map(({ id, regel, sicherheitWert }) => [id, regel, sicherheitWert]))
    .toEqual([['A', 'mailfaden', 1], ['C', 'teil', 0.8]]);
});

it('liefert bei fehlenden Treffern keine Vorschläge', () => {
  expect(waehleKundenKandidaten({ ...offen, treffer: [] })).toEqual({
    vorschlaege: [],
    automatischKundenId: null,
  });
});

it('verwendet je Kunde den stärksten tatsächlichen Treffer', () => {
  expect(waehleKundenKandidaten({
    ...offen,
    treffer: [treffer('A', 'name'), treffer('A', 'adresse')],
  })).toEqual({
    vorschlaege: [{ ...treffer('A', 'adresse'), sicherheitWert: 1 }],
    automatischKundenId: 'A',
  });
});

it('begrenzt sieben Treffer auf die eingestellte Menge und prüft Eindeutigkeit davor', () => {
  const sieben = [
    treffer('C', 'name'), treffer('D', 'name'), treffer('E', 'name'), treffer('F', 'name'),
    treffer('G', 'name'), treffer('B', 'telefon'), treffer('A', 'ustid'),
  ];
  expect(waehleKundenKandidaten({ ...offen, treffer: sieben }).vorschlaege.map(treffer => treffer.kundenId))
    .toEqual(['A', 'B', 'C']);
  const begrenzt = waehleKundenKandidaten({
    ...offen,
    treffer: sieben,
    einstellungen: { ...einstellungen, eingang_vorschlaege_max: 1 },
  });
  expect(begrenzt.vorschlaege.map(treffer => treffer.kundenId)).toEqual(['A']);
  expect(begrenzt.automatischKundenId).toBeNull();
});

it('zeigt vorhandene Treffer, wenn eine Quelle fehlt', () => {
  const ergebnis = waehleKundenKandidaten({
    ...offen, quellenVollstaendig: false, treffer: [treffer('A', 'adresse')],
  });
  expect(ergebnis.vorschlaege).toHaveLength(1);
  expect(ergebnis.automatischKundenId).toBeNull();
});

it.each(['automatisch', 'bestaetigt', 'hand'] as const)('lässt eine Zuordnung %s bestehen', zuordnung => {
  expect(waehleKundenKandidaten({ ...offen, zuordnung, treffer: [treffer('A', 'adresse')] })).toEqual({
    vorschlaege: [],
    automatischKundenId: null,
  });
});

it('zeigt Vorschläge ohne automatische Zuordnung, solange die Schwelle fehlt', () => {
  expect(waehleKundenKandidaten({
    ...offen,
    treffer: [treffer('A', 'ustid')],
    einstellungen: { ...einstellungen, ki_sicherheitsschwelle: null },
  })).toEqual({
    vorschlaege: [{ ...treffer('A', 'ustid'), sicherheitWert: 1 }],
    automatischKundenId: null,
  });
});

const firma = { name: 'Kreile Werkstatt', ustId: 'DE000000001' };
const eingang = {
  absenderAdresse: 'rechnung@ablauf.example',
  absenderName: 'Galvano Huber',
  absenderTelefon: '+49 711 123456',
  lieferantenUstId: 'DE 000000002',
  lieferantenName: 'Galvano Huber',
};

it('liest jede vorhandene Herkunft einmal und verwendet nur passende Treffer', async () => {
  const lesen = vi.fn()
    .mockResolvedValueOnce({ vollstaendig: true, kunden: [
      { id: 'lieferant', name: 'Galvano Huber' },
      { id: 'eigen', name: 'Kreile Werkstatt' },
    ] })
    .mockResolvedValueOnce({ vollstaendig: true, kunden: [
      { id: 'adresse', name: 'Günther', email: 'Rechnung@Ablauf.Example' },
      { id: 'domain', name: 'Dahl', email: 'service@ablauf.example' },
      { id: 'anders', name: 'Fremd', email: 'ablauf.example@fremd.example' },
    ] })
    .mockResolvedValueOnce({ vollstaendig: true, kunden: [
      { id: 'name', name: 'Galvano Huber' },
      { id: 'anders', name: 'Fremd' },
    ] })
    .mockResolvedValueOnce({ vollstaendig: true, kunden: [
      { id: 'telefon', name: 'Dahl', phone: '0711 123456' },
      { id: 'anders', name: 'Fremd', phone: '0711 1234567' },
    ] });

  expect(await leseBelegteKundenTreffer(eingang, firma, lesen)).toEqual({
    kandidaten: 'ok',
    hinweiseVollstaendig: true,
    quellenVollstaendig: true,
    treffer: [
      { kundenId: 'lieferant', regel: 'ustid', grundWert: 'DE000000002' },
      { kundenId: 'adresse', regel: 'adresse', grundWert: eingang.absenderAdresse },
      { kundenId: 'domain', regel: 'domain', grundWert: 'ablauf.example' },
      { kundenId: 'name', regel: 'name', grundWert: eingang.absenderName },
      { kundenId: 'telefon', regel: 'telefon', grundWert: eingang.absenderTelefon },
    ],
  });
  expect(lesen.mock.calls).toEqual([
    ['DE000000002', { exactSupplier: 'vat' }],
    ['ablauf.example', { mailIdentity: { address: eingang.absenderAdresse, domain: 'ablauf.example' } }],
    [eingang.absenderName, undefined],
    [eingang.absenderTelefon, undefined],
  ]);
});

it('behält den belegten Treffer bei einem Ausfall, ohne den Kunden selbst zuzuordnen', async () => {
  const lesen = vi.fn()
    .mockRejectedValueOnce(Error('TEST_QUELLE_AUSGEFALLEN'))
    .mockResolvedValueOnce({ vollstaendig: true, kunden: [
      { id: 'adresse', name: 'Günther', email: eingang.absenderAdresse },
    ] });
  const ergebnis = await leseBelegteKundenTreffer({
    ...eingang, absenderName: null, absenderTelefon: null, lieferantenName: null,
  }, firma, lesen);
  expect(ergebnis).toMatchObject({ kandidaten: 'teilweise', quellenVollstaendig: false });
  expect(ergebnis.treffer).toHaveLength(1);
  expect(waehleKundenKandidaten({ ...offen, ...ergebnis }).automatischKundenId).toBeNull();
});

it('sucht weder bei fehlenden Absenderwerten noch nach der eigenen Firma als Lieferant', async () => {
  const lesen = vi.fn();
  expect(await leseBelegteKundenTreffer({
    absenderAdresse: null, absenderName: null, absenderTelefon: null,
    lieferantenUstId: firma.ustId, lieferantenName: firma.name,
  }, firma, lesen)).toEqual({ kandidaten: 'keine', hinweiseVollstaendig: true, quellenVollstaendig: false, treffer: [] });
  expect(lesen).not.toHaveBeenCalled();
});

it('erkennt ue wie ü und behält gespeicherte Teil-Schlüssel', () => {
  expect(klassifiziereTeil('Führung', [{ klasse: 'Schiene', keywords: ['fuehrung'] }])).toBe('Schiene');
  expect(bildeSchluessel('Führung', 'Blank')).toBe('fuhrung|blank');
});
