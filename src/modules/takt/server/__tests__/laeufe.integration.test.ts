// @vitest-environment node
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {afterAll, expect, it, vi} from 'vitest';
import {berlinCalendarDay, taeglichFaelligAb} from '@/lib/domain/workingDays';
import {bauePaketAktiv, TAKT_JOBS} from '../../jobs';
import type {TaktJob} from '../../public';
import {beendeAbgelaufenenLauf, beendeLauf, liesLetztenOk, liesOffeneWiederholungen, loescheAlteLaeufe, mitTaktLaufsperre, reserviereLauf, TAKT_NACHHOLEN} from '../laeufe';
import {fuehreFaelligenJobAus, nachholMinuteBerlin} from '../lauf';
import {configurePageReadBudget} from '@/db/readBudget';
import {sql as statement} from 'drizzle-orm';
import {withPrivilegedTenantTransaction, withTaktStatementTimeout} from '@/lib/server/privilegedDb';

const database = process.env.DATABASE_URL;
const port = process.env.GITHUB_ACTIONS === 'true' ? '54322' : '54342';
if (!database || database !== process.env.H18_EXPECTED_DATABASE_URL ||
    new URL(database).hostname !== '127.0.0.1' || new URL(database).port !== port ||
    new URL(database).pathname !== '/postgres') throw Error('TAKT_DEDICATED_LOOPBACK_REQUIRED');

const sql = postgres(database, {max: 2, prepare: false});
const tenant = `TEST-ablauf-takt-${randomUUID()}`;
const catchupTenant = `${tenant}-nachholen`;
const minute = '2026-11-25T10:00+01:00';

afterAll(async () => {
  try {
    await sql`DELETE FROM public.takt_job_runs WHERE tenant_id IN (${tenant},${catchupTenant})`;
  } finally {
    await sql.end({timeout: 5});
  }
});

it('reserviert denselben Mandanten und dieselbe Minute parallel genau einmal', async () => {
  const [rechte] = await sql`
    SELECT has_table_privilege('anon','public.takt_job_runs','SELECT') AS anon,
      has_table_privilege('authenticated','public.takt_job_runs','SELECT') AS angemeldet,
      has_table_privilege('service_role','public.takt_job_runs','INSERT') AS dienst,
      relrowsecurity AS rls, relforcerowsecurity AS erzwungen
    FROM pg_class WHERE oid='public.takt_job_runs'::regclass`;
  expect(rechte).toEqual({anon: false, angemeldet: false, dienst: true, rls: true, erzwungen: true});

  const schluessel = 'takt.test_parallel';
  const results = await Promise.all([
    reserviereLauf(tenant, schluessel, minute, 25_000),
    reserviereLauf(tenant, schluessel, minute, 25_000),
  ]);
  const reservierung = results.find(result => result !== null);
  expect(results.filter(Boolean)).toHaveLength(1);
  if (!reservierung) throw Error('TAKT_TEST_RESERVIERUNG_FEHLT');
  expect(await sql`SELECT id::text,status,versuch FROM public.takt_job_runs
    WHERE tenant_id=${tenant} AND job_schluessel=${schluessel} AND faellig_fuer=${minute}`)
    .toEqual([{id: reservierung.id, status: 'läuft', versuch: 1}]);

  await sql`UPDATE public.takt_job_runs SET reserviert_bis=statement_timestamp()-interval '1 second'
    WHERE id=${reservierung.id}::uuid AND tenant_id=${tenant}`;
  await expect(reserviereLauf(tenant, schluessel, minute, 25_000)).resolves.toBeNull();
  await expect(mitTaktLaufsperre(tenant, schluessel, () => beendeAbgelaufenenLauf(tenant, schluessel, minute))).resolves.toBe(true);
  expect(await sql`SELECT id::text,status,versuch,fehlercode FROM public.takt_job_runs
    WHERE tenant_id=${tenant} AND job_schluessel=${schluessel} AND faellig_fuer=${minute}`)
    .toEqual([{id: reservierung.id, status: 'abgebrochen', versuch: 1, fehlercode: null}]);
  await expect(reserviereLauf(tenant, schluessel, minute, 25_000)).resolves.toBeNull();
});

it('hält das Nachholen in der Berliner Minute einmalig und schließt abgelaufene Arbeit', async () => {
  const jetzt = new Date();
  const due = nachholMinuteBerlin(jetzt);
  const reservierungen = await Promise.all([
    reserviereLauf(catchupTenant, TAKT_NACHHOLEN, due, 25_000),
    reserviereLauf(catchupTenant, TAKT_NACHHOLEN, due, 25_000),
  ]);
  expect(reservierungen.filter(Boolean)).toHaveLength(1);
  const nachholen = reservierungen.find(r => r !== null);
  const aufbewahrung = await reserviereLauf(catchupTenant, 'protokoll_aufbewahrung', due.slice(0,10), 25_000);
  if (!nachholen || !aufbewahrung) throw Error('TEST_TAKT_RESERVIERUNG_FEHLT');
  const alt = await reserviereLauf(catchupTenant, TAKT_NACHHOLEN, nachholMinuteBerlin(new Date(jetzt.getTime()-120_000)), 25_000);
  if (!alt) throw Error('TEST_TAKT_RESERVIERUNG_FEHLT');
  await sql`UPDATE public.takt_job_runs SET reserviert_bis=statement_timestamp()-interval '1 second'
    WHERE tenant_id=${catchupTenant} AND id=${alt.id}::uuid`;
  await beendeLauf(catchupTenant, nachholen, 'abgebrochen', 1);
  await loescheAlteLaeufe(catchupTenant, 1, aufbewahrung.id);
  expect(await sql`SELECT status, beendet_um IS NOT NULL AS abgeschlossen, reserviert_bis
    FROM public.takt_job_runs WHERE tenant_id=${catchupTenant} AND id=${alt.id}::uuid`)
    .toEqual([{status:'abgebrochen',abgeschlossen:true,reserviert_bis:null}]);
  await loescheAlteLaeufe(catchupTenant, 0, aufbewahrung.id);
  await expect(reserviereLauf(catchupTenant, TAKT_NACHHOLEN, due, 25_000)).resolves.toBeNull();
  expect(await sql`SELECT id::text,status,versuch FROM public.takt_job_runs
    WHERE tenant_id=${catchupTenant} AND job_schluessel=${TAKT_NACHHOLEN}`)
    .toEqual([{id:nachholen.id,status:'abgebrochen',versuch:1}]);
});

it('reserviert beide Berliner Herbst-Minuten und jede physische Ausführung nur einmal', async () => {
  const winter = nachholMinuteBerlin(new Date('2026-10-25T01:30:00Z'));
  const sommer = nachholMinuteBerlin(new Date('2026-10-25T00:30:00Z'));
  const job = 'takt.test_herbstminute';
  expect(await reserviereLauf(tenant, job, sommer, 25_000)).toMatchObject({versuch: 1});
  expect(await reserviereLauf(tenant, job, winter, 25_000)).toMatchObject({versuch: 1});
  expect(await reserviereLauf(tenant, job, sommer, 25_000)).toBeNull();
  expect(await sql`SELECT faellig_fuer,status FROM public.takt_job_runs WHERE tenant_id=${tenant} AND job_schluessel=${job} ORDER BY faellig_fuer`)
    .toEqual([{faellig_fuer:winter,status:'läuft'},{faellig_fuer:sommer,status:'läuft'}]);
  expect((await liesOffeneWiederholungen(tenant, [job])).map(row=>row.faelligFuer)).toEqual([sommer,winter]);
});

it('begrenzt native SQL auch wenn der Projektor mehr Zeit einstellt', async () => {
  const lesen = () => withPrivilegedTenantTransaction({tenantId:tenant}, async tx => {
    const [row] = await tx.execute<{ms:number}>(statement`SELECT setting::int AS ms FROM pg_settings WHERE name='statement_timeout'`);
    return row.ms;
  });
  const vorher = await lesen();
  const begrenzt = await withTaktStatementTimeout(1500, () => {
    configurePageReadBudget(25_000);
    return lesen();
  });
  expect(begrenzt).toBeGreaterThan(0);
  expect(begrenzt).toBeLessThanOrEqual(1500);
  expect(await lesen()).toBe(vorher);
});

it('wiederholt denselben fehlgeschlagenen Lauf erst nach einer Minute', async () => {
  const job: TaktJob = {
    schluessel: 'takt.test_wiederholung', paket: null, fristMs: 5_000,
    faellig: () => minute,
    ausfuehren: vi.fn<TaktJob['ausfuehren']>()
      .mockRejectedValueOnce(Error('TEST_TAKT_ERSTER_VERSUCH'))
      .mockResolvedValueOnce('ok'),
  };
  const ausfuehren = () => fuehreFaelligenJobAus(
    tenant, {job, faelligFuer: minute}, {protokollAufbewahrungTage: async () => null}, async () => true,
  );
  const davor = Date.now();
  await expect(ausfuehren()).resolves.toBe('fehler');
  const danach = Date.now();
  const [fehlgeschlagen] = await sql<{id: string; status: string; versuch: number; erneutMs: number}[]>`
    SELECT id::text,status,versuch,(extract(epoch FROM reserviert_bis)*1000)::double precision AS "erneutMs"
    FROM public.takt_job_runs WHERE tenant_id=${tenant} AND job_schluessel=${job.schluessel}`;
  expect(fehlgeschlagen).toMatchObject({status: 'fehler', versuch: 1});
  expect(fehlgeschlagen.erneutMs).toBeGreaterThanOrEqual(davor + 60_000);
  expect(fehlgeschlagen.erneutMs).toBeLessThanOrEqual(danach + 60_000);
  await expect(ausfuehren()).resolves.toBe('nicht_reserviert');
  expect(job.ausfuehren).toHaveBeenCalledOnce();

  // Age the isolated fixture past the recorded retry deadline without changing the database clock.
  await sql`UPDATE public.takt_job_runs
    SET gestartet_um=gestartet_um-interval '61 seconds', beendet_um=beendet_um-interval '61 seconds',
      reserviert_bis=reserviert_bis-interval '61 seconds'
    WHERE tenant_id=${tenant} AND id=${fehlgeschlagen.id}::uuid`;
  await expect(ausfuehren()).resolves.toBe('ok');
  expect(job.ausfuehren).toHaveBeenCalledTimes(2);
  expect(await sql`SELECT id::text,status,versuch,fehlercode FROM public.takt_job_runs
    WHERE tenant_id=${tenant} AND job_schluessel=${job.schluessel}`)
    .toEqual([{id: fehlgeschlagen.id, status: 'ok', versuch: 2, fehlercode: null}]);
});

it('führt ein abgeschaltetes Paket und ein Paket mit Lesefehler nie aus', async () => {
  const ausfuehren = vi.fn(async () => 'ok' as const);
  const job = {schluessel: 'takt.test_paket', paket: 'p4_lager', fristMs: 5_000,
    faellig: () => minute, ausfuehren} satisfies TaktJob;
  const leser = {protokollAufbewahrungTage: async () => null};
  await expect(fuehreFaelligenJobAus(tenant, {job, faelligFuer: minute}, leser, bauePaketAktiv(tenant)))
    .resolves.toBe('übersprungen');

  // Injiziert wird ein echter TEST-SQL-Lesefehler an der vorhandenen Lesenaht.
  let leseFehler: unknown;
  const paketLesefehler = bauePaketAktiv(tenant, async () => {
    try {
      await sql`SELECT 1/0`;
    } catch (error) {
      leseFehler = error;
      throw error;
    }
    throw Error('TAKT_TEST_SQL_ERROR_NOT_RAISED');
  });
  await expect(fuehreFaelligenJobAus(tenant, {job, faelligFuer: '2026-11-25T10:01'}, leser, paketLesefehler))
    .resolves.toBe('fehler');
  expect(ausfuehren).not.toHaveBeenCalled();
  expect(leseFehler).toMatchObject({code: '22012'});
  expect(await sql`SELECT status,fehlercode FROM public.takt_job_runs
    WHERE tenant_id=${tenant} AND job_schluessel=${job.schluessel} ORDER BY faellig_fuer`)
    .toEqual([{status: 'übersprungen', fehlercode: null}, {status: 'fehler', fehlercode: 'takt_paket_lesen'}]);
});

it('zählt einen nach Mitternacht abgeschlossenen Versuch für seinen ursprünglichen Berliner Termin', async () => {
  const schluessel = 'takt.test_abschluss';
  const [{heute, gestern}] = await sql<{heute: string; gestern: string}[]>`
    SELECT (statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date::text AS heute,
      ((statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1)::text AS gestern`;
  const reservierung = await reserviereLauf(tenant, schluessel, gestern, 5_000);
  if (!reservierung) throw Error('TAKT_TEST_RESERVIERUNG_FEHLT');
  await beendeLauf(tenant, reservierung, 'ok', 1);

  const [tag] = await sql<{datum: string}[]>`
    SELECT ((beendet_um AT TIME ZONE 'Europe/Berlin')::date)::text AS datum
    FROM public.takt_job_runs WHERE tenant_id=${tenant} AND id=${reservierung.id}::uuid`;
  expect(tag.datum).toBe(heute);
  const letzterTermin = await liesLetztenOk(tenant, schluessel);
  expect(letzterTermin && berlinCalendarDay(letzterTermin)).toBe(gestern);
  expect(taeglichFaelligAb(new Date(`${heute}T12:00:00Z`), letzterTermin, '03:00')).toBe(heute);
});

it('räumt bei 0 Tagen alte Takt-Läufe auf und belegt den aktuellen Abschluss', async () => {
  const testTenant = `TEST-ablauf-takt-0tage-${randomUUID()}`;
  const job = TAKT_JOBS.find(eintrag => eintrag.schluessel === 'protokoll_aufbewahrung');
  if (!job) throw Error('TAKT_TEST_AUFBEWAHRUNGSJOB_FEHLT');
  try {
    const alt = await reserviereLauf(testTenant, 'takt.test_alt', '2026-11-24', 5_000);
    if (!alt) throw Error('TAKT_TEST_RESERVIERUNG_FEHLT');
    await beendeLauf(testTenant, alt, 'ok', 1);

    // PL 25.11. 13:58: 0 is a TEST-only job input, never a setting value.
    const leser = {protokollAufbewahrungTage: async () => 0};
    await expect(fuehreFaelligenJobAus(testTenant, {job, faelligFuer: '2026-11-25'}, leser, bauePaketAktiv(testTenant)))
      .resolves.toBe('ok');
    expect(await sql`
      SELECT job_schluessel, status, beendet_um IS NOT NULL AS abgeschlossen
      FROM public.takt_job_runs WHERE tenant_id=${testTenant}`)
      .toEqual([{job_schluessel: 'protokoll_aufbewahrung', status: 'ok', abgeschlossen: true}]);
  } finally {
    await sql`DELETE FROM public.takt_job_runs WHERE tenant_id=${testTenant}`;
  }
});
