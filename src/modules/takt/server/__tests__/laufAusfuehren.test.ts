// @vitest-environment node
import {beforeEach, expect, it, vi} from 'vitest';
import type {TaktJob, TaktLeser} from '../../public';
import type {PackageSwitchId} from '@/modules/fundament/public';

const timeoutScope = vi.hoisted(() => vi.fn(async (_milliseconds:number,work:()=>Promise<unknown>) => work()));
vi.mock('@/lib/server/privilegedDb', () => ({withTaktStatementTimeout:timeoutScope}));

const ports = vi.hoisted(() => ({
  reserviereLauf: vi.fn(), beendeLauf: vi.fn(), loescheAlteLaeufe: vi.fn(),
  liesTaktMandanten: vi.fn(), liesLetztenOk: vi.fn(),
}));
vi.mock('../laeufe', () => ports);
const modelStale = vi.hoisted(() => vi.fn(async () => false));
vi.mock('@/lib/server/todayProjectionSchedule', () => ({liesTodayModellVeraltet: modelStale}));
const refresh = vi.hoisted(() => vi.fn(async () => 'ok' as const));
vi.mock('@/lib/today/taktJobs', () => ({fuehreHeuteAuffrischung: refresh}));
const testJobs = vi.hoisted(() => ({
  ausfuehren: vi.fn(async (tenantId: string) => { void tenantId; return 'ok' as const; }),
}));
vi.mock('../../jobs', () => ({
  TAKT_JOBS: [{schluessel: 'heute_neuaufbau', paket: null, fristMs: 25_000,
    faellig: (_jetzt: Date, letzterOk: Date | null) => letzterOk ? null : '2026-11-25', ausfuehren: testJobs.ausfuehren}],
  baueTaktLeser: () => ({protokollAufbewahrungTage: async () => 0}),
  bauePaketAktiv: () => async () => true,
}));
import {fuehreFaelligenJobAus} from '../lauf';
import {fuehreTaktAus, holeTaktNach} from '../runner';

const id = '11111111-1111-4111-8111-111111111111';
const leser: TaktLeser = {protokollAufbewahrungTage: vi.fn(async () => 0)};
const job = (schluessel: string, ausfuehren: TaktJob['ausfuehren'], paket: PackageSwitchId | null = null): TaktJob => ({
  schluessel, paket, fristMs: 25_000, faellig: () => '2026-11-25', ausfuehren,
});

beforeEach(() => {
  vi.clearAllMocks();
  modelStale.mockResolvedValue(false);
  ports.reserviereLauf.mockResolvedValue({id, versuch: 1});
  ports.beendeLauf.mockResolvedValue(undefined);
  ports.loescheAlteLaeufe.mockResolvedValue(undefined);
  ports.liesTaktMandanten.mockResolvedValue(['tenant-a', 'tenant-b']);
  ports.liesLetztenOk.mockResolvedValue(null);
});

it('frischt ein veraltetes Modell nur einmal je Berliner Fünfminutenfenster auf', async () => {
  modelStale.mockResolvedValue(true);
  await fuehreTaktAus({tenantId: 'tenant-a', jetzt: new Date('2026-11-25T05:07:00Z')});
  // The daily full build takes priority while it is due.
  expect(refresh).not.toHaveBeenCalled();
  ports.liesLetztenOk.mockResolvedValueOnce(new Date('2026-11-25T03:00:00Z'));
  testJobs.ausfuehren.mockClear();
  await fuehreTaktAus({tenantId: 'tenant-a', jetzt: new Date('2026-11-25T05:07:00Z')});
  expect(ports.reserviereLauf).toHaveBeenLastCalledWith('tenant-a', 'heute_neuaufbau', '2026-11-25T06:05', 25_000);
  expect(refresh).toHaveBeenCalledOnce();
  expect(testJobs.ausfuehren).not.toHaveBeenCalled();
});

it('läuft ohne Login über alle Mandanten der einzigen Today-Liste', async () => {
  expect(await fuehreTaktAus({jetzt: new Date('2026-11-25T05:00:00Z')})).toEqual({mandanten: 2, laeufe: 2, restOffen: false});
  expect(ports.liesTaktMandanten).toHaveBeenCalledOnce();
  expect(ports.reserviereLauf.mock.calls.map(call => call[0])).toEqual(['tenant-a', 'tenant-b']);
  expect(testJobs.ausfuehren.mock.calls.map(call => call[0])).toEqual(['tenant-a', 'tenant-b']);
});

it('stoppt nach dem Zeitbudget vor dem nächsten Mandanten, ohne dessen Lauf zu reservieren', async () => {
  let elapsed = 0;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => elapsed);
  testJobs.ausfuehren.mockImplementationOnce(async () => { elapsed = 60_000; return 'ok'; });
  try {
    expect(await fuehreTaktAus({budgetMs: 50_000})).toEqual({mandanten: 2, laeufe: 1, restOffen: true});
    expect(ports.reserviereLauf.mock.calls.map(call => call[0])).toEqual(['tenant-a']);
  } finally { clock.mockRestore(); }
});

it('reserviert das Nachholen vor jeder Arbeit und startet dieselbe Minute nur einmal', async () => {
  expect(await holeTaktNach('tenant-a')).toBe(true);
  expect(ports.reserviereLauf.mock.calls[0][1]).toBe('takt.nachholen');
  expect(ports.reserviereLauf.mock.calls[0][3]).toBe(25_000);
  expect(ports.beendeLauf).toHaveBeenCalledWith('tenant-a', {id, versuch: 1}, 'ok', expect.any(Number));
  testJobs.ausfuehren.mockClear();
  ports.reserviereLauf.mockResolvedValueOnce(null);
  expect(await holeTaktNach('tenant-a')).toBe(false);
  expect(testJobs.ausfuehren).not.toHaveBeenCalled();
});

it('hält den aktuellen Lauf bei null Tagen bis zum belegten Abschluss fest', async () => {
  const ausfuehren = vi.fn(async () => 'ok' as const);
  expect(await fuehreFaelligenJobAus('tenant-a', {job: job('protokoll_aufbewahrung', ausfuehren), faelligFuer: '2026-11-25'}, leser, async () => true)).toBe('ok');
  expect(ports.loescheAlteLaeufe).toHaveBeenCalledWith('tenant-a', 0, id);
  expect(ports.beendeLauf).toHaveBeenCalledWith('tenant-a', {id, versuch: 1}, 'ok', expect.any(Number), null);
  expect(ports.loescheAlteLaeufe.mock.invocationCallOrder[0]).toBeLessThan(ports.beendeLauf.mock.invocationCallOrder[0]);
  expect(timeoutScope).toHaveBeenCalledWith(25_000, expect.any(Function));
});

it('belegt den Löschfehler am selben Lauf, ohne einen Erfolg zu behaupten', async () => {
  ports.loescheAlteLaeufe.mockRejectedValueOnce(Error('TEST_SQL_FAILURE'));
  expect(await fuehreFaelligenJobAus('tenant-a', {job: job('protokoll_aufbewahrung', async () => 'ok'), faelligFuer: '2026-11-25'}, leser, async () => true)).toBe('fehler');
  expect(ports.beendeLauf).toHaveBeenCalledWith('tenant-a', {id, versuch: 1}, 'fehler', expect.any(Number), 'takt_aufbewahrung');
});

it('wertet einen Lesefehler der Aufbewahrungseinstellung nie als null Tage', async () => {
  const leseFehler: TaktLeser = {protokollAufbewahrungTage: vi.fn(async () => {throw Error('TEST_SETTINGS_UNAVAILABLE');})};
  const ausfuehren = vi.fn(async () => 'ok' as const);
  const faellig = {job: job('protokoll_aufbewahrung', ausfuehren), faelligFuer: '2026-11-25'};
  expect(await fuehreFaelligenJobAus('tenant-a', faellig, leseFehler, async () => true)).toBe('fehler');
  expect(ausfuehren).toHaveBeenCalledOnce();
  expect(ports.loescheAlteLaeufe).not.toHaveBeenCalled();
  expect(ports.beendeLauf).toHaveBeenCalledWith('tenant-a', {id, versuch: 1}, 'fehler', expect.any(Number), 'takt_ausfuehrung');
});

it('legt nur einen technischen Fehlercode ab und kann denselben Fälligkeitsbeleg später wiederholen', async () => {
  const faellig = {job: job('heute_neuaufbau', async () => { throw Error('TEST_SECRET_DETAILS'); }), faelligFuer: '2026-11-25'};
  expect(await fuehreFaelligenJobAus('tenant-a', faellig, leser, async () => true)).toBe('fehler');
  expect(ports.beendeLauf).toHaveBeenCalledWith('tenant-a', {id, versuch: 1}, 'fehler', expect.any(Number), 'takt_ausfuehrung');
  expect(ports.reserviereLauf).toHaveBeenCalledWith('tenant-a', 'heute_neuaufbau', '2026-11-25', 25_000);
});

it('belegt eine überschrittene Jobfrist als abgebrochen', async () => {
  const langsam = {...job('heute_neuaufbau', async () => {
    await new Promise(resolve => setTimeout(resolve, 30));
    return 'ok';
  }), fristMs: 5};
  expect(await fuehreFaelligenJobAus('tenant-a', {job: langsam, faelligFuer: '2026-11-25'}, leser, async () => true)).toBe('abgebrochen');
  expect(ports.beendeLauf).toHaveBeenCalledWith('tenant-a', {id, versuch: 1}, 'abgebrochen', expect.any(Number), null);
  expect(timeoutScope).toHaveBeenCalledWith(5, expect.any(Function));
});

it('führt einen abgeschalteten Paketjob nicht aus und legt keinen zweiten Lauf an', async () => {
  const ausfuehren = vi.fn(async () => 'ok' as const);
  const faellig = {job: job('lager_job', ausfuehren, 'p4_lager'), faelligFuer: '2026-11-25'};
  expect(await fuehreFaelligenJobAus('tenant-a', faellig, leser, async () => false)).toBe('übersprungen');
  expect(ausfuehren).not.toHaveBeenCalled();
  expect(ports.beendeLauf).toHaveBeenCalledWith('tenant-a', {id, versuch: 1}, 'übersprungen', expect.any(Number), null);
  ports.reserviereLauf.mockResolvedValueOnce(null);
  expect(await fuehreFaelligenJobAus('tenant-a', faellig, leser, async () => true)).toBe('nicht_reserviert');
  expect(ausfuehren).not.toHaveBeenCalled();
});

it('belegt einen Fehler des Paketlesers, ohne den Fachjob auszuführen', async () => {
  const ausfuehren = vi.fn(async () => 'ok' as const);
  const faellig = {job: job('lager_job', ausfuehren, 'p4_lager'), faelligFuer: '2026-11-25'};
  expect(await fuehreFaelligenJobAus('tenant-a', faellig, leser, async () => {throw Error('TEST_SWITCH_UNAVAILABLE');})).toBe('fehler');
  expect(ausfuehren).not.toHaveBeenCalled();
  expect(ports.beendeLauf).toHaveBeenCalledWith('tenant-a', {id, versuch: 1}, 'fehler', expect.any(Number), 'takt_paket_lesen');
});
