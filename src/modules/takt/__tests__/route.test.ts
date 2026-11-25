// @vitest-environment node
import {beforeEach, expect, it, vi} from 'vitest';
import {readFileSync} from 'node:fs';

const zugriff = vi.hoisted(() => vi.fn());
const handzugriff = vi.hoisted(() => vi.fn());
const lauf = vi.hoisted(() => vi.fn());
vi.mock('../server-public', () => ({pruefeTaktZugriff: zugriff, pruefeTaktHandzugriff: handzugriff, fuehreTaktAus: lauf}));
import {GET} from '@/app/api/takt/route';
import {GET as handGET} from '@/app/api/heute/neuaufbau/route';
import {TAKT_BUDGET_MS} from '../public';

beforeEach(() => { zugriff.mockReset(); handzugriff.mockReset(); lauf.mockReset(); });

it('konfiguriert genau einen täglichen Cron für den zentralen Takt', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {crons?: {path: string; schedule: string}[]};
  expect(config.crons).toEqual([{path: '/api/takt', schedule: '0 2 * * *'}]);
});

it('gibt ohne Berechtigung keine Datenbankarbeit frei', async () => {
  zugriff.mockResolvedValue({code: 'DENIED', status: 401});
  expect((await GET(new Request('https://example.test/api/takt'))).status).toBe(401);
  expect(lauf).not.toHaveBeenCalled();
});

it('beschränkt den Handlauf auf den angemeldeten Mandanten und Cron nicht', async () => {
  lauf.mockResolvedValue({mandanten: 1, laeufe: 1, restOffen: false});
  zugriff.mockResolvedValueOnce({code: 'LOGIN', tenantId: 'tenant-a'}).mockResolvedValueOnce({code: 'CRON'});
  expect((await GET(new Request('https://example.test/api/takt'))).status).toBe(200);
  expect((await GET(new Request('https://example.test/api/takt'))).status).toBe(200);
  expect(lauf.mock.calls).toEqual([[{tenantId: 'tenant-a', budgetMs: TAKT_BUDGET_MS}], [{budgetMs: TAKT_BUDGET_MS}]]);
});

it('antwortet ohne Mandanten ohne Laufbeleg', async () => {
  zugriff.mockResolvedValue({code: 'CRON'});
  lauf.mockResolvedValue({mandanten: 0, laeufe: 0, restOffen: false});
  expect((await GET(new Request('https://example.test/api/takt'))).status).toBe(204);
});

it('unterscheidet eine abgebrochene Mandantenabfrage von einer leeren Liste', async () => {
  zugriff.mockResolvedValue({code: 'CRON'});
  lauf.mockResolvedValue({mandanten: 0, laeufe: 0, restOffen: true, erfolglos: true});
  expect((await GET(new Request('https://example.test/api/takt'))).status).toBe(503);
});

it.each([
  {mandanten: 2, laeufe: 1, restOffen: false, erfolglos: true},
  {mandanten: 2, laeufe: 1, restOffen: true},
])('meldet einen unvollständigen Takt auch bei vorhandenen Mandanten', async result => {
  zugriff.mockResolvedValue({code: 'CRON'});
  lauf.mockResolvedValue(result);
  expect((await GET(new Request('https://example.test/api/takt'))).status).toBe(503);
});

it('startet am alten Endpunkt nur den Heute-Job für einen berechtigten Mandanten', async () => {
  handzugriff.mockResolvedValueOnce({code: 'DENIED', status: 403}).mockResolvedValueOnce({code: 'LOGIN', tenantId: 'tenant-a'});
  expect((await handGET(new Request('https://example.test/api/heute/neuaufbau'))).status).toBe(403);
  expect(lauf).not.toHaveBeenCalled();
  lauf.mockResolvedValue({mandanten: 1, laeufe: 1, restOffen: false});
  const request = new Request('https://example.test/api/heute/neuaufbau');
  expect((await handGET(request)).status).toBe(204);
  expect(lauf).toHaveBeenCalledWith({tenantId: 'tenant-a', nurJob: 'heute_neuaufbau', signal: request.signal});
});

it.each([
  {mandanten: 1, laeufe: 1, restOffen: false, erfolglos: true},
  {mandanten: 1, laeufe: 0, restOffen: true, erfolglos: true},
  {mandanten: 1, laeufe: 0, restOffen: false},
])('meldet Fehler und Abbruch beim manuellen Heute-Aufbau', async result => {
  handzugriff.mockResolvedValue({code: 'LOGIN', tenantId: 'tenant-a'});
  lauf.mockResolvedValue(result);
  expect((await handGET(new Request('https://example.test/api/heute/neuaufbau'))).status).toBe(503);
});

it('meldet einen belegten Heute-Aufbau als belegt', async () => {
  handzugriff.mockResolvedValue({code: 'LOGIN', tenantId: 'tenant-a'});
  lauf.mockResolvedValue({mandanten: 1, laeufe: 0, restOffen: false, erfolglos: true, besetzt: true});
  expect((await handGET(new Request('https://example.test/api/heute/neuaufbau'))).status).toBe(409);
});
