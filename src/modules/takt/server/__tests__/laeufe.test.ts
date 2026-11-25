// @vitest-environment node
import {beforeEach, expect, it, vi} from 'vitest';
import {hasPageReadBudget} from '@/db/readBudget';

const transaction = vi.hoisted(() => vi.fn());
const listeTodayMandanten = vi.hoisted(() => vi.fn());
const hasAuthorizationArea = vi.hoisted(() => vi.fn());
vi.mock('@/db', () => ({db: {transaction: () => { throw Error('TEST_USE_TRANSACTION_FIXTURE'); }}}));
vi.mock('@/lib/server/privilegedDb', async original => ({
  ...await original<typeof import('@/lib/server/privilegedDb')>(),
  withPrivilegedTenantTransaction: transaction,
}));
vi.mock('@/lib/server/todayProjectionSchedule', () => ({listeTodayMandanten}));
vi.mock('@/lib/server/authorization', () => ({hasAuthorizationArea}));

import {beendeAbgelaufenenLauf, beendeLauf, liesLetztenOk, liesTaktLaeufe, liesTaktMandanten, loescheAlteLaeufe, mitTaktLaufsperre, reserviereLauf} from '../laeufe';

const sqlText = (query: {queryChunks: {value?: string[]}[]}) =>
  query.queryChunks.map(part => part.value?.join('') ?? '').join('');

beforeEach(() => { transaction.mockReset(); listeTodayMandanten.mockReset(); hasAuthorizationArea.mockReset(); });

it('liest Takt-Läufe nur mit Protokollrecht und lässt einen SQL-Fehler unbekannt', async () => {
  const auth = {tenantId: 'tenant-a'} as Parameters<typeof liesTaktLaeufe>[0];
  hasAuthorizationArea.mockReturnValueOnce(false).mockReturnValue(true);
  expect(await liesTaktLaeufe(auth, {})).toEqual({code: 'FORBIDDEN'});
  expect(transaction).not.toHaveBeenCalled();
  expect(await liesTaktLaeufe(auth, {limit: 0})).toEqual({code: 'VALIDATION_ERROR'});
  expect(transaction).not.toHaveBeenCalled();
  const row = {id: 'run-a', jobSchluessel: 'heute_neuaufbau', faelligFuer: '2026-11-25', gestartetUm: '2026-11-25T02:00:00Z', beendetUm: null, status: 'läuft', versuch: 1, fehlercode: null, dauerMs: null};
  transaction.mockImplementationOnce(async (_tenant, work) => work({execute: async () => [row]}));
  expect(await liesTaktLaeufe(auth, {limit: 1})).toEqual({code: 'OK', laeufe: [row]});
  transaction.mockRejectedValueOnce(Error('TEST_DB_ERROR'));
  expect(await liesTaktLaeufe(auth, {})).toEqual({code: 'SOURCE_INCOMPLETE'});
});

it('übernimmt die Mandantenliste ausschließlich vom Today-Kern', async () => {
  listeTodayMandanten.mockResolvedValue(['a', 'b']);
  expect(await liesTaktMandanten()).toEqual(['a', 'b']);
  expect(listeTodayMandanten).toHaveBeenCalledOnce();
  expect(transaction).not.toHaveBeenCalled();
});

it('löscht nur eigene alte Laufzeilen im Mandantenkontext', async () => {
  const execute = vi.fn().mockResolvedValue([]);
  transaction.mockImplementation(async (_tenant, work) => {
    expect(hasPageReadBudget()).toBe(true);
    return work({execute});
  });
  const eigeneLaufId = '11111111-1111-4111-8111-111111111111';
  await loescheAlteLaeufe('tenant-a', 0, eigeneLaufId);
  expect(transaction).toHaveBeenCalledWith({tenantId: 'tenant-a'}, expect.any(Function));
  expect(execute).toHaveBeenCalledOnce();
  const query = execute.mock.calls[0][0];
  const command = sqlText(query);
  expect(command).toContain('DELETE FROM public.takt_job_runs WHERE tenant_id=');
  expect(command).toContain('gestartet_um < statement_timestamp()');
  expect(command).toContain('AND id <>');
  expect(command).toContain('::uuid');
  expect(command).toContain("AND status<>'läuft'");
  expect(command).toContain("faellig_fuer=to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin'");
  expect(JSON.stringify(query)).toContain(eigeneLaufId);
});

it('weist ungültige Fristen vor jeder Datenbankarbeit ab', async () => {
  await expect(loescheAlteLaeufe('tenant-a', -1, '11111111-1111-4111-8111-111111111111')).rejects.toThrow('TAKT_RETENTION_SETTING_INVALID');
  await expect(loescheAlteLaeufe('tenant-a', 0, 'nicht-belegt')).rejects.toThrow('TAKT_RETENTION_SETTING_INVALID');
  expect(transaction).not.toHaveBeenCalled();
});

it('reserviert zuerst einmal und wiederholt nur dieselbe gescheiterte Zeile', async () => {
  const execute = vi.fn()
    .mockResolvedValueOnce([{id: 'first', versuch: 1}])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{id: 'first', versuch: 2}]);
  transaction.mockImplementation(async (_tenant, work) => work({execute}));
  expect(await reserviereLauf('tenant-a', 'heute_neuaufbau', '2026-11-25', 25_000)).toEqual({id: 'first', versuch: 1});
  expect(await reserviereLauf('tenant-a', 'heute_neuaufbau', '2026-11-25', 25_000)).toEqual({id: 'first', versuch: 2});
  expect(execute).toHaveBeenCalledTimes(3);
  const command = sqlText(execute.mock.calls[2][0]);
  expect(command).toContain("AND status IN ('fehler','abgebrochen')");
  expect(command).toContain('AND reserviert_bis<=statement_timestamp()');
  expect(command).not.toContain("OR status='läuft'");
  expect(command).toContain('versuch<4');
});

it('schließt einen abgelaufenen Versuch unter der Sperre ab und verwendet später dieselbe Zeile', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const execute = vi.fn()
    .mockResolvedValueOnce([]).mockResolvedValueOnce([])
    .mockResolvedValueOnce([{claimed: true}])
    .mockResolvedValueOnce([{id, versuch: 1, dauer: 25_000}]).mockResolvedValueOnce([{id}])
    .mockResolvedValueOnce([]).mockResolvedValueOnce([{id, versuch: 2}]);
  transaction.mockImplementation(async (_tenant, work) => work({execute}));
  const tenant = 'tenant-a', job = 'heute_neuaufbau', due = '2026-11-25';
  expect(await reserviereLauf(tenant, job, due, 25_000)).toBe(null);
  await expect(mitTaktLaufsperre(tenant, job, () => beendeAbgelaufenenLauf(tenant, job, due))).resolves.toBe(true);
  expect(await reserviereLauf(tenant, job, due, 25_000)).toEqual({id, versuch: 2});
  const queries = execute.mock.calls.map(([query]) => query);
  expect(sqlText(queries[2])).toContain('pg_try_advisory_xact_lock');
  expect(sqlText(queries[3])).toContain("status='läuft' AND reserviert_bis<=statement_timestamp() FOR UPDATE");
  expect(JSON.stringify(queries[4])).toContain('abgebrochen');
  expect(JSON.stringify(queries[4])).toContain(id);
  expect(sqlText(queries[6])).toContain('versuch=versuch+1');
});

it('gibt bei parallelem oder bereits beendetem Lauf keine zweite Reservierung aus', async () => {
  const execute = vi.fn().mockResolvedValue([]);
  transaction.mockImplementation(async (_tenant, work) => work({execute}));
  expect(await reserviereLauf('tenant-a', 'takt.nachholen', '2026-11-25T06:00', 25_000)).toBe(null);
  expect(execute).toHaveBeenCalledOnce();
  expect(sqlText(execute.mock.calls[0][0])).toContain('ON CONFLICT(tenant_id,job_schluessel,faellig_fuer) DO NOTHING');
});

it('schließt nur den eigenen Versuch ab und verliert keinen fehlenden Beleg', async () => {
  const execute = vi.fn().mockResolvedValueOnce([{id: 'receipt'}]).mockResolvedValueOnce([]);
  transaction.mockImplementation(async (_tenant, work) => work({execute}));
  const claim = {id: '11111111-1111-4111-8111-111111111111', versuch: 2};
  await expect(beendeLauf('tenant-a', claim, 'fehler', 120, 'takt_aufbewahrung')).resolves.toBeUndefined();
  await expect(beendeLauf('tenant-a', claim, 'fehler', 120, 'takt_aufbewahrung')).rejects.toThrow('TAKT_RESERVIERUNG_VERLOREN');
  expect(execute).toHaveBeenCalledTimes(2);
  const command = execute.mock.calls[0][0].queryChunks.map((part: {value?: string[]}) => part.value?.join('') ?? '').join('');
  expect(command).toContain("status='läuft' AND versuch=");
});

it('liest ausschließlich den letzten belegten Erfolg desselben Jobs und Mandanten', async () => {
  const execute = vi.fn().mockResolvedValueOnce([{faellig_fuer: '2026-11-24'}]).mockResolvedValueOnce([]);
  transaction.mockImplementation(async (_tenant, work) => work({execute}));
  expect(await liesLetztenOk('tenant-a', 'heute_neuaufbau')).toEqual('2026-11-24');
  expect(await liesLetztenOk('tenant-a', 'heute_neuaufbau')).toBe(null);
  expect(transaction).toHaveBeenCalledWith({tenantId: 'tenant-a'}, expect.any(Function));
  const command = execute.mock.calls[0][0].queryChunks.map((part: {value?: string[]}) => part.value?.join('') ?? '').join('');
  expect(command).toContain("status='ok' AND beendet_um IS NOT NULL");
  expect(command).toContain('ORDER BY faellig_fuer DESC LIMIT 1');
});

it('wertet eine fünfminütige Auffrischung nicht als täglichen Vollaufbau', async () => {
  const execute = vi.fn().mockResolvedValue([{faellig_fuer: '2026-11-25'}]);
  transaction.mockImplementation(async (_tenant, work) => work({execute}));
  await liesLetztenOk('tenant-a', 'heute_neuaufbau');
  expect(JSON.stringify(execute.mock.calls[0][0])).toContain("faellig_fuer NOT LIKE '%T%'");
});
