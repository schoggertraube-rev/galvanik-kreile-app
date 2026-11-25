// @vitest-environment node
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {afterAll, expect, it, vi} from 'vitest';
import {taeglichFaelligAb} from '@/lib/domain/workingDays';
import {bauePaketAktiv, TAKT_JOBS} from '../../jobs';
import type {TaktJob} from '../../public';
import {beendeLauf, liesLetztenOk, reserviereLauf} from '../laeufe';
import {fuehreFaelligenJobAus} from '../lauf';

const database = process.env.DATABASE_URL;
const port = process.env.GITHUB_ACTIONS === 'true' ? '54322' : '54342';
if (!database || database !== process.env.H18_EXPECTED_DATABASE_URL ||
    new URL(database).hostname !== '127.0.0.1' || new URL(database).port !== port ||
    new URL(database).pathname !== '/postgres') throw Error('TAKT_DEDICATED_LOOPBACK_REQUIRED');

const sql = postgres(database, {max: 2, prepare: false});
const tenant = `TEST-ablauf-takt-${randomUUID()}`;
const minute = '2026-11-25T10:00';

afterAll(async () => {
  try {
    await sql`DELETE FROM public.takt_job_runs WHERE tenant_id=${tenant}`;
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
  await expect(reserviereLauf(tenant, schluessel, minute, 25_000))
    .resolves.toEqual({id: reservierung.id, versuch: 2});
  expect(await sql`SELECT id::text,status,versuch FROM public.takt_job_runs
    WHERE tenant_id=${tenant} AND job_schluessel=${schluessel} AND faellig_fuer=${minute}`)
    .toEqual([{id: reservierung.id, status: 'läuft', versuch: 2}]);
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

it('liest einen echten Abschluss als Datum mit Berliner Tagesgrenze', async () => {
  const schluessel = 'takt.test_abschluss';
  const reservierung = await reserviereLauf(tenant, schluessel, '2026-11-25', 5_000);
  if (!reservierung) throw Error('TAKT_TEST_RESERVIERUNG_FEHLT');
  await beendeLauf(tenant, reservierung, 'ok', 1);

  const beendetUm = await liesLetztenOk(tenant, schluessel);
  expect(beendetUm).toBeInstanceOf(Date);
  if (!beendetUm) throw Error('TAKT_TEST_ABSCHLUSS_FEHLT');
  const [row] = await sql<{millis: number}[]>`
    SELECT (extract(epoch FROM beendet_um)*1000)::double precision AS millis
    FROM public.takt_job_runs WHERE tenant_id=${tenant} AND id=${reservierung.id}::uuid`;
  expect(beendetUm.getTime()).toBe(Math.trunc(row.millis));
  const [tag] = await sql<{datum: string}[]>`
    SELECT ((beendet_um AT TIME ZONE 'Europe/Berlin')::date)::text AS datum
    FROM public.takt_job_runs WHERE tenant_id=${tenant} AND id=${reservierung.id}::uuid`;
  expect(taeglichFaelligAb(new Date(`${tag.datum}T12:00:00Z`), beendetUm, '03:00')).toBeNull();
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
