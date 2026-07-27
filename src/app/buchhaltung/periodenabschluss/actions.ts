'use server'

import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { requireFinanceAdmin, requireFinanceRead } from '@/lib/server/financeAuthorization'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface PeriodenabschlussStatus {
  id: string
  jahr: number
  monat: number
  status: 'offen' | 'vorlaeufig_geschlossen' | 'final_geschlossen'
  geschlossen_am: string | null
  belege_ohne_konto: number
  belege_ohne_kostenstelle: number
  rechnungen_ohne_auftrag: number
  belege_ohne_periode: number
  rechnungen_ohne_periode: number
  rechnungen_offen: number
  auftraege_ohne_db: number
}

export type PeriodCloseResult =
  | { ok: true; status: PeriodenabschlussStatus['status']; closedAt: string; replayed: boolean }
  | { ok: false; code: 'INVALID_REQUEST' | 'BLOCKERS_REMAIN' | 'INVALID_TRANSITION' | 'CAPABILITY_NOT_APPLIED' | 'STORAGE_UNAVAILABLE'; message: string }

type PeriodStatusRow = Omit<PeriodenabschlussStatus, 'geschlossen_am'> & { geschlossen_am: Date | string | null }
type CloseRow = { status: PeriodenabschlussStatus['status']; closedAt: Date | string; replayed: boolean }

function validUuid(value: string): boolean {
  return UUID_V4.test(value)
}

function confirmedCount(value: unknown, field: string): number {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`INVALID_PERIOD_COUNT:${field}`)
  }
  return parsed
}

export async function getPeriodenabschlussStatusAction(): Promise<PeriodenabschlussStatus | null> {
  const actor = await requireFinanceRead()
  try {
    const rows = await db.execute(sql<PeriodStatusRow>`
      SELECT
        p.id::text AS id,
        p.jahr,
        p.monat,
        p.status,
        p.geschlossen_am,
        (SELECT count(*)::int FROM public.beleg b
          WHERE b.periode_id = p.id AND b.konto_id IS NULL AND b.status <> 'storniert') AS belege_ohne_konto,
        (SELECT count(*)::int FROM public.beleg b
          WHERE b.periode_id = p.id AND b.kostenstelle_id IS NULL AND b.status <> 'storniert') AS belege_ohne_kostenstelle,
        (SELECT count(*)::int FROM public.ausgangsrechnung r
          WHERE r.tenant_id = p.tenant_id
            AND r.periode_id = p.id
            AND r.order_id IS NULL
            AND r.status <> 'storniert') AS rechnungen_ohne_auftrag,
        (SELECT count(*)::int FROM public.beleg b
          WHERE b.periode_id IS NULL
            AND b.belegdatum >= make_date(p.jahr, p.monat, 1)
            AND b.belegdatum < (make_date(p.jahr, p.monat, 1) + interval '1 month')
            AND b.status <> 'storniert') AS belege_ohne_periode,
        (SELECT count(*)::int FROM public.ausgangsrechnung r
          WHERE r.tenant_id = p.tenant_id
            AND r.periode_id IS NULL
            AND r.datum >= make_date(p.jahr, p.monat, 1)
            AND r.datum < (make_date(p.jahr, p.monat, 1) + interval '1 month')
            AND r.status <> 'storniert') AS rechnungen_ohne_periode,
        (SELECT count(*)::int FROM public.ausgangsrechnung r
          WHERE r.tenant_id = p.tenant_id
            AND r.periode_id = p.id
            AND r.status IN ('offen', 'teilbezahlt', 'ueberfaellig', 'gemahnt', 'mahnung')
            AND greatest(r.brutto - coalesce(r.bezahlt_betrag_eur, 0), 0) > 0) AS rechnungen_offen,
        (SELECT count(*)::int FROM public.orders o
          WHERE o.tenant_id = ${actor.tenantId}
            AND date_trunc(
              'month',
              o.completed_date AT TIME ZONE 'Europe/Berlin'
            )::date = make_date(p.jahr, p.monat, 1)
            AND o.db_ist IS NULL
            AND o.status IN ('completed', 'abgeschlossen')) AS auftraege_ohne_db
      FROM public.periode p
      WHERE p.tenant_id = ${actor.tenantId}
        AND p.status IN ('offen', 'vorlaeufig_geschlossen')
      ORDER BY p.jahr, p.monat
      LIMIT 1
    `)
    const row = rows[0] as unknown as PeriodStatusRow | undefined
    if (!row) return null
    if (!['offen', 'vorlaeufig_geschlossen', 'final_geschlossen'].includes(row.status)) {
      throw new Error('INVALID_PERIOD_STATUS')
    }
    const jahr = confirmedCount(row.jahr, 'jahr')
    const monat = confirmedCount(row.monat, 'monat')
    if (!validUuid(row.id) || jahr < 2000 || jahr > 2200 || monat < 1 || monat > 12) {
      throw new Error('INVALID_PERIOD_IDENTITY')
    }
    return {
      id: row.id,
      jahr,
      monat,
      status: row.status,
      geschlossen_am: row.geschlossen_am ? new Date(row.geschlossen_am).toISOString() : null,
      belege_ohne_konto: confirmedCount(row.belege_ohne_konto, 'belege_ohne_konto'),
      belege_ohne_kostenstelle: confirmedCount(row.belege_ohne_kostenstelle, 'belege_ohne_kostenstelle'),
      rechnungen_ohne_auftrag: confirmedCount(row.rechnungen_ohne_auftrag, 'rechnungen_ohne_auftrag'),
      belege_ohne_periode: confirmedCount(row.belege_ohne_periode, 'belege_ohne_periode'),
      rechnungen_ohne_periode: confirmedCount(row.rechnungen_ohne_periode, 'rechnungen_ohne_periode'),
      rechnungen_offen: confirmedCount(row.rechnungen_offen, 'rechnungen_offen'),
      auftraege_ohne_db: confirmedCount(row.auftraege_ohne_db, 'auftraege_ohne_db'),
    }
  } catch {
    throw new Error('Periodenstatus konnte nicht geladen werden.')
  }
}

/** Energieverteilung bleibt gesperrt, bis eine konfigurierte, auditierbare Verteilungsregel vorliegt. */
export async function runEnergieVerteilungAction(jahr: number, monat: number): Promise<{ ok: false; code: 'NOT_CONFIGURED'; message: string }> {
  await requireFinanceAdmin()
  if (!Number.isInteger(jahr) || jahr < 2020 || jahr > 2100 || !Number.isInteger(monat) || monat < 1 || monat > 12) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Die Energieverteilung ist nicht konfiguriert.' }
  }
  return {
    ok: false,
    code: 'NOT_CONFIGURED',
    message: 'Es ist noch keine freigegebene Energie-Verteilungsregel hinterlegt. Es wurden keine Buchungen verändert.',
  }
}

async function closePeriod(
  periodeId: string,
  requestId: string,
  targetStatus: 'vorlaeufig_geschlossen' | 'final_geschlossen',
): Promise<PeriodCloseResult> {
  const actor = await requireFinanceAdmin()
  if (!validUuid(periodeId) || !validUuid(requestId)) {
    return { ok: false, code: 'INVALID_REQUEST', message: 'Die Abschlussanfrage ist ungültig.' }
  }

  try {
    const rows = await db.execute(sql<CloseRow>`
      SELECT status, closed_at AS "closedAt", replayed
      FROM public.finance_close_period(
        ${periodeId}::uuid,
        ${targetStatus}::text,
        ${actor.userId}::uuid,
        ${requestId}::uuid
      )
    `)
    const row = rows[0] as unknown as CloseRow | undefined
    if (!row) return { ok: false, code: 'STORAGE_UNAVAILABLE', message: 'Der Periodenabschluss wurde nicht bestätigt.' }
    return {
      ok: true,
      status: row.status,
      closedAt: new Date(row.closedAt).toISOString(),
      replayed: row.replayed === true,
    }
  } catch (error) {
    const dbError = error as { code?: string; message?: string }
    if (dbError.code === '42883') {
      return {
        ok: false,
        code: 'CAPABILITY_NOT_APPLIED',
        message: 'Die vorbereitete, transaktionale Abschlussfunktion ist in dieser Umgebung noch nicht freigegeben.',
      }
    }
    if (dbError.message?.includes('PERIOD_CLOSE_BLOCKED')) {
      return { ok: false, code: 'BLOCKERS_REMAIN', message: 'Die Periode enthält noch Abschlussblocker.' }
    }
    if (dbError.message?.includes('INVALID_PERIOD_TRANSITION') || dbError.message?.includes('PERIOD_NOT_FOUND')) {
      return { ok: false, code: 'INVALID_TRANSITION', message: 'Die Periode hat nicht mehr den erwarteten Status.' }
    }
    return { ok: false, code: 'STORAGE_UNAVAILABLE', message: 'Der Periodenabschluss konnte nicht dauerhaft bestätigt werden.' }
  }
}

export async function schliessePeriodeAction(periodeId: string, requestId: string): Promise<PeriodCloseResult> {
  return closePeriod(periodeId, requestId, 'vorlaeufig_geschlossen')
}

export async function finalSchliessePeriodeAction(periodeId: string, requestId: string): Promise<PeriodCloseResult> {
  return closePeriod(periodeId, requestId, 'final_geschlossen')
}
