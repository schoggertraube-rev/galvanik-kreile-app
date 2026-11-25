// @vitest-environment node
import {beforeEach, expect, it, vi} from 'vitest';

const transaction = vi.hoisted(() => vi.fn());
const listeTodayMandanten = vi.hoisted(() => vi.fn());
const hasAuthorizationArea = vi.hoisted(() => vi.fn());
vi.mock('@/lib/server/privilegedDb', () => ({withPrivilegedTenantTransaction: transaction}));
vi.mock('@/lib/server/todayProjectionSchedule', () => ({listeTodayMandanten}));
vi.mock('@/lib/server/authorization', () => ({hasAuthorizationArea}));

import {beendeLauf, liesLetztenOk, liesTaktLaeufe, liesTaktMandanten, loescheAlteLaeufe, reserviereLauf} from '../laeufe';

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
  transaction.mockImplementation(async (_tenant, work) => work({execute}));
  const eigeneLaufId = '11111111-1111-4111-8111-111111111111';
  await loescheAlteLaeufe('tenant-a', 0, eigeneLaufId);
  expect(transaction).toHaveBeenCalledWith({tenantId: 'tenant-a'}, expect.any(Function));
  const commands = execute.mock.calls.map(([query]) => query.queryChunks.map((part: {value?: string[]}) => part.value?.join('') ?? '').join(''));
  expect(commands.join('\n')).toContain('DELETE FROM public.takt_job_runs WHERE tenant_id=');
  expect(commands.join('\n')).toContain('gestartet_um < statement_timestamp()');
  expect(commands.join('\n')).toContain('AND id <>');
  expect(commands.join('\n')).toContain('::uuid');
  expect(JSON.stringify(execute.mock.calls[1][0])).toContain(eigeneLaufId);
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
  const command = execute.mock.calls[2][0].queryChunks.map((part: {value?: string[]}) => part.value?.join('') ?? '').join('');
  expect(command).toContain("(status IN ('fehler','abgebrochen') OR status='läuft')");
  expect(command).toContain('versuch<4');
});

it('beansprucht eine abgelaufene laufende Reservierung erneut mit höherem Versuch', async () => {
  const execute = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{id: 'orphan', versuch: 2}]);
  transaction.mockImplementation(async (_tenant, work) => work({execute}));
  expect(await reserviereLauf('tenant-a', 'heute_neuaufbau', '2026-11-25', 25_000)).toEqual({id: 'orphan', versuch: 2});
  const command = execute.mock.calls[1][0].queryChunks.map((part: {value?: string[]}) => part.value?.join('') ?? '').join('');
  expect(command).toContain("status='läuft'");
  expect(command).toContain('reserviert_bis<statement_timestamp()');
  expect(command).toContain('versuch=versuch+1');
});

it('gibt bei parallelem oder bereits beendetem Lauf keine zweite Reservierung aus', async () => {
  const execute = vi.fn().mockResolvedValue([]);
  transaction.mockImplementation(async (_tenant, work) => work({execute}));
  expect(await reserviereLauf('tenant-a', 'takt.nachholen', '2026-11-25T06:00', 25_000)).toBe(null);
  expect(execute).toHaveBeenCalledTimes(2);
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
  const beendetUm = new Date('2026-11-25T04:00:00Z');
  const execute = vi.fn().mockResolvedValueOnce([{beendet_ms: beendetUm.getTime()}]).mockResolvedValueOnce([]);
  transaction.mockImplementation(async (_tenant, work) => work({execute}));
  expect(await liesLetztenOk('tenant-a', 'heute_neuaufbau')).toEqual(beendetUm);
  expect(await liesLetztenOk('tenant-a', 'heute_neuaufbau')).toBe(null);
  expect(transaction).toHaveBeenCalledWith({tenantId: 'tenant-a'}, expect.any(Function));
  const command = execute.mock.calls[0][0].queryChunks.map((part: {value?: string[]}) => part.value?.join('') ?? '').join('');
  expect(command).toContain("status='ok' AND beendet_um IS NOT NULL");
  expect(command).toContain('ORDER BY beendet_um DESC LIMIT 1');
});

it('wertet eine fünfminütige Auffrischung nicht als täglichen Vollaufbau', async () => {
  const execute = vi.fn().mockResolvedValue([{beendet_ms: Date.parse('2026-11-25T04:00:00Z')}]);
  transaction.mockImplementation(async (_tenant, work) => work({execute}));
  await liesLetztenOk('tenant-a', 'heute_neuaufbau', true);
  expect(JSON.stringify(execute.mock.calls[0][0])).toContain("faellig_fuer NOT LIKE '%T%'");
});
