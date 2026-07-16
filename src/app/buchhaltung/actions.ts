'use server'

import { db } from '@/db'
import { customers } from '@/db/schema'
import { ausgangsrechnung, ausgangsrechnungPosition, beleg, bhAuditLog, bhEinstellungen, konto, kostenposten, kostenstelle, kategorie, steuerprofil } from '@/db/schema_buchhaltung'
import { and, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm'
import { createSupabaseServiceClient } from '@/lib/server/supabaseService'
import { assertFinanceDateRange, requireFinanceRead, requireFinanceWrite } from '@/lib/server/financeAuthorization'
import { calculateOutstandingAmount, normalizeOcrConfidencePercent } from '@/lib/buchhaltung/types'
import {
  assertFinalizableReceipt,
  parseCostItemFormData,
  parseFinanceUuid,
  parseReceiptBatchAssignment,
  parseReceiptCorrection,
} from '@/lib/buchhaltung/inputContract'
import type {
  Beleg,
  BelegDetail,
  BelegFilter,
  Ausgangsrechnung,
  RechnungFilter,
  AusgangsrechnungPosition,
  Kostenposten,
  KostenpostenFilter,
  UstvaWerte,
  Ersparnis,
  KategorieSumme,
  Steuerprofil,
  AusgangsrechnungStatus,
  BelegStatus,
  Belegart,
  BelegPosition,
  KraftstoffDetail,
  Kategorie,
  Lieferant,
} from '@/lib/buchhaltung/types'

const CONFIRMED_RECEIPT_STATUSES = ['erfasst', 'festgeschrieben'] as const

/**
 * Ruft die Liste der Belege aus der Datenbank ab.
 */
export async function listBelegeAction(filter?: BelegFilter): Promise<Beleg[]> {
  await requireFinanceRead()
  const supabase = createSupabaseServiceClient()
  
  let query = supabase.from('beleg').select('*').order('erstellt_am', { ascending: false })
  
  if (filter?.status) {
    query = query.eq('status', filter.status)
  }
  if (filter?.kategorieId) {
    query = query.eq('kategorie_id', filter.kategorieId)
  }
  if (filter?.belegart) {
    query = query.eq('belegart', filter.belegart)
  }
  if (filter?.missingKonto) {
    query = query.is('konto_id', null)
  }
  if (filter?.missingKostenstelle) {
    query = query.is('kostenstelle_id', null)
  }
  if (filter?.nichtAufAuftrag) {
    query = query.eq('ist_auf_auftrag_zugeordnet', false)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Fehler beim Laden der Belege:', error)
    throw new Error('Belege konnten nicht geladen werden.')
  }
  
  return data.map(mapToClientBeleg)
}

/**
 * Lädt einen einzelnen Beleg anhand der ID.
 */
export async function getBelegAction(id: string): Promise<BelegDetail> {
  await requireFinanceRead()
  const supabase = createSupabaseServiceClient()
  
  const { data, error } = await supabase.from('beleg').select(`
    *,
    beleg_position (*),
    kraftstoff_detail (*),
    kategorie (*),
    lieferant (*)
  `).eq('id', id).single()
  
  if (error || !data) {
    console.error('Fehler beim Laden des Belegs:', error)
    throw new Error('Beleg nicht gefunden.')
  }
  
  // Wenn der Beleg eine Datei hat, erzeugen wir eine Signed URL für die Vorschau
  let originalDatei = data.original_datei;
  if (originalDatei && !originalDatei.startsWith('http')) {
    const { data: urlData, error: urlError } = await supabase
      .storage
      .from('buchhaltung-belege')
      .createSignedUrl(originalDatei, 3600); // 1h gültig
      
    if (urlError) {
      console.error('Fehler beim Erzeugen der Belegvorschau:', urlError)
      throw new Error('Belegvorschau konnte nicht erzeugt werden.')
    }
    if (urlData) {
      originalDatei = urlData.signedUrl;
    }
  }

  const fuelRow = relationRow(data.kraftstoff_detail)
  const categoryRow = relationRow(data.kategorie)
  const supplierRow = relationRow(data.lieferant)
  const detail: BelegDetail = {
    ...mapToClientBeleg(data),
    originalDatei,
    positionen: relationRows(data.beleg_position).map(mapReceiptPosition),
    kraftstoffDetail: fuelRow ? mapFuelDetail(fuelRow) : undefined,
    kategorie: categoryRow ? mapCategory(categoryRow) : undefined,
    lieferant: supplierRow ? mapSupplier(supplierRow) : undefined,
    kiHinweise: [] // TODO: KI-Logik ggf. serverseitig integrieren
  }
  
  return detail
}

/**
 * Erstellt einen Beleg inkl. Upload in den Storage Bucket.
 */
export async function createBelegAction(formData: FormData): Promise<Beleg> {
  await requireFinanceWrite()
  const keys = [...formData.keys()]
  if (keys.length !== 1 || keys[0] !== 'file' || !(formData.get('file') instanceof File)) {
    throw new Error('Ungueltiger Beleg-Uploadvertrag.')
  }

  const { POST } = await import('@/app/api/ocr-process/route')
  const response = await POST(new Request('http://internal/api/ocr-process', {
    method: 'POST',
    body: formData,
  }))
  const result: unknown = await response.json()
  if (!response.ok || !result || typeof result !== 'object' || !('belegId' in result) || typeof result.belegId !== 'string') {
    const message = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
      ? result.error
      : 'Beleg konnte nicht verarbeitet werden.'
    throw new Error(message)
  }

  return getBelegAction(result.belegId)
}

/**
 * Gibt einen Beleg frei.
 */
export async function freigebenBelegAction(id: string, korrektur?: Partial<Beleg>): Promise<Beleg> {
  const actor = await requireFinanceWrite()
  const receiptId = parseFinanceUuid(id, 'id')
  const correction = korrektur === undefined ? null : parseReceiptCorrection(korrektur)

  const updated = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(beleg)
      .where(eq(beleg.id, receiptId))
      .limit(1)
      .for('update')
    if (!current) throw new Error('Beleg nicht gefunden.')
    if (current.status !== 'pruefen' && current.status !== 'erfasst') {
      throw new Error('Dieser Beleg ist bereits festgeschrieben oder storniert und kann nicht geändert werden.')
    }

    const nextStatus = correction ? 'erfasst' : 'festgeschrieben'
    if (!correction) assertFinalizableReceipt(current)
    const [result] = await tx
      .update(beleg)
      .set({ ...(correction ?? {}), status: nextStatus })
      .where(and(eq(beleg.id, receiptId), eq(beleg.status, current.status)))
      .returning()
    if (!result) throw new Error('Beleg wurde zwischenzeitlich geändert.')

    const [audit] = await tx.insert(bhAuditLog).values({
      benutzer: actor.userId,
      entitaet: 'beleg',
      entitaetId: receiptId,
      aktion: correction ? 'korrektur' : 'freigabe',
      vorher: receiptAuditSnapshot(current),
      nachher: receiptAuditSnapshot(result),
    }).returning({ id: bhAuditLog.id })
    if (!audit) throw new Error('AUDIT_RECEIPT_MISSING')
    return result
  })

  return mapDrizzleBeleg(updated)
}

/**
 * Storniert einen Beleg.
 */
export async function stornoBelegAction(id: string, grund: string): Promise<Beleg> {
  const actor = await requireFinanceWrite()
  const receiptId = parseFinanceUuid(id, 'id')
  const normalizedReason = grund.trim()
  if (normalizedReason.length < 3 || normalizedReason.length > 500) {
    throw new Error('Ein Stornogrund mit 3 bis 500 Zeichen ist erforderlich.')
  }

  const updated = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(beleg)
      .where(eq(beleg.id, receiptId)).limit(1).for('update')
    if (!current) throw new Error('Beleg nicht gefunden.')
    if (current.status === 'storniert') throw new Error('Beleg ist bereits storniert.')

    const [result] = await tx.update(beleg).set({
      status: 'storniert',
      storniertVon: actor.userId,
    }).where(and(eq(beleg.id, receiptId), eq(beleg.status, current.status))).returning()
    if (!result) throw new Error('Beleg wurde zwischenzeitlich geändert.')

    const [audit] = await tx.insert(bhAuditLog).values({
      benutzer: actor.userId,
      entitaet: 'beleg',
      entitaetId: receiptId,
      aktion: 'storno',
      vorher: receiptAuditSnapshot(current),
      nachher: { ...receiptAuditSnapshot(result), grund: normalizedReason },
    }).returning({ id: bhAuditLog.id })
    if (!audit) throw new Error('AUDIT_RECEIPT_MISSING')
    return result
  })

  return mapDrizzleBeleg(updated)
}

export async function assignBelegeBatchAction(belegIds: string[], updates: { kontoId?: string, kostenstelleId?: string }) {
  const actor = await requireFinanceWrite()
  const assignment = parseReceiptBatchAssignment(belegIds, updates)

  await db.transaction(async (tx) => {
    if (assignment.updates.kontoId) {
      const [account] = await tx.select({ id: konto.id }).from(konto).where(and(
        eq(konto.id, assignment.updates.kontoId),
        eq(konto.tenantId, actor.tenantId),
      )).limit(1)
      if (!account) throw new Error('FINANCE_ACCOUNT_NOT_FOUND')
    }
    if (assignment.updates.kostenstelleId) {
      const [costCenter] = await tx.select({ id: kostenstelle.id }).from(kostenstelle).where(and(
        eq(kostenstelle.id, assignment.updates.kostenstelleId),
        eq(kostenstelle.tenantId, actor.tenantId),
      )).limit(1)
      if (!costCenter) throw new Error('FINANCE_COST_CENTER_NOT_FOUND')
    }

    const current = await tx.select({ id: beleg.id, status: beleg.status, kontoId: beleg.kontoId, kostenstelleId: beleg.kostenstelleId })
      .from(beleg).where(inArray(beleg.id, assignment.ids)).for('update')
    if (current.length !== assignment.ids.length) throw new Error('FINANCE_RECEIPT_NOT_FOUND')
    if (current.some((entry) => entry.status !== 'pruefen' && entry.status !== 'erfasst')) {
      throw new Error('FINANCE_FINALIZED_RECEIPT_IMMUTABLE')
    }

    const changed = await tx.update(beleg).set(assignment.updates)
      .where(and(
        inArray(beleg.id, assignment.ids),
        inArray(beleg.status, ['pruefen', 'erfasst']),
      )).returning({ id: beleg.id })
    if (changed.length !== assignment.ids.length) throw new Error('FINANCE_RECEIPT_CONCURRENT_CHANGE')

    const audits = await tx.insert(bhAuditLog).values(current.map((entry) => ({
      benutzer: actor.userId,
      entitaet: 'beleg',
      entitaetId: entry.id,
      aktion: 'massenzuordnung',
      vorher: { kontoId: entry.kontoId, kostenstelleId: entry.kostenstelleId },
      nachher: assignment.updates,
    }))).returning({ id: bhAuditLog.id })
    if (audits.length !== current.length) throw new Error('AUDIT_RECEIPT_MISSING')
  })
  return true
}

export async function getKraftstoffTankungenAction() {
  await requireFinanceRead()
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.from('beleg')
    .select('*, kraftstoff_detail(*)')
    .eq('belegart', 'tankbeleg')
    .in('status', ['erfasst', 'festgeschrieben'])
    .order('belegdatum', { ascending: false });

  if (error) {
    console.error('Fehler bei getKraftstoffTankungenAction:', error);
    throw new Error('Tankungen konnten nicht geladen werden.');
  }

  return data.map((dbData) => {
    const fuel = relationRow(dbData.kraftstoff_detail)
    return {
      ...mapToClientBeleg(dbData),
      kraftstoffDetail: fuel ? mapFuelDetail(fuel) : undefined,
    }
  });
}

export async function exportBelegeAction(
  format: "DATEV" | "Lexware" | "CSV",
  zeitraum?: { von: string; bis: string }
) {
  await requireFinanceRead()
  if (zeitraum) assertFinanceDateRange(zeitraum.von, zeitraum.bis)
  const supabase = createSupabaseServiceClient()
  
  let query = supabase.from('beleg')
    .select('*')
    .eq('status', 'festgeschrieben')
    .order('belegdatum', { ascending: false });

  if (zeitraum) {
    query = query.gte('belegdatum', zeitraum.von).lte('belegdatum', zeitraum.bis)
  }

  const { data, error } = await query

  if (error) {
    console.error('Fehler bei exportBelegeAction:', error);
    throw new Error('Export fehlgeschlagen.');
  }

  const belege = data.map(mapToClientBeleg);

  const rows = belege.map(b => {
    return `${b.belegdatum || b.erfasstAm};${b.lieferantText || "Unbekannt"};${b.skrKonto || ""};${b.kategorieId};${b.brutto};${b.ustSatz || "19%"};${b.ustBetrag || "0,00"};${b.id};${b.status}`;
  });

  return {
    format,
    header: "Datum;Lieferant/Kunde;Konto;Kategorie;Betrag;USt-Satz;USt-Betrag;Belegnummer;Status",
    rows,
    csv: "Datum;Lieferant/Kunde;Konto;Kategorie;Betrag;USt-Satz;USt-Betrag;Belegnummer;Status\n" + rows.join('\n')
  };
}

export async function listRechnungenAction(filter?: RechnungFilter): Promise<Ausgangsrechnung[]> {
  const actor = await requireFinanceRead();
  const supabase = createSupabaseServiceClient();
  let query = supabase.from('ausgangsrechnung').select('*')
    .eq('tenant_id', actor.tenantId)
    .eq('is_demo', false)
    .order('datum', { ascending: false });

  if (filter?.status) {
    if (filter.status === 'ueberfaellig') {
      query = query.in('status', ['offen', 'teilbezahlt']).lt('faellig_am', new Date().toISOString());
    } else {
      query = query.eq('status', filter.status);
    }
  }

  if (filter?.kundeId) {
    query = query.eq('kunde_id', filter.kundeId);
  }

  if (filter?.zeitraum?.von) {
    query = query.gte('datum', filter.zeitraum.von);
  }

  if (filter?.zeitraum?.bis) {
    query = query.lte('datum', filter.zeitraum.bis);
  }

  if (filter?.ueberfaellig) {
    query = query.in('status', ['offen', 'teilbezahlt']).lt('faellig_am', new Date().toISOString());
  }

  const { data, error } = await query;
  if (error) {
    console.error('Fehler bei listRechnungenAction:', error);
    throw new Error('Rechnungen konnten nicht geladen werden.');
  }

  return data.map(mapToClientRechnung);
}

export async function listOffenePostenAction(): Promise<Ausgangsrechnung[]> {
  const actor = await requireFinanceRead();
  const supabase = createSupabaseServiceClient();
  // Offene Posten umfassen auch Teilzahlungen; der Restbetrag wird beim Mapping berechnet.
  const { data, error } = await supabase.from('ausgangsrechnung')
    .select('*')
    .eq('tenant_id', actor.tenantId)
    .eq('is_demo', false)
    .in('status', ['offen', 'teilbezahlt', 'ueberfaellig', 'gemahnt'])
    .order('faellig_am', { ascending: true });

  if (error) {
    console.error('Fehler bei listOffenePostenAction:', error);
    throw new Error('Offene Posten konnten nicht geladen werden.');
  }

  return data.map(mapToClientRechnung);
}

// ---------------- Helper -------------------------------------------------------------------

type DatabaseRow = Record<string, unknown>

function relationRow(value: unknown): DatabaseRow | undefined {
  const candidate = Array.isArray(value) ? value[0] : value
  return candidate !== null && typeof candidate === 'object' ? candidate as DatabaseRow : undefined
}

function relationRows(value: unknown): DatabaseRow[] {
  const values = Array.isArray(value) ? value : value ? [value] : []
  return values.filter((entry): entry is DatabaseRow => entry !== null && typeof entry === 'object')
}

function requiredString(row: DatabaseRow, key: string): string {
  const value = row[key]
  if (typeof value !== 'string' || value.length === 0) throw new Error(`FINANCE_DATA_INVALID:${key}`)
  return value
}

function optionalString(row: DatabaseRow, key: string): string | undefined {
  const value = row[key]
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value !== 'string') throw new Error(`FINANCE_DATA_INVALID:${key}`)
  return value
}

function requiredNumber(row: DatabaseRow, key: string): number {
  const value = Number(row[key])
  if (!Number.isFinite(value)) throw new Error(`FINANCE_DATA_INVALID:${key}`)
  return value
}

function optionalNumber(row: DatabaseRow, key: string): number | undefined {
  if (row[key] === null || row[key] === undefined || row[key] === '') return undefined
  return requiredNumber(row, key)
}

function requiredBoolean(row: DatabaseRow, key: string): boolean {
  const value = row[key]
  if (typeof value !== 'boolean') throw new Error(`FINANCE_DATA_INVALID:${key}`)
  return value
}

function invoiceStatus(row: DatabaseRow): AusgangsrechnungStatus {
  const value = requiredString(row, 'status')
  if (!['offen', 'bezahlt', 'ueberfaellig', 'teilbezahlt', 'gemahnt', 'storniert'].includes(value)) {
    throw new Error('FINANCE_DATA_INVALID:status')
  }
  return value as AusgangsrechnungStatus
}

function receiptStatus(row: DatabaseRow): BelegStatus {
  const value = requiredString(row, 'status')
  if (!['pruefen', 'erfasst', 'festgeschrieben', 'storniert'].includes(value)) {
    throw new Error('FINANCE_DATA_INVALID:status')
  }
  return value as BelegStatus
}

function receiptType(row: DatabaseRow): Belegart | undefined {
  const value = optionalString(row, 'belegart')
  if (!value) return undefined
  if (!['rechnung', 'kassenbon', 'tankbeleg', 'bewirtung', 'abo'].includes(value)) {
    throw new Error('FINANCE_DATA_INVALID:belegart')
  }
  return value as Belegart
}

function mapReceiptPosition(row: DatabaseRow): BelegPosition {
  return {
    id: requiredString(row, 'id'),
    belegId: requiredString(row, 'beleg_id'),
    beschreibung: optionalString(row, 'beschreibung'),
    netto: optionalNumber(row, 'netto'),
    ustSatz: optionalNumber(row, 'ust_satz'),
    ustBetrag: optionalNumber(row, 'ust_betrag'),
    skrKonto: optionalString(row, 'skr_konto'),
    sortierung: optionalNumber(row, 'sortierung') || 0,
  }
}

function mapFuelDetail(row: DatabaseRow): KraftstoffDetail {
  const rawType = optionalString(row, 'sorte')?.trim().toLowerCase()
  const sorte = rawType && ['diesel', 'super', 'superplus', 'adblue'].includes(rawType)
    ? rawType as KraftstoffDetail['sorte']
    : rawType ? 'unbekannt' : undefined
  return {
    id: requiredString(row, 'id'),
    belegId: requiredString(row, 'beleg_id'),
    sorte,
    liter: optionalNumber(row, 'liter'),
    preisProLiter: optionalNumber(row, 'preis_pro_liter'),
    tankstelle: optionalString(row, 'tankstelle'),
    ort: optionalString(row, 'ort'),
  }
}

function mapCategory(row: DatabaseRow): Kategorie {
  const typ = requiredString(row, 'typ')
  if (typ !== 'ausgabe' && typ !== 'einnahme') throw new Error('FINANCE_DATA_INVALID:kategorie.typ')
  return {
    id: requiredString(row, 'id'),
    name: requiredString(row, 'name'),
    typ,
    skrKonto: optionalString(row, 'skr_konto'),
    defaultAbsetzbarProzent: requiredNumber(row, 'default_absetzbar_prozent'),
    icon: optionalString(row, 'icon'),
    sortierung: optionalNumber(row, 'sortierung') || 0,
  }
}

function mapSupplier(row: DatabaseRow): Lieferant {
  return {
    id: requiredString(row, 'id'),
    name: requiredString(row, 'name'),
    nameNormalisiert: optionalString(row, 'name_normalisiert'),
    standardKategorieId: optionalString(row, 'standard_kategorie_id'),
    standardSkrKonto: optionalString(row, 'standard_skr_konto'),
    ustId: optionalString(row, 'ust_id'),
    adresse: optionalString(row, 'adresse'),
  }
}

function mapToClientRechnung(dbData: DatabaseRow): Ausgangsrechnung {
  const brutto = requiredNumber(dbData, 'brutto')
  const bezahltBetrag = optionalNumber(dbData, 'bezahlt_betrag_eur') || 0
  const status = invoiceStatus(dbData)
  const offenerBetrag = calculateOutstandingAmount({ brutto, bezahltBetrag, status })
  return {
    id: requiredString(dbData, 'id'),
    nummer: requiredString(dbData, 'nummer'),
    kundeId: optionalString(dbData, 'kunde_id'),
    kundeName: optionalString(dbData, 'kunde_name'),
    datum: requiredString(dbData, 'datum'),
    faelligAm: optionalString(dbData, 'faellig_am'),
    brutto,
    netto: optionalNumber(dbData, 'netto'),
    ustSatz: optionalNumber(dbData, 'ust_satz'),
    ustBetrag: optionalNumber(dbData, 'ust_betrag'),
    bezahltAm: optionalString(dbData, 'bezahlt_am'),
    bezahltBetrag,
    offenerBetrag,
    status,
    mahnstufe: optionalNumber(dbData, 'mahnstufe') || 0,
    erechnungXml: optionalString(dbData, 'erechnung_xml'),
  };
}

function mapToClientBeleg(dbData: DatabaseRow): Beleg {
  return {
    id: requiredString(dbData, 'id'),
    erfasstAm: requiredString(dbData, 'erfasst_am'),
    belegdatum: optionalString(dbData, 'belegdatum'),
    lieferantId: optionalString(dbData, 'lieferant_id'),
    lieferantText: optionalString(dbData, 'lieferant_text'),
    brutto: optionalNumber(dbData, 'brutto'),
    netto: optionalNumber(dbData, 'netto'),
    ustSatz: optionalNumber(dbData, 'ust_satz'),
    ustBetrag: optionalNumber(dbData, 'ust_betrag'),
    vorsteuerAbzug: requiredBoolean(dbData, 'vorsteuer_abzug'),
    kategorieId: optionalString(dbData, 'kategorie_id'),
    skrKonto: optionalString(dbData, 'skr_konto'),
    absetzbarProzent: requiredNumber(dbData, 'absetzbar_prozent'),
    absetzbarGrund: optionalString(dbData, 'absetzbar_grund'),
    belegart: receiptType(dbData),
    originalDatei: requiredString(dbData, 'original_datei'),
    originalFormat: optionalString(dbData, 'original_format'),
    ocrConfidence: normalizeOcrConfidencePercent(optionalNumber(dbData, 'ocr_confidence')),
    status: receiptStatus(dbData),
    rechnungsnummerExtern: optionalString(dbData, 'rechnungsnummer_extern'),
    storniertVon: optionalString(dbData, 'storniert_von'),
    bankZahlungId: optionalString(dbData, 'bank_zahlung_id'),
    erstelltVon: requiredString(dbData, 'erstellt_von'),
    kontoId: optionalString(dbData, 'konto_id'),
    kostenstelleId: optionalString(dbData, 'kostenstelle_id'),
    periodeId: optionalString(dbData, 'periode_id'),
    istAufAuftragZugeordnet: requiredBoolean(dbData, 'ist_auf_auftrag_zugeordnet'),
    zugeordneterOrderId: optionalString(dbData, 'zugeordneter_order_id'),
  }
}

type StoredBeleg = typeof beleg.$inferSelect

function storedNumber(value: string | null, field: string, fallback?: number): number {
  if (value === null && fallback !== undefined) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`FINANCE_DATA_INVALID:${field}`)
  return parsed
}

function mapDrizzleBeleg(row: StoredBeleg): Beleg {
  const status = row.status
  if (!['pruefen', 'erfasst', 'festgeschrieben', 'storniert'].includes(status)) {
    throw new Error('FINANCE_DATA_INVALID:status')
  }
  const belegart = row.belegart
  if (belegart !== null && !['rechnung', 'kassenbon', 'tankbeleg', 'bewirtung', 'abo'].includes(belegart)) {
    throw new Error('FINANCE_DATA_INVALID:belegart')
  }
  if (typeof row.vorsteuerAbzug !== 'boolean') throw new Error('FINANCE_DATA_INVALID:vorsteuer_abzug')
  if (typeof row.istAufAuftragZugeordnet !== 'boolean') {
    throw new Error('FINANCE_DATA_INVALID:ist_auf_auftrag_zugeordnet')
  }
  return {
    id: row.id,
    erfasstAm: row.erfasstAm.toISOString(),
    belegdatum: row.belegdatum ?? undefined,
    lieferantId: row.lieferantId ?? undefined,
    lieferantText: row.lieferantText ?? undefined,
    brutto: row.brutto === null ? undefined : storedNumber(row.brutto, 'brutto'),
    netto: row.netto === null ? undefined : storedNumber(row.netto, 'netto'),
    ustSatz: row.ustSatz === null ? undefined : storedNumber(row.ustSatz, 'ust_satz'),
    ustBetrag: row.ustBetrag === null ? undefined : storedNumber(row.ustBetrag, 'ust_betrag'),
    vorsteuerAbzug: row.vorsteuerAbzug,
    kategorieId: row.kategorieId ?? undefined,
    skrKonto: row.skrKonto ?? undefined,
    absetzbarProzent: storedNumber(row.absetzbarProzent, 'absetzbar_prozent', 100),
    absetzbarGrund: row.absetzbarGrund ?? undefined,
    belegart: belegart === null ? undefined : belegart as Belegart,
    originalDatei: row.originalDatei,
    originalFormat: row.originalFormat ?? undefined,
    ocrConfidence: normalizeOcrConfidencePercent(
      row.ocrConfidence === null ? undefined : storedNumber(row.ocrConfidence, 'ocr_confidence'),
    ),
    status: status as BelegStatus,
    rechnungsnummerExtern: row.rechnungsnummerExtern ?? undefined,
    storniertVon: row.storniertVon ?? undefined,
    bankZahlungId: row.bankZahlungId ?? undefined,
    erstelltVon: row.erstelltVon,
    kontoId: row.kontoId ?? undefined,
    kostenstelleId: row.kostenstelleId ?? undefined,
    periodeId: row.periodeId ?? undefined,
    istAufAuftragZugeordnet: row.istAufAuftragZugeordnet,
    zugeordneterOrderId: row.zugeordneterOrderId ?? undefined,
  }
}

function receiptAuditSnapshot(row: StoredBeleg): Record<string, unknown> {
  return {
    status: row.status,
    belegdatum: row.belegdatum,
    lieferantId: row.lieferantId,
    lieferantText: row.lieferantText,
    brutto: row.brutto,
    netto: row.netto,
    ustSatz: row.ustSatz,
    ustBetrag: row.ustBetrag,
    vorsteuerAbzug: row.vorsteuerAbzug,
    kategorieId: row.kategorieId,
    skrKonto: row.skrKonto,
    absetzbarProzent: row.absetzbarProzent,
    absetzbarGrund: row.absetzbarGrund,
    rechnungsnummerExtern: row.rechnungsnummerExtern,
    kontoId: row.kontoId,
    kostenstelleId: row.kostenstelleId,
    storniertVon: row.storniertVon,
  }
}

export async function createRechnungAction(formData: FormData, positionen: AusgangsrechnungPosition[]): Promise<Ausgangsrechnung> {
  const actor = await requireFinanceWrite();

  const entries = [...formData.entries()];
  const allowedKeys = new Set(['nummer', 'kundeId', 'datum', 'faelligAm', 'ustSatz', 'bemerkung']);
  if (
    entries.some(([key, value]) => !allowedKeys.has(key) || typeof value !== 'string')
    || new Set(entries.map(([key]) => key)).size !== entries.length
  ) throw new Error('FINANCE_INPUT_INVALID:invoice');

  const nummer = String(formData.get('nummer') || '').trim();
  const kundeId = String(formData.get('kundeId') || '').trim();
  const datum = String(formData.get('datum') || '').trim();
  const faelligAm = String(formData.get('faelligAm') || '').trim();
  const ustSatz = Number(String(formData.get('ustSatz') || '19').replace(',', '.'));
  const bemerkung = String(formData.get('bemerkung') || '').trim() || null;

  if (!nummer || !kundeId || !datum || !faelligAm) {
    throw new Error('Bitte füllen Sie alle Pflichtfelder aus.');
  }
  if (
    !/^[\p{L}\p{N}][\p{L}\p{N} ._/-]{0,99}$/u.test(nummer)
    || kundeId.length > 100 || kundeId.includes('\0')
    || (bemerkung?.length || 0) > 2_000 || bemerkung?.includes('\0')
  ) {
    throw new Error('Rechnungsdaten überschreiten die zulässige Länge.');
  }
  assertFinanceDateRange(datum, faelligAm)
  if (![0, 7, 19].includes(ustSatz)) {
    throw new Error('Ungültiger Umsatzsteuersatz.');
  }
  if (positionen.length === 0 || positionen.length > 500) {
    throw new Error('Mindestens eine Position muss angegeben werden.');
  }

  let nettoCents = 0;
  for (const pos of positionen) {
    if (
      !pos.beschreibung.trim() || pos.beschreibung.length > 500 ||
      !Number.isFinite(pos.menge) || pos.menge <= 0 || pos.menge > 1_000_000 ||
      Math.abs(pos.menge * 100 - Math.round(pos.menge * 100)) > 1e-7 ||
      !Number.isFinite(pos.einzelpreisNetto) || pos.einzelpreisNetto <= 0 || pos.einzelpreisNetto > 1_000_000 ||
      Math.abs(pos.einzelpreisNetto * 100 - Math.round(pos.einzelpreisNetto * 100)) > 1e-7
    ) {
      throw new Error('Ungültige Rechnungsposition.');
    }
    nettoCents += Math.round(pos.menge * pos.einzelpreisNetto * 100);
    if (!Number.isSafeInteger(nettoCents) || nettoCents > 100_000_000) {
      throw new Error('Rechnungsbetrag überschreitet die zulässige Höhe.');
    }
  }
  const netto = nettoCents / 100;
  const ustBetrag = Math.round(nettoCents * (ustSatz / 100)) / 100;
  const brutto = Math.round((netto + ustBetrag) * 100) / 100;

  const invoice = await db.transaction(async (tx) => {
    const [customer] = await tx.select({ id: customers.id }).from(customers).where(and(
      eq(customers.id, kundeId),
      eq(customers.tenantId, actor.tenantId),
    )).limit(1);
    if (!customer) throw new Error('FINANCE_CUSTOMER_NOT_FOUND');
    const [duplicate] = await tx.select({ id: ausgangsrechnung.id }).from(ausgangsrechnung).where(and(
      eq(ausgangsrechnung.tenantId, actor.tenantId),
      eq(ausgangsrechnung.nummer, nummer),
    )).limit(1);
    if (duplicate) throw new Error('FINANCE_INVOICE_NUMBER_EXISTS');

    const [created] = await tx.insert(ausgangsrechnung).values({
      nummer,
      kundeId,
      datum,
      faelligAm,
      netto: netto.toFixed(2),
      ustSatz: ustSatz.toFixed(2),
      ustBetrag: ustBetrag.toFixed(2),
      brutto: brutto.toFixed(2),
      bemerkung,
      isDemo: false,
      status: 'offen',
      tenantId: actor.tenantId,
    }).returning();

    await tx.insert(ausgangsrechnungPosition).values(positionen.map((position) => ({
      ausgangsrechnungId: created.id,
      beschreibung: position.beschreibung.trim(),
      menge: position.menge.toString(),
      einzelpreisNetto: position.einzelpreisNetto.toFixed(2),
    })));
    const [audit] = await tx.insert(bhAuditLog).values({
      benutzer: actor.userId,
      entitaet: 'ausgangsrechnung',
      entitaetId: created.id,
      aktion: 'create',
      nachher: {
        nummer: created.nummer,
        kundeId: created.kundeId,
        datum: created.datum,
        faelligAm: created.faelligAm,
        netto: created.netto,
        ustSatz: created.ustSatz,
        ustBetrag: created.ustBetrag,
        brutto: created.brutto,
        status: created.status,
        positionen: positionen.length,
      },
    }).returning({ id: bhAuditLog.id });
    if (!audit) throw new Error('AUDIT_RECEIPT_MISSING');
    return created;
  });

  return {
    id: invoice.id,
    nummer: invoice.nummer,
    kundeId: invoice.kundeId || undefined,
    datum: invoice.datum,
    faelligAm: invoice.faelligAm || undefined,
    brutto: Number(invoice.brutto),
    netto: invoice.netto === null ? undefined : Number(invoice.netto),
    ustSatz: invoice.ustSatz === null ? undefined : Number(invoice.ustSatz),
    ustBetrag: invoice.ustBetrag === null ? undefined : Number(invoice.ustBetrag),
    bezahltBetrag: 0,
    offenerBetrag: Number(invoice.brutto),
    status: 'offen',
    mahnstufe: invoice.mahnstufe || 0,
    bemerkung: invoice.bemerkung || undefined,
    positionen,
  };
}


export async function getRechnungAction(id: string): Promise<Ausgangsrechnung> {
  const actor = await requireFinanceRead();
  const supabase = createSupabaseServiceClient();
  const { data: arData, error: arError } = await supabase
    .from('ausgangsrechnung')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', actor.tenantId)
    .eq('is_demo', false)
    .single();

  if (arError || !arData) {
    throw new Error('Rechnung nicht gefunden.');
  }

  const { data: posData, error: positionError } = await supabase
    .from('ausgangsrechnung_position')
    .select('*')
    .eq('ausgangsrechnung_id', id);
  if (positionError) throw new Error('Rechnungspositionen konnten nicht geladen werden.')

  const rechnung = mapToClientRechnung(arData);
  rechnung.positionen = posData?.map(p => ({
    id: p.id,
    beschreibung: p.beschreibung,
    menge: Number(p.menge),
    einzelpreisNetto: Number(p.einzelpreis_netto)
  })) || [];

  return rechnung;
}

// === KOSTENPOSTEN ===

export async function listKostenpostenAction(filter?: KostenpostenFilter): Promise<Kostenposten[]> {
  await requireFinanceRead();
  const supabase = createSupabaseServiceClient();
  let query = supabase.from('kostenposten').select('*').eq('is_demo', false).order('betrag', { ascending: false });

  if (filter?.art) {
    query = query.eq('art', filter.art);
  }
  if (filter?.kategorie) {
    query = query.eq('kategorie', filter.kategorie);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Fehler beim Laden der Kostenposten:", error);
    throw new Error('Kostenposten konnten nicht geladen werden.');
  }

  return data.map(k => ({
    id: k.id,
    bezeichnung: k.bezeichnung,
    art: k.art as "fix" | "variabel",
    kategorie: k.kategorie || undefined,
    betrag: Number(k.betrag),
    intervall: k.intervall as "einmalig" | "monatlich" | "jaehrlich",
    belegId: k.beleg_id || undefined,
    kampagneId: k.kampagne_id || undefined,
    giltAb: k.gilt_ab || undefined,
    giltBis: k.gilt_bis || undefined,
    isDemo: k.is_demo || false
  }));
}

export async function createKostenpostenAction(formData: FormData): Promise<Kostenposten> {
  const actor = await requireFinanceWrite();
  const input = parseCostItemFormData(formData);
  const data = await db.transaction(async (tx) => {
    const [created] = await tx.insert(kostenposten).values({
      ...input,
      isDemo: false,
    }).returning();
    if (!created) throw new Error('FINANCE_COST_CREATE_FAILED');
    const [audit] = await tx.insert(bhAuditLog).values({
      benutzer: actor.userId,
      entitaet: 'kostenposten',
      entitaetId: created.id,
      aktion: 'create',
      nachher: {
        bezeichnung: created.bezeichnung,
        art: created.art,
        kategorie: created.kategorie,
        betrag: created.betrag,
        intervall: created.intervall,
        belegId: created.belegId,
        kampagneId: created.kampagneId,
        giltAb: created.giltAb,
        giltBis: created.giltBis,
      },
    }).returning({ id: bhAuditLog.id });
    if (!audit) throw new Error('AUDIT_RECEIPT_MISSING');
    return created;
  });

  return {
    id: data.id,
    bezeichnung: data.bezeichnung,
    art: data.art as "fix" | "variabel",
    kategorie: data.kategorie ?? undefined,
    betrag: Number(data.betrag),
    intervall: data.intervall as "einmalig" | "monatlich" | "jaehrlich",
    belegId: data.belegId ?? undefined,
    kampagneId: data.kampagneId ?? undefined,
    giltAb: data.giltAb ?? undefined,
    giltBis: data.giltBis ?? undefined,
    isDemo: false,
  };
}

export async function getKostenpostenAction(id: string): Promise<Kostenposten> {
  await requireFinanceRead();
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from('kostenposten').select('*').eq('id', id).eq('is_demo', false).single();
  if (error) {
    throw new Error('Kostenposten nicht gefunden.');
  }
  return {
    id: data.id,
    bezeichnung: data.bezeichnung,
    art: data.art as "fix" | "variabel",
    kategorie: data.kategorie || undefined,
    betrag: Number(data.betrag),
    intervall: data.intervall as "einmalig" | "monatlich" | "jaehrlich",
    belegId: data.beleg_id || undefined,
    kampagneId: data.kampagne_id || undefined,
    giltAb: data.gilt_ab || undefined,
    giltBis: data.gilt_bis || undefined,
    isDemo: data.is_demo || false
  };
}

export async function getSteuerprofilAction(): Promise<Steuerprofil> {
  await requireFinanceRead()
  const [profile] = await db
    .select()
    .from(steuerprofil)
    .where(eq(steuerprofil.aktiv, true))
    .limit(1)

  if (!profile) {
    throw new Error('FINANCE_PROFILE_NOT_CONFIGURED')
  }

  const rhythmus = profile.voranmeldungRhythmus
  if (rhythmus !== 'monatlich' && rhythmus !== 'vierteljaehrlich') {
    throw new Error('FINANCE_PROFILE_INVALID_RHYTHM')
  }
  const kontenrahmen = profile.sachkontenrahmen
  if (kontenrahmen !== 'SKR03' && kontenrahmen !== 'SKR04') {
    throw new Error('FINANCE_PROFILE_INVALID_LEDGER')
  }

  return {
    id: profile.id,
    bezeichnung: profile.bezeichnung,
    standardUstSatz: Number(profile.standardUstSatz),
    reduziertUstSatz: Number(profile.reduziertUstSatz),
    kleinunternehmer: Boolean(profile.kleinunternehmer),
    voranmeldungRhythmus: rhythmus,
    sachkontenrahmen: kontenrahmen,
    beraterNr: profile.beraterNr || undefined,
    mandantenNr: profile.mandantenNr || undefined,
    wjBeginn: profile.wjBeginn || undefined,
  }
}


// === COCKPIT & AUSWERTUNGEN ===

export async function getCockpitMetricsAction(von: string, bis: string) {
  const actor = await requireFinanceRead()
  assertFinanceDateRange(von, bis)
  // Einnahmen & USt aus Rechnungen grouped by ustSatz
  const rechnungenGrouped = await db.select({
    ustSatz: ausgangsrechnung.ustSatz,
    nettoSum: sql<number>`sum(CAST(${ausgangsrechnung.netto} AS numeric))`,
    ustSum: sql<number>`sum(CAST(${ausgangsrechnung.ustBetrag} AS numeric))`
  })
    .from(ausgangsrechnung)
    .where(and(
      eq(ausgangsrechnung.tenantId, actor.tenantId),
      eq(ausgangsrechnung.isDemo, false),
      ne(ausgangsrechnung.status, 'storniert'),
      gte(ausgangsrechnung.datum, von),
      lte(ausgangsrechnung.datum, bis)
    ))
    .groupBy(ausgangsrechnung.ustSatz);

  // Ausgaben & Vorsteuer aus Belegen
  const belege = await db.select({
    netto: beleg.netto,
    ustBetrag: beleg.ustBetrag,
    kategorieId: beleg.kategorieId,
    ocrConfidence: beleg.ocrConfidence,
    status: beleg.status,
    vorsteuerAbzug: beleg.vorsteuerAbzug,
    absetzbarProzent: beleg.absetzbarProzent,
  })
    .from(beleg)
    .where(and(
      inArray(beleg.status, CONFIRMED_RECEIPT_STATUSES),
      gte(beleg.belegdatum, von),
      lte(beleg.belegdatum, bis)
    ));

  // Fixkosten
  const kosten = await db.select({ betrag: kostenposten.betrag, kategorie: kostenposten.kategorie, art: kostenposten.art, intervall: kostenposten.intervall, giltAb: kostenposten.giltAb, giltBis: kostenposten.giltBis })
    .from(kostenposten)
    .where(eq(kostenposten.isDemo, false));

  let umsatz19 = 0, umsatz7 = 0, umsatz0 = 0;
  let ust19 = 0, ust7 = 0;
  
  for (const r of rechnungenGrouped) {
    const netto = Number(r.nettoSum) || 0;
    const ustB = Number(r.ustSum) || 0;
    const satz = Number(r.ustSatz) || 19;
    
    if (satz === 19) { umsatz19 += netto; ust19 += ustB; }
    else if (satz === 7) { umsatz7 += netto; ust7 += ustB; }
    else umsatz0 += netto;
  }
  const einnahmenNetto = umsatz19 + umsatz7 + umsatz0;
  
  const ausgabenBelegeNetto = belege.reduce((sum, b) => sum + (Number(b.netto) || 0), 0);
  const ausgabenBelegeUst = belege.reduce((sum, entry) => {
    if (entry.vorsteuerAbzug !== true) return sum;
    const percentage = Number(entry.absetzbarProzent ?? 100);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      throw new Error('FINANCE_RECEIPT_TAX_INVALID');
    }
    return sum + (Number(entry.ustBetrag) || 0) * (percentage / 100);
  }, 0);
  
  let ausgabenFix = 0;
  for (const k of kosten) {
    if (k.giltAb && k.giltAb > bis) continue;
    if (k.giltBis && k.giltBis < von) continue;

    let betrag = Number(k.betrag) || 0;
    if (k.intervall === 'vierteljhrlich' || k.intervall === 'vierteljaehrlich') betrag = betrag / 3;
    else if (k.intervall === 'jhrlich' || k.intervall === 'jaehrlich') betrag = betrag / 12;
    else if (k.intervall === 'einmalig') {
       const giltAbMonth = k.giltAb ? k.giltAb.substring(0, 7) : null;
       const queryMonth = von.substring(0, 7);
       if (giltAbMonth !== queryMonth) betrag = 0;
    }
    
    // We add the proportion to ausgabenFix, but the original code mapped them later to Kategorien...
    // Since we overwrote betrag in 'k', we must assign it back so the Kategorien grouping works correctly.
    k.betrag = betrag.toString();
    ausgabenFix += betrag;
  }

  const zahllast = (ust19 + ust7) - ausgabenBelegeUst;
  const bwaErgebnis = einnahmenNetto - ausgabenBelegeNetto - ausgabenFix;

  // Kategorien gruppieren
  const kategorienMap = new Map<string, { summe: number, anzahl: number }>();

  const alleKategorien = await db.select().from(kategorie);
  const katIdToName = new Map(alleKategorien.map(k => [k.id, k.name]));
  
  for (const b of belege) {
    const katName = b.kategorieId ? katIdToName.get(b.kategorieId) || 'Unkategorisiert' : 'Unkategorisiert';
    const entry = kategorienMap.get(katName) || { summe: 0, anzahl: 0 };
    entry.summe += (Number(b.netto) || 0);
    entry.anzahl += 1;
    kategorienMap.set(katName, entry);
  }

  for (const k of kosten) {
    const katName = k.kategorie || 'Unkategorisiert';
    const entry = kategorienMap.get(katName) || { summe: 0, anzahl: 0 };
    entry.summe += (Number(k.betrag) || 0);
    entry.anzahl += 1;
    kategorienMap.set(katName, entry);
  }

  const kategorienArr: KategorieSumme[] = Array.from(kategorienMap.entries()).map(([name, data]) => ({
    kategorieId: name, // Using name as ID for now
    kategorieName: name,
    summe: data.summe,
    anzahl: data.anzahl
  })).sort((a, b) => b.summe - a.summe);

  const ustva: UstvaWerte = {
    zeitraumVon: von,
    zeitraumBis: bis,
    umsatz19: umsatz19,
    ust19: ust19,
    umsatz7: umsatz7,
    ust7: ust7,
    umsatz0: umsatz0,
    vorsteuer: ausgabenBelegeUst,
    zahllast: zahllast,
    status: 'berechnet'
  };

  const pendingBelege = await db
    .select({ id: beleg.id })
    .from(beleg)
    .where(and(
      eq(beleg.status, 'pruefen'),
      gte(beleg.erfasstAm, new Date(`${von}T00:00:00.000Z`)),
      lte(beleg.erfasstAm, new Date(`${bis}T23:59:59.999Z`)),
    ));
  const [settings] = await db
    .select()
    .from(bhEinstellungen)
    .where(eq(bhEinstellungen.id, 'default'))
    .limit(1);
  const schwelle = Number(settings?.ocrConfidenceSchwelle ?? 85);
  const stundensatz = Number(settings?.beraterStundensatz ?? 120);
  const minutenProBeleg = settings?.minutenProBeleg ?? 4;
  if (
    !Number.isFinite(schwelle) || schwelle < 0 || schwelle > 100
    || !Number.isFinite(stundensatz) || stundensatz < 0
    || !Number.isInteger(minutenProBeleg) || minutenProBeleg < 0
  ) {
    throw new Error('FINANCE_SETTINGS_INVALID');
  }
  const autoBelegeCount = belege.filter((entry) => (
    (normalizeOcrConfidencePercent(Number(entry.ocrConfidence ?? 0)) ?? 0) >= schwelle
  )).length;
  const gespart = autoBelegeCount * minutenProBeleg * (stundensatz / 60);
  const prozent = belege.length > 0 ? (autoBelegeCount / belege.length) * 100 : 0;

  const ersparnis: Ersparnis = {
    jahr: new Date(von).getFullYear(),
    minutenProBeleg,
    beraterStundensatz: stundensatz,
    betrag: gespart,
    anzahlAutoBelege: autoBelegeCount,
    prozentAutomatisch: Math.round(prozent)
  };

  return {
    ustva,
    bwa: {
      ergebnis: bwaErgebnis,
      einnahmen: einnahmenNetto,
      ausgaben: ausgabenBelegeNetto + ausgabenFix,
    },
    kategorien: kategorienArr,
    ersparnis,
    belegCount: belege.length,
    reviewCount: pendingBelege.length,
  };
}
function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value)
  if (raw.length > 2_000 || raw.includes('\0')) throw new Error('FINANCE_EXPORT_VALUE_INVALID')
  const flattened = raw.replace(/[\r\n\t]+/g, ' ')
  const trimmed = flattened.trimStart()
  const numeric = /^-?\d+(?:[.,]\d+)?$/.test(trimmed)
  const formulaSafe = !numeric && /^[=+\-@]/.test(trimmed) ? `'${flattened}` : flattened
  return `"${formulaSafe.replaceAll('"', '""')}"`
}

function exportDate(value: unknown): Date {
  const date = new Date(String(value || ''))
  if (Number.isNaN(date.getTime())) throw new Error('FINANCE_EXPORT_DATE_INVALID')
  return date
}

export async function generateDatevExportAction(von: string, bis: string): Promise<string> {
  await requireFinanceRead()
  assertFinanceDateRange(von, bis)
  const supabase = createSupabaseServiceClient();
  const { data: profileData, error: profileError } = await supabase.from('steuerprofil').select('berater_nr, mandanten_nr, sachkontenrahmen').eq('aktiv', true).limit(1).maybeSingle();
  if (profileError) throw new Error('Steuerprofil konnte nicht geladen werden.')
  const beraterNr = profileData?.berater_nr || '';
  const mandantenNr = profileData?.mandanten_nr || '';
  const { data: belege, error: belegError } = await supabase.from('beleg').select('*').eq('status', 'festgeschrieben').gte('belegdatum', von).lte('belegdatum', bis);
  if (belegError) throw new Error('DATEV-Exportdaten konnten nicht geladen werden.')
  
  const headerLine = [
    'EXTF', 700, 21, 'Buchungsstapel', 4,
    new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14),
    '', '', '', '', beraterNr, mandantenNr,
    `${new Date(`${von}T00:00:00Z`).getUTCFullYear()}0101`, 4,
    von.replace(/-/g, ''), bis.replace(/-/g, ''), '', '', '', '', '',
  ].map(csvCell).join(';')
  const columnHeaders = `"Umsatz";"S/H";"Konto";"Gegenkonto";"BU-Schlüssel";"Belegdatum";"Belegfeld 1";"Buchungstext";"USt-Satz";"Festschreibung"`;
  
  const csvRows: string[] = [];
  if (belege) {
    for (const b of belege) {
      const datum = exportDate(b.belegdatum || b.erfasst_am);
      const ttmm = String(datum.getDate()).padStart(2, '0') + String(datum.getMonth() + 1).padStart(2, '0');
      csvRows.push([
        b.brutto, 'S', b.skr_konto, '1200', '', ttmm,
        typeof b.id === 'string' ? b.id.substring(0, 8) : '',
        b.lieferant_text, b.ust_satz, '1',
      ].map(csvCell).join(';'));
    }
  }

  return headerLine + '\r\n' + columnHeaders + '\r\n' + csvRows.join('\r\n');
}

export async function generateLexwareExportAction(von: string, bis: string): Promise<string> {
  await requireFinanceRead()
  assertFinanceDateRange(von, bis)
  const supabase = createSupabaseServiceClient();
  const { data: belege, error: belegError } = await supabase.from('beleg').select('*').eq('status', 'festgeschrieben').gte('belegdatum', von).lte('belegdatum', bis);
  if (belegError) throw new Error('Lexware-Exportdaten konnten nicht geladen werden.')

  const columnHeaders = `Datum;Belegnummer;Buchungstext;Betrag;USt-Satz;USt-Betrag;Konto;Gegenkonto;S/H`;
  const csvRows: string[] = [];
  if (belege) {
    for (const b of belege) {
      const datum = exportDate(b.belegdatum || b.erfasst_am).toLocaleDateString('de-DE');
      csvRows.push([
        datum,
        typeof b.id === 'string' ? b.id.substring(0, 8) : '',
        b.lieferant_text,
        b.brutto,
        b.ust_satz,
        b.ust_betrag,
        b.skr_konto,
        '1200',
        'S',
      ].map(csvCell).join(';'));
    }
  }

  return columnHeaders + '\r\n' + csvRows.join('\r\n');
}





export async function getL7Daten(filter: { belegart?: string, kategorieId?: string }) {
  await requireFinanceRead()
  const supabase = createSupabaseServiceClient()
  
  let query = supabase.from('beleg').select('konto_id, kostenstelle_id, ust_betrag, konto(nummer, bezeichnung), kostenstelle(kuerzel, name)');
  
  if (filter?.belegart) {
    query = query.eq('belegart', filter.belegart);
  }
  if (filter?.kategorieId) {
    query = query.eq('kategorie_id', filter.kategorieId);
  }

  const { data: belege, error } = await query;

  if (error) {
    console.error('Fehler bei getL7Daten:', error);
    throw new Error('Kontierungsdaten konnten nicht geladen werden.');
  }

  const kontenMap = new Map();
  const ksMap = new Map();
  let ustEffekt = 0;

  for (const b of belege || []) {
    ustEffekt += Number(b.ust_betrag || 0);
    const account = relationRow(b.konto)
    if (account) {
      const nummer = requiredString(account, 'nummer')
      kontenMap.set(nummer, { id: nummer, label: `${nummer} - ${requiredString(account, 'bezeichnung')}` });
    }
    const costCenter = relationRow(b.kostenstelle)
    if (costCenter) {
      const kuerzel = requiredString(costCenter, 'kuerzel')
      ksMap.set(kuerzel, { id: kuerzel, label: `${kuerzel} - ${requiredString(costCenter, 'name')}` });
    }
  }

  const konten = Array.from(kontenMap.values());
  const kostenstellen = Array.from(ksMap.values());
  
  const hasKontierung = konten.length > 0 || ksMap.size > 0;
  if (!hasKontierung && (belege || []).length > 0) {
    return {
      affectedAccounts: [{ id: 'massenzuordnung', label: 'Noch keine Kontierung vorhanden (Link zur Massenzuordnung)' }],
      affectedCostCenters: [],
      periodImpact: 'Aktueller Monat (offen)',
      liquidityImpact: filter?.belegart === 'ausgangsrechnung' ? 'verzögert ~30 Tage' : 'zahlungswirksam',
      taxImpactEur: ustEffekt
    };
  }

  const liquiditaet = filter?.belegart === 'ausgangsrechnung' ? 'verzögert ~30 Tage' : 'zahlungswirksam';
  
  const { data: periodeData } = await supabase.from('v_periodenabschluss_status').select('periode, status').limit(1).maybeSingle();

  return {
    affectedAccounts: konten.length > 0 ? konten : [{ id: 'missing', label: 'Keine spezifischen Konten' }],
    affectedCostCenters: kostenstellen.length > 0 ? kostenstellen : [{ id: 'gesamt', label: 'Gesamtbetrieb' }],
    periodImpact: periodeData ? `${periodeData.periode} (${periodeData.status})` : 'Aktueller Monat (offen)',
    liquidityImpact: liquiditaet,
    taxImpactEur: ustEffekt
  };
}
