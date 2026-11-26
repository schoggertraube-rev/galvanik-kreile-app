import 'server-only';
import {sql} from 'drizzle-orm';
import {outsidePageReadBudget} from '@/db/readBudget';
import {withPrivilegedTenantTransaction, withTaktStatementTimeout, type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {hasAuthorizationArea, type AuthorizationSnapshot} from '@/lib/server/authorization';
import {TAKT_BUDGET_MS, TAKT_RETENTION_BUDGET_MS} from '../public';
import {naechsteReservierung} from './wiederholung';

export type LaufReservierung = Readonly<{id: string; versuch: number}>;
export type LaufAbschluss = 'ok' | 'fehler' | 'abgebrochen' | 'übersprungen';
export const TAKT_NACHHOLEN = 'takt.nachholen';
export type TaktLaufZeile = Readonly<{
  id: string; jobSchluessel: string; faelligFuer: string; gestartetUm: string;
  beendetUm: string | null; status: string; versuch: number; fehlercode: string | null; dauerMs: number | null;
}>;

/** The existing Today tenant register is the sole source for cron fan-out. */
export async function liesTaktMandanten(): Promise<string[]> {
  const {listeTodayMandanten}=await import('@/lib/server/todayProjectionSchedule');
  return listeTodayMandanten();
}

/** Keep the same tenant/job exclusive until the native work has settled. */
export async function mitTaktLaufsperre<T>(
  tenantId: string, schluessel: string, work: () => Promise<T>,
  grenzen?: Readonly<{budgetMs:number;signal?:AbortSignal}>,
): Promise<T | null> {
  const halten = () => withPrivilegedTenantTransaction({tenantId}, async tx => {
    const [lock] = await tx.execute<{claimed: boolean}>(sql`
      SELECT pg_try_advisory_xact_lock(hashtextextended('takt:'||${tenantId}||':'||${schluessel},0)) AS claimed`);
    // Work uses the remaining budget independently. Keep this lock until its
    // transaction and durable completion have finished, including on abort.
    return lock?.claimed ? await outsidePageReadBudget(work) : null;
  });
  return grenzen ? withTaktStatementTimeout(grenzen.budgetMs, halten, grenzen.signal) : halten();
}

/** Close a timed-out attempt only after obtaining its tenant/job lock. */
export async function beendeAbgelaufenenLauf(tenantId: string, schluessel: string, faelligFuer: string): Promise<boolean> {
  return withPrivilegedTenantTransaction({tenantId}, async tx => {
    const [abgelaufen] = await tx.execute<LaufReservierung & {dauer: number}>(sql`
      SELECT id::text,versuch,LEAST(2147483647,GREATEST(0,FLOOR(EXTRACT(epoch FROM statement_timestamp()-gestartet_um)*1000)))::integer AS dauer
      FROM public.takt_job_runs WHERE tenant_id=${tenantId} AND job_schluessel=${schluessel} AND faellig_fuer=${faelligFuer}
        AND status='läuft' AND reserviert_bis<=statement_timestamp() FOR UPDATE`);
    if (!abgelaufen) return false;
    await schreibeLaufabschluss(tx, tenantId, abgelaufen, 'abgebrochen', abgelaufen.dauer, null);
    return true;
  });
}

/** Keep the original due key when retrying, including after the next day starts. */
export async function liesOffeneWiederholungen(tenantId: string, schluessel: readonly string[]) {
  if (!schluessel.length) return [];
  return withPrivilegedTenantTransaction({tenantId}, async tx => [...await tx.execute<{schluessel: string; faelligFuer: string; bereit: boolean}>(sql`
    SELECT job_schluessel AS schluessel,faellig_fuer AS "faelligFuer",reserviert_bis<=statement_timestamp() AS bereit
    FROM public.takt_job_runs
    WHERE tenant_id=${tenantId} AND job_schluessel IN (${sql.join(schluessel.map(key=>sql`${key}`),sql`, `)})
      AND faellig_fuer NOT LIKE 'hand:%'
      AND length(faellig_fuer) IN (10,22)
      AND reserviert_bis IS NOT NULL AND (status='läuft' OR (status IN ('fehler','abgebrochen') AND versuch<4))
    ORDER BY CASE WHEN length(faellig_fuer)=10 THEN faellig_fuer::date::timestamp AT TIME ZONE 'Europe/Berlin'
      ELSE faellig_fuer::timestamptz END,job_schluessel`)]);
}

const erfolgreicherTageslauf = sql`status='ok' AND beendet_um IS NOT NULL AND length(faellig_fuer)=10`;

/** Ein nach Mitternacht beendeter Tageslauf bleibt dem ursprünglichen Termin zugeordnet. */
export async function liesLetztenOk(tenantId: string, schluessel: string): Promise<Date | null> {
  if (!tenantId || !/^[a-z][a-z0-9_.]{1,79}$/.test(schluessel)) throw Error('TAKT_LETZTER_OK_INVALID');
  return withPrivilegedTenantTransaction({tenantId}, async tx => {
    const rows = await tx.execute<{faellig_ms: number}>(sql`
      SELECT (EXTRACT(epoch FROM (faellig_fuer::date::timestamp AT TIME ZONE 'Europe/Berlin'))*1000)::double precision AS faellig_ms
      FROM public.takt_job_runs
      WHERE tenant_id=${tenantId} AND job_schluessel=${schluessel} AND (${erfolgreicherTageslauf})
      ORDER BY faellig_fuer DESC LIMIT 1`);
    const row = rows[0];
    if (!row) return null;
    if (!Number.isFinite(row.faellig_ms)) throw Error('TAKT_LETZTER_OK_ZEIT_INVALID');
    return new Date(row.faellig_ms);
  });
}

export type TaktLaufstand = Readonly<{
  schluessel: string;
  letzterErfolgMs: number | null;
  letzterTageserfolgMs: number | null;
  letzterAbschluss: 'ok' | 'fehler' | 'abgebrochen' | null;
  letzterAbschlussMs: number | null;
}>;

/** Der Kalendertag bestimmt die Fälligkeit. Für das Alter zählt der tatsächliche Abschluss. */
export async function liesTaktLaufstaendeInTransaction(
  tx: PrivilegedTenantTransaction, tenantId: string, schluessel: readonly string[],
): Promise<ReadonlyArray<TaktLaufstand>> {
  if (schluessel.length === 0) return [];
  return tx.execute<TaktLaufstand>(sql`
    SELECT job.schluessel,
      (EXTRACT(epoch FROM erfolg.beendet_um)*1000)::double precision AS "letzterErfolgMs",
      (EXTRACT(epoch FROM (erfolg.tag::date::timestamp AT TIME ZONE 'Europe/Berlin'))*1000)::double precision AS "letzterTageserfolgMs",
      zuletzt.status AS "letzterAbschluss",
      (EXTRACT(epoch FROM zuletzt.beendet_um)*1000)::double precision AS "letzterAbschlussMs"
    FROM unnest(ARRAY[${sql.join(schluessel.map(key => sql`${key}`),sql`, `)}]::text[]) AS job(schluessel)
    LEFT JOIN LATERAL (
      SELECT MAX(beendet_um) AS beendet_um, MAX(faellig_fuer) FILTER (WHERE ${erfolgreicherTageslauf}) AS tag
      FROM public.takt_job_runs
      WHERE tenant_id=${tenantId} AND job_schluessel=job.schluessel AND status='ok' AND beendet_um IS NOT NULL
    ) erfolg ON true
    LEFT JOIN LATERAL (
      SELECT status,beendet_um FROM public.takt_job_runs
      WHERE tenant_id=${tenantId} AND job_schluessel=job.schluessel AND status IN ('ok','fehler','abgebrochen') AND beendet_um IS NOT NULL
      ORDER BY beendet_um DESC,id DESC LIMIT 1
    ) zuletzt ON true`);
}

/** S45 reads the one immutable run source; permission is checked before any SQL. */
export async function liesTaktLaeufe(auth: AuthorizationSnapshot, filter: Readonly<{
  von?: string; bis?: string; limit?: number;
}>): Promise<{code: 'OK'; laeufe: TaktLaufZeile[]} | {code: 'FORBIDDEN' | 'VALIDATION_ERROR' | 'SOURCE_INCOMPLETE'}> {
  if (!hasAuthorizationArea(auth, 'protokoll')) return {code: 'FORBIDDEN'};
  if (!filter || typeof filter !== 'object' ||
      filter.von !== undefined && !Number.isFinite(Date.parse(filter.von)) ||
      filter.bis !== undefined && !Number.isFinite(Date.parse(filter.bis)) ||
      filter.limit !== undefined && (!Number.isSafeInteger(filter.limit) || filter.limit < 1 || filter.limit > 500) ||
      filter.von !== undefined && filter.bis !== undefined && Date.parse(filter.von) > Date.parse(filter.bis)) {
    return {code: 'VALIDATION_ERROR'};
  }
  try {
    const laeufe = await withPrivilegedTenantTransaction(auth, async tx => {
      const rows = await tx.execute<TaktLaufZeile>(sql`
        SELECT id::text,job_schluessel AS "jobSchluessel",faellig_fuer::text AS "faelligFuer",
          gestartet_um::text AS "gestartetUm",beendet_um::text AS "beendetUm",status,versuch,
          fehlercode,dauer_ms AS "dauerMs"
        FROM public.takt_job_runs WHERE tenant_id=${auth.tenantId}
        ${filter.von ? sql`AND gestartet_um>=${filter.von}::timestamptz` : sql``}
        ${filter.bis ? sql`AND gestartet_um<=${filter.bis}::timestamptz` : sql``}
        ORDER BY gestartet_um DESC,id DESC LIMIT ${filter.limit ?? 100}`);
      return [...rows];
    });
    return {code: 'OK', laeufe};
  } catch {
    return {code: 'SOURCE_INCOMPLETE'};
  }
}

/** A unique due key is claimed once; a failed claim may reuse that same row. */
export async function reserviereLauf(tenantId: string, schluessel: string, faelligFuer: string, fristMs: number): Promise<LaufReservierung | null> {
  const handlauf = schluessel === 'heute_neuaufbau' && /^hand:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(faelligFuer);
  const automatik = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}[+-]\d{2}:\d{2})?$/.test(faelligFuer);
  if (!tenantId || !/^[a-z][a-z0-9_.]{1,79}$/.test(schluessel) ||
      (!handlauf && !automatik) ||
      !Number.isSafeInteger(fristMs) || fristMs < 1 || fristMs > TAKT_BUDGET_MS) throw Error('TAKT_RESERVIERUNG_INVALID');
  return withPrivilegedTenantTransaction({tenantId}, async tx => {
    const inserted = await tx.execute<LaufReservierung>(sql`
      INSERT INTO public.takt_job_runs(tenant_id,job_schluessel,faellig_fuer,gestartet_um,status,versuch,reserviert_bis)
      VALUES(${tenantId},${schluessel},${faelligFuer},statement_timestamp(),'läuft',1,statement_timestamp()+(${fristMs}*interval '1 millisecond'))
      ON CONFLICT(tenant_id,job_schluessel,faellig_fuer) WHERE faellig_fuer NOT LIKE 'hand:%' DO NOTHING
      RETURNING id::text,versuch`);
    if (inserted.length === 1) return inserted[0];
    if (handlauf || schluessel === TAKT_NACHHOLEN) return null;
    const retried = await tx.execute<LaufReservierung>(sql`
      UPDATE public.takt_job_runs SET status='läuft',versuch=versuch+1,gestartet_um=statement_timestamp(),
        beendet_um=NULL,fehlercode=NULL,dauer_ms=NULL,reserviert_bis=statement_timestamp()+(${fristMs}*interval '1 millisecond')
      WHERE tenant_id=${tenantId} AND job_schluessel=${schluessel} AND faellig_fuer=${faelligFuer}
        AND status IN ('fehler','abgebrochen')
        AND reserviert_bis<=statement_timestamp() AND versuch<4
      RETURNING id::text,versuch`);
    return retried.length === 1 ? retried[0] : null;
  });
}

/** Completion is fenced by the claimed attempt, so an old worker cannot overwrite a retry. */
export async function beendeLauf(tenantId: string, reservierung: LaufReservierung, status: LaufAbschluss, dauerMs: number, fehlercode: string | null = null): Promise<void> {
  if (!tenantId || !/^[0-9a-f-]{36}$/i.test(reservierung.id) || !Number.isSafeInteger(reservierung.versuch) ||
      reservierung.versuch < 1 || reservierung.versuch > 4 || !Number.isSafeInteger(dauerMs) || dauerMs < 0 ||
      !['ok', 'fehler', 'abgebrochen', 'übersprungen'].includes(status) ||
      (status === 'fehler' && (!fehlercode || !/^[a-z_]{1,60}$/.test(fehlercode))) ||
      (status !== 'fehler' && fehlercode !== null)) throw Error('TAKT_ABSCHLUSS_INVALID');
  await withPrivilegedTenantTransaction({tenantId}, tx => schreibeLaufabschluss(tx, tenantId, reservierung, status, dauerMs, fehlercode));
}

async function schreibeLaufabschluss(tx: PrivilegedTenantTransaction, tenantId: string, reservierung: LaufReservierung, status: LaufAbschluss, dauerMs: number, fehlercode: string | null) {
  const next = status === 'fehler' || status === 'abgebrochen'
    ? naechsteReservierung(reservierung.versuch, new Date()) : null;
  const updated = await tx.execute<{id: string}>(sql`
    UPDATE public.takt_job_runs SET status=${status},beendet_um=statement_timestamp(),dauer_ms=${dauerMs},
      fehlercode=${fehlercode},reserviert_bis=CASE WHEN faellig_fuer LIKE 'hand:%' OR job_schluessel=${TAKT_NACHHOLEN} THEN NULL
        ELSE ${next?.toISOString() ?? null}::timestamptz END
    WHERE tenant_id=${tenantId} AND id=${reservierung.id}::uuid AND status='läuft' AND versuch=${reservierung.versuch}
    RETURNING id::text`);
  if (updated.length !== 1) throw Error('TAKT_RESERVIERUNG_VERLOREN');
}

/** Retention of Takt's own run rows; called only after the Logging job succeeded. */
export async function loescheAlteLaeufe(tenantId: string, tage: number, eigeneLaufId: string, signal?: AbortSignal): Promise<void> {
  if (!tenantId || !Number.isSafeInteger(tage) || tage < 0 || !/^[0-9a-f-]{36}$/i.test(eigeneLaufId)) throw Error('TAKT_RETENTION_SETTING_INVALID');
  await withTaktStatementTimeout(TAKT_RETENTION_BUDGET_MS, () => withPrivilegedTenantTransaction({tenantId}, async tx => {
    await tx.execute(sql`UPDATE public.takt_job_runs SET status='abgebrochen',beendet_um=statement_timestamp(),
      dauer_ms=LEAST(2147483647,GREATEST(0,FLOOR(EXTRACT(epoch FROM statement_timestamp()-gestartet_um)*1000)))::integer,
      reserviert_bis=NULL
      WHERE tenant_id=${tenantId} AND status='läuft' AND reserviert_bis<=statement_timestamp()
        AND (job_schluessel=${TAKT_NACHHOLEN} OR faellig_fuer LIKE 'hand:%')`);
    await tx.execute(sql`DELETE FROM public.takt_job_runs WHERE tenant_id=${tenantId} AND gestartet_um < statement_timestamp()-(${tage}*interval '1 day')
      AND id <> ${eigeneLaufId}::uuid AND status<>'läuft'
      AND NOT (job_schluessel<>${TAKT_NACHHOLEN} AND status IN ('fehler','abgebrochen') AND reserviert_bis IS NOT NULL AND versuch<4)
      AND CASE WHEN job_schluessel=${TAKT_NACHHOLEN} AND length(faellig_fuer)=22
        THEN faellig_fuer::timestamptz<>date_trunc('minute',statement_timestamp())
        ELSE true END`);
  }), signal);
}
