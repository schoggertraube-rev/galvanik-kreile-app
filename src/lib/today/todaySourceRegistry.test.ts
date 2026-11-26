import {expect, it} from 'vitest';
import {fuegeTagQuellenZusammen, type TagQuelle} from './todaySourceRegistry';

const auftrag = {id: 'orders.auftrag', modul: 'orders', bereich: null, rang: null,
  bestand: {leser: 'order', umfang: 'auftrag'}} as const satisfies TagQuelle;
const geld = {id: 'accounting.geld', modul: 'accounting', bereich: null, rang: null,
  bestand: {leser: 'money', umfang: 'mandant'}} as const satisfies TagQuelle;

it('erhält Einzelfall, Listenquelle und ihren jeweiligen Bestandsleser', () => {
  expect(fuegeTagQuellenZusammen([
    {modul: 'orders', quellen: [auftrag]},
    {modul: 'accounting', quellen: [geld]},
  ])).toEqual([auftrag, geld]);
});

it('weist doppelte und einem falschen Modul zugeordnete Schlüssel zurück', () => {
  expect(() => fuegeTagQuellenZusammen([
    {modul: 'orders', quellen: [auftrag, auftrag]},
  ])).toThrow('TAG_QUELLE_DOPPELT_ODER_FALSCH');
  expect(() => fuegeTagQuellenZusammen([
    {modul: 'accounting', quellen: [{...auftrag, modul: 'accounting'}]},
  ])).toThrow('TAG_QUELLE_DOPPELT_ODER_FALSCH');
});
