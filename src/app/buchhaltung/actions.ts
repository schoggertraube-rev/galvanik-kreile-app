'use server'

import { createClient } from '@/lib/supabase/server'
import type { Beleg, BelegDetail, BelegFilter, Ausgangsrechnung, RechnungFilter, AusgangsrechnungPosition , Kostenposten, KostenpostenFilter } from '@/lib/buchhaltung/types'
import { foundationUnavailableAction, isFoundationAreaEnabled } from '@/lib/server/foundationGate'

function assertBuchhaltungContract(): void {
  if (!isFoundationAreaEnabled('Buchhaltung')) {
    foundationUnavailableAction('Buchhaltung')
  }
}

/**
 * Ruft die Liste der Belege aus der Datenbank ab.
 */
export async function listBelegeAction(filter?: BelegFilter): Promise<Beleg[]> {
  assertBuchhaltungContract()
  const supabase = await createClient()
  
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
  assertBuchhaltungContract()
  const supabase = await createClient()
  
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
      
    if (urlData) {
      originalDatei = urlData.signedUrl;
    }
  }

  const detail: BelegDetail = {
    ...mapToClientBeleg(data),
    originalDatei,
    positionen: data.beleg_position || [],
    kraftstoffDetail: data.kraftstoff_detail?.[0], // Assuming 1:1 or 1:M where first is picked
    kategorie: data.kategorie,
    lieferant: data.lieferant,
    kiHinweise: [] // TODO: KI-Logik ggf. serverseitig integrieren
  }
  
  return detail
}

/**
 * Erstellt einen Beleg inkl. Upload in den Storage Bucket.
 */
export async function createBelegAction(formData: FormData): Promise<Beleg> {
  assertBuchhaltungContract()
  const supabase = await createClient()
  
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    throw new Error('Nicht authentifiziert.')
  }
  const userId = authData.user.id
  
  const file = formData.get('file') as File
  const filename = formData.get('filename') as string
  const mimeType = formData.get('mimeType') as string
  
  if (!file) {
    throw new Error('Keine Datei vorhanden.')
  }
  
  // 1. In den Bucket buchhaltung-belege hochladen
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const belegId = crypto.randomUUID()
  const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const storagePath = `${year}/${month}/${belegId}/${safeFilename}`
  
  const { error: uploadError } = await supabase
    .storage
    .from('buchhaltung-belege')
    .upload(storagePath, file, {
      contentType: mimeType,
      upsert: false
    })
    
  if (uploadError) {
    console.error('Upload Error:', uploadError)
    throw new Error('Fehler beim Speichern der Beleg-Datei.')
  }
  
  // 2. Beleg-Datensatz anlegen
  const belegData = {
    id: belegId,
    status: 'pruefen',
    original_datei: storagePath,
    original_format: mimeType,
    erfasst_am: new Date().toISOString(),
    erstellt_von: userId,
    // Mock-Daten für OCR: Da MockOcrProvider genutzt wird, erwarten wir im Frontend
    // ein Fallback oder füllen das hier minimal aus.
    brutto: 0,
    netto: 0,
    vorsteuer_abzug: true,
    absetzbar_prozent: 100
  }
  
  const { data: dbData, error: insertError } = await supabase
    .from('beleg')
    .insert(belegData)
    .select()
    .single()
    
  if (insertError) {
    console.error('Insert Error:', insertError)
    throw new Error('Fehler beim Speichern des Belegs in der Datenbank.')
  }
  
  return mapToClientBeleg(dbData)
}

/**
 * Gibt einen Beleg frei.
 */
export async function freigebenBelegAction(id: string, korrektur?: Partial<Beleg>): Promise<Beleg> {
  assertBuchhaltungContract()
  const supabase = await createClient()
  
  // Nur 'pruefen' oder 'erfasst' dürfen bearbeitet/freigegeben werden
  const { data: current, error: fetchError } = await supabase.from('beleg').select('status').eq('id', id).single()
  if (fetchError || !current) throw new Error('Beleg nicht gefunden.')
  if (current.status === 'festgeschrieben' || current.status === 'storniert') {
    throw new Error('Dieser Beleg ist bereits festgeschrieben oder storniert und kann nicht freigegeben werden.')
  }
  
  const payload: {
    status: 'erfasst'
    brutto?: number
    netto?: number
    ust_betrag?: number
    lieferant_id?: string
    kategorie_id?: string
    belegart?: Beleg['belegart']
    belegdatum?: string
  } = { status: 'erfasst' }
  
  if (korrektur) {
    // Map client fields back to DB schema
    if (korrektur.brutto !== undefined) payload.brutto = korrektur.brutto
    if (korrektur.netto !== undefined) payload.netto = korrektur.netto
    if (korrektur.ustBetrag !== undefined) payload.ust_betrag = korrektur.ustBetrag
    if (korrektur.lieferantId !== undefined) payload.lieferant_id = korrektur.lieferantId
    if (korrektur.kategorieId !== undefined) payload.kategorie_id = korrektur.kategorieId
    if (korrektur.belegart !== undefined) payload.belegart = korrektur.belegart
    if (korrektur.belegdatum !== undefined) payload.belegdatum = korrektur.belegdatum
  }
  
  const { data, error } = await supabase.from('beleg').update(payload).eq('id', id).select().single()
  
  if (error) {
    console.error('Fehler bei Freigabe:', error)
    throw new Error('Fehler beim Freigeben des Belegs.')
  }
  
  return mapToClientBeleg(data)
}

/**
 * Storniert einen Beleg.
 */
export async function stornoBelegAction(id: string, grund: string): Promise<Beleg> {
  assertBuchhaltungContract()
  const supabase = await createClient()
  
  const { data: authData } = await supabase.auth.getUser()
  const userId = authData.user?.id
  
  const { data, error } = await supabase.from('beleg').update({
    status: 'storniert',
    storniert_von: userId
  }).eq('id', id).select().single()
  
  if (error) {
    console.error('Fehler bei Storno:', error)
    throw new Error('Beleg konnte nicht storniert werden.')
  }
  
  return mapToClientBeleg(data)
}

export async function assignBelegeBatchAction(belegIds: string[], updates: { kontoId?: string, kostenstelleId?: string }) {
  assertBuchhaltungContract()
  if (!belegIds.length) return true;
  const supabase = await createClient();
  const payload: { konto_id?: string; kostenstelle_id?: string } = {};
  if (updates.kontoId) payload.konto_id = updates.kontoId;
  if (updates.kostenstelleId) payload.kostenstelle_id = updates.kostenstelleId;

  if (Object.keys(payload).length === 0) return true;

  const { error } = await supabase.from('beleg').update(payload).in('id', belegIds);
  if (error) {
    console.error('Fehler bei Massenzuordnung:', error);
    throw new Error('Fehler bei Massenzuordnung.');
  }
  return true;
}

export async function getKraftstoffTankungenAction() {
  assertBuchhaltungContract()
  const supabase = await createClient()
  const { data, error } = await supabase.from('beleg')
    .select('*, kraftstoff_detail(*)')
    .eq('belegart', 'tankbeleg')
    .order('belegdatum', { ascending: false });

  if (error) {
    console.error('Fehler bei getKraftstoffTankungenAction:', error);
    throw new Error('Tankungen konnten nicht geladen werden.');
  }

  return data.map(dbData => ({
    ...mapToClientBeleg(dbData),
    kraftstoffDetail: dbData.kraftstoff_detail?.[0],
  }));
}

export async function exportBelegeAction(format: "DATEV" | "Lexware" | "CSV") {
  assertBuchhaltungContract()
  const supabase = await createClient()
  
  const { data, error } = await supabase.from('beleg')
    .select('*')
    .eq('status', 'festgeschrieben')
    .order('belegdatum', { ascending: false });

  if (error) {
    console.error('Fehler bei exportBelegeAction:', error);
    throw new Error('Export fehlgeschlagen.');
  }

  const belege = data.map(mapToClientBeleg);

  const rows = belege.map(b => {
    return `${b.belegdatum || b.erfasstAm};${b.lieferantText || "Unbekannt"};${b.skrKonto || ""};${b.kategorieId};${b.brutto};${b.ustSatz || "19%"};${b.ustBetrag || "0,00"};${b.id};${b.status}`;
  });

  return {
    header: "Datum;Lieferant/Kunde;Konto;Kategorie;Betrag;USt-Satz;USt-Betrag;Belegnummer;Status",
    rows,
    csv: "Datum;Lieferant/Kunde;Konto;Kategorie;Betrag;USt-Satz;USt-Betrag;Belegnummer;Status\n" + rows.join('\n')
  };
}

export async function listRechnungenAction(filter?: RechnungFilter): Promise<Ausgangsrechnung[]> {
  assertBuchhaltungContract()
  const supabase = await createClient();
  let query = supabase.from('ausgangsrechnung').select('*').order('datum', { ascending: false });

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
  assertBuchhaltungContract()
  const supabase = await createClient();
  // Offene Posten: Status ist 'offen' oder 'ueberfaellig' oder 'gemahnt'
  const { data, error } = await supabase.from('ausgangsrechnung')
    .select('*')
    .in('status', ['offen', 'ueberfaellig', 'gemahnt'])
    .order('faellig_am', { ascending: true });

  if (error) {
    console.error('Fehler bei listOffenePostenAction:', error);
    throw new Error('Offene Posten konnten nicht geladen werden.');
  }

  return data.map(mapToClientRechnung);
}

// ---------------- Helper -------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`CONTRACT_VIOLATION: ${field} muss ein String sein.`)
  }
  return value
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  throw new Error(`CONTRACT_VIOLATION: ${field} muss eine endliche Zahl sein.`)
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`CONTRACT_VIOLATION: ${field} muss ein Boolean sein.`)
  }
  return value
}

function requireRechnungStatus(value: unknown): Ausgangsrechnung['status'] {
  if (value === 'offen' || value === 'bezahlt' || value === 'ueberfaellig' || value === 'teilbezahlt' || value === 'storniert') {
    return value
  }
  throw new Error('CONTRACT_VIOLATION: ausgangsrechnung.status ist ungueltig.')
}

function requireBelegStatus(value: unknown): Beleg['status'] {
  if (value === 'pruefen' || value === 'erfasst' || value === 'festgeschrieben' || value === 'storniert') {
    return value
  }
  throw new Error('CONTRACT_VIOLATION: beleg.status ist ungueltig.')
}

function optionalBelegart(value: unknown): Beleg['belegart'] {
  if (value === undefined || value === null) {
    return undefined
  }
  if (value === 'rechnung' || value === 'kassenbon' || value === 'tankbeleg' || value === 'bewirtung' || value === 'abo') {
    return value
  }
  throw new Error('CONTRACT_VIOLATION: beleg.belegart ist ungueltig.')
}

function mapToClientRechnung(dbData: Record<string, unknown>): Ausgangsrechnung {
  return {
    id: requireString(dbData.id, 'ausgangsrechnung.id'),
    nummer: requireString(dbData.nummer, 'ausgangsrechnung.nummer'),
    kundeId: optionalString(dbData.kunde_id),
    kundeName: optionalString(dbData.kunde_name),
    datum: requireString(dbData.datum, 'ausgangsrechnung.datum'),
    faelligAm: optionalString(dbData.faellig_am),
    brutto: requireNumber(dbData.brutto, 'ausgangsrechnung.brutto'),
    netto: optionalNumber(dbData.netto),
    ustSatz: optionalNumber(dbData.ust_satz),
    ustBetrag: optionalNumber(dbData.ust_betrag),
    bezahltAm: optionalString(dbData.bezahlt_am),
    status: requireRechnungStatus(dbData.status),
    mahnstufe: requireNumber(dbData.mahnstufe, 'ausgangsrechnung.mahnstufe'),
    erechnungXml: optionalString(dbData.erechnung_xml),
  };
}

function mapToClientBeleg(dbData: Record<string, unknown>): Beleg {
  return {
    id: requireString(dbData.id, 'beleg.id'),
    erfasstAm: requireString(dbData.erfasst_am, 'beleg.erfasst_am'),
    belegdatum: optionalString(dbData.belegdatum),
    lieferantId: optionalString(dbData.lieferant_id),
    lieferantText: optionalString(dbData.lieferant_text),
    brutto: optionalNumber(dbData.brutto),
    netto: optionalNumber(dbData.netto),
    ustSatz: optionalNumber(dbData.ust_satz),
    ustBetrag: optionalNumber(dbData.ust_betrag),
    vorsteuerAbzug: requireBoolean(dbData.vorsteuer_abzug, 'beleg.vorsteuer_abzug'),
    kategorieId: optionalString(dbData.kategorie_id),
    skrKonto: optionalString(dbData.skr_konto),
    absetzbarProzent: requireNumber(dbData.absetzbar_prozent, 'beleg.absetzbar_prozent'),
    absetzbarGrund: optionalString(dbData.absetzbar_grund),
    belegart: optionalBelegart(dbData.belegart),
    originalDatei: requireString(dbData.original_datei, 'beleg.original_datei'),
    originalFormat: optionalString(dbData.original_format),
    ocrConfidence: optionalNumber(dbData.ocr_confidence),
    status: requireBelegStatus(dbData.status),
    rechnungsnummerExtern: optionalString(dbData.rechnungsnummer_extern),
    storniertVon: optionalString(dbData.storniert_von),
    bankZahlungId: optionalString(dbData.bank_zahlung_id),
    erstelltVon: requireString(dbData.erstellt_von, 'beleg.erstellt_von'),
    kontoId: optionalString(dbData.konto_id),
    kostenstelleId: optionalString(dbData.kostenstelle_id),
    periodeId: optionalString(dbData.periode_id),
    istAufAuftragZugeordnet: typeof dbData.ist_auf_auftrag_zugeordnet === 'boolean' ? dbData.ist_auf_auftrag_zugeordnet : undefined,
    zugeordneterOrderId: optionalString(dbData.zugeordneter_order_id)
  }
}

export async function createRechnungAction(formData: FormData, positionen: AusgangsrechnungPosition[]): Promise<Ausgangsrechnung> {
  assertBuchhaltungContract()
  const supabase = await createClient();

  // Validate basic fields
  const nummer = formData.get('nummer') as string;
  const kundeId = formData.get('kundeId') as string;
  const datum = formData.get('datum') as string;
  const faelligAm = formData.get('faelligAm') as string;
  const ustSatz = parseFloat(formData.get('ustSatz') as string || "19");
  const bemerkung = formData.get('bemerkung') as string || null;
  const leadId = formData.get('leadId') as string || null;
  const isDemo = formData.get('isDemo') === "true";

  if (!nummer || !kundeId || !datum || !faelligAm) {
    throw new Error('Bitte füllen Sie alle Pflichtfelder aus.');
  }

  if (positionen.length === 0) {
    throw new Error('Mindestens eine Position muss angegeben werden.');
  }

  let netto = 0;
  for (const pos of positionen) {
    netto += pos.menge * pos.einzelpreisNetto;
  }
  const ustBetrag = netto * (ustSatz / 100);
  const brutto = netto + ustBetrag;

  // Insert Rechnung
  const { data: arData, error: arError } = await supabase.from('ausgangsrechnung').insert({
    nummer,
    kunde_id: kundeId,
    datum,
    faellig_am: faelligAm,
    netto,
    ust_satz: ustSatz,
    ust_betrag: ustBetrag,
    brutto,
    bemerkung,
    lead_id: leadId,
    is_demo: isDemo,
    status: 'offen',
  }).select().single();

  if (arError) {
    console.error("Fehler beim Erstellen der Rechnung:", arError);
    throw new Error('Fehler beim Speichern der Rechnung.');
  }

  // Insert Positionen
  const positionsToInsert = positionen.map(p => ({
    ausgangsrechnung_id: arData.id,
    beschreibung: p.beschreibung,
    menge: p.menge,
    einzelpreis_netto: p.einzelpreisNetto
  }));

  const { error: posError } = await supabase.from('ausgangsrechnung_position').insert(positionsToInsert);
  
  if (posError) {
    console.error("Fehler beim Speichern der Positionen:", posError);
    // Ideally rollback here, but we will keep it simple
  }

  return mapToClientRechnung(arData);
}


export async function getRechnungAction(id: string): Promise<Ausgangsrechnung> {
  assertBuchhaltungContract()
  const supabase = await createClient();
  const { data: arData, error: arError } = await supabase
    .from('ausgangsrechnung')
    .select('*')
    .eq('id', id)
    .single();

  if (arError) {
    throw new Error('Rechnung nicht gefunden.');
  }

  const { data: posData } = await supabase
    .from('ausgangsrechnung_position')
    .select('*')
    .eq('ausgangsrechnung_id', id);

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
  assertBuchhaltungContract()
  const supabase = await createClient();
  let query = supabase.from('kostenposten').select('*').order('betrag', { ascending: false });

  if (filter?.art) {
    query = query.eq('art', filter.art);
  }
  if (filter?.kategorie) {
    query = query.eq('kategorie', filter.kategorie);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Fehler beim Laden der Kostenposten:", error);
    return [];
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
  assertBuchhaltungContract()
  const supabase = await createClient();

  const bezeichnung = formData.get('bezeichnung') as string;
  const art = formData.get('art') as "fix" | "variabel";
  const kategorie = formData.get('kategorie') as string || null;
  const betragStr = formData.get('betrag') as string;
  const intervall = formData.get('intervall') as "einmalig" | "monatlich" | "jaehrlich";
  const belegId = formData.get('belegId') as string || null;
  const kampagneId = formData.get('kampagneId') as string || null;
  const giltAb = formData.get('giltAb') as string || null;
  const giltBis = formData.get('giltBis') as string || null;
  const isDemo = formData.get('isDemo') === "true";

  if (!bezeichnung || !art || !betragStr || !intervall) {
    throw new Error('Bitte füllen Sie alle Pflichtfelder aus.');
  }

  const betrag = parseFloat(betragStr.replace(',', '.'));
  if (isNaN(betrag) || betrag <= 0) {
    throw new Error('Bitte geben Sie einen gültigen Betrag größer 0 ein.');
  }

  const { data, error } = await supabase.from('kostenposten').insert({
    bezeichnung,
    art,
    kategorie,
    betrag,
    intervall,
    beleg_id: belegId,
    kampagne_id: kampagneId,
    gilt_ab: giltAb,
    gilt_bis: giltBis,
    is_demo: isDemo
  }).select().single();

  if (error) {
    console.error("Fehler beim Erstellen des Kostenpostens:", error);
    throw new Error('Fehler beim Speichern des Kostenpostens.');
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

export async function getKostenpostenAction(id: string): Promise<Kostenposten> {
  assertBuchhaltungContract()
  const supabase = await createClient();
  const { data, error } = await supabase.from('kostenposten').select('*').eq('id', id).single();
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


// === COCKPIT & AUSWERTUNGEN ===
import { db } from '@/db';
import { ausgangsrechnung, beleg, kostenposten, kategorie } from '@/db/schema_buchhaltung';
import { and, gte, lte, ne, sql } from 'drizzle-orm';
import { UstvaWerte, Ersparnis, KategorieSumme } from '@/lib/buchhaltung/types';

export async function getCockpitMetricsAction(von: string, bis: string) {
  assertBuchhaltungContract()
  // Einnahmen & USt aus Rechnungen grouped by ustSatz
  const rechnungenGrouped = await db.select({
    ustSatz: ausgangsrechnung.ustSatz,
    nettoSum: sql<number>`sum(CAST(${ausgangsrechnung.netto} AS numeric))`,
    ustSum: sql<number>`sum(CAST(${ausgangsrechnung.ustBetrag} AS numeric))`
  })
    .from(ausgangsrechnung)
    .where(and(
      ne(ausgangsrechnung.status, 'storniert'),
      gte(ausgangsrechnung.datum, von),
      lte(ausgangsrechnung.datum, bis)
    ))
    .groupBy(ausgangsrechnung.ustSatz);

  // Ausgaben & Vorsteuer aus Belegen
  const belege = await db.select({ netto: beleg.netto, ustBetrag: beleg.ustBetrag, kategorieId: beleg.kategorieId, ocrConfidence: beleg.ocrConfidence })
    .from(beleg)
    .where(and(
      ne(beleg.status, 'storniert'),
      gte(beleg.belegdatum, von),
      lte(beleg.belegdatum, bis)
    ));

  // Fixkosten
  const kosten = await db.select({ betrag: kostenposten.betrag, kategorie: kostenposten.kategorie, art: kostenposten.art, intervall: kostenposten.intervall, giltAb: kostenposten.giltAb, giltBis: kostenposten.giltBis })
    .from(kostenposten);

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
  const ausgabenBelegeUst = belege.reduce((sum, b) => sum + (Number(b.ustBetrag) || 0), 0);
  
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

  const SCHWELLE = 85;
  const stundensatz = 120;
  const autoBelegeCount = belege.filter(b => Number(b.ocrConfidence || 0) >= SCHWELLE).length;
  const gespart = autoBelegeCount * 4 * (stundensatz / 60);
  const prozent = belege.length > 0 ? (autoBelegeCount / belege.length) * 100 : 0;

  const ersparnis: Ersparnis = {
    jahr: new Date(von).getFullYear(),
    minutenProBeleg: 4,
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
    ersparnis
  };
}
export async function generateDatevExportAction(von: string, bis: string): Promise<string> {
  assertBuchhaltungContract()
  const supabase = await createClient();
  const { data: profileData } = await supabase.from('steuerprofil').select('berater_nr, mandanten_nr, sachkontenrahmen').limit(1).single();
  const beraterNr = profileData?.berater_nr || '';
  const mandantenNr = profileData?.mandanten_nr || '';
  const skr = profileData?.sachkontenrahmen || 'SKR03';
  const { data: belege } = await supabase.from('beleg').select('*').eq('status', 'festgeschrieben').gte('belegdatum', von).lte('belegdatum', bis);
  
  const headerLine = `"EXTF";700;21;"Buchungsstapel";4;` + new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14) + `;"";"";"";"";"${beraterNr}";"${mandantenNr}";` + new Date(von).getFullYear() + `0101;4;` + von.replace(/-/g, '') + `;` + bis.replace(/-/g, '') + `;"";"";"";"";""`;
  const columnHeaders = `"Umsatz";"S/H";"Konto";"Gegenkonto";"BU-Schlüssel";"Belegdatum";"Belegfeld 1";"Buchungstext";"USt-Satz";"Festschreibung"`;
  
  const csvRows: string[] = [];
  if (belege) {
    for (const b of belege) {
      const datum = new Date(b.belegdatum || b.erfasst_am);
      const ttmm = String(datum.getDate()).padStart(2, '0') + String(datum.getMonth() + 1).padStart(2, '0');
      const ustSatz = b.ust_satz || '19';
      csvRows.push(`"${b.brutto || ''}";"S";"${b.skr_konto || ''}";"1200";"";"${ttmm}";"${b.id.substring(0,8)}";"${b.lieferant_text || ''}";"${ustSatz}";"1"`);
    }
  }

  return headerLine + '\n' + columnHeaders + '\n' + csvRows.join('\n');
}

export async function generateLexwareExportAction(von: string, bis: string): Promise<string> {
  assertBuchhaltungContract()
  const supabase = await createClient();
  const { data: profileData } = await supabase.from('steuerprofil').select('berater_nr, mandanten_nr, sachkontenrahmen').limit(1).single();
  const beraterNr = profileData?.berater_nr || '';
  const mandantenNr = profileData?.mandanten_nr || '';
  const skr = profileData?.sachkontenrahmen || 'SKR03';
  const { data: belege } = await supabase.from('beleg').select('*').eq('status', 'festgeschrieben').gte('belegdatum', von).lte('belegdatum', bis);

  const columnHeaders = `Datum;Belegnummer;Buchungstext;Betrag;USt-Satz;USt-Betrag;Konto;Gegenkonto;S/H`;
  const csvRows: string[] = [];
  if (belege) {
    for (const b of belege) {
      const datum = new Date(b.belegdatum || b.erfasst_am).toLocaleDateString('de-DE');
      const ustSatz = b.ust_satz || '19';
      csvRows.push(`${datum};${b.id.substring(0,8)};${b.lieferant_text || ''};${b.brutto || ''};${ustSatz};${b.ust_betrag || ''};${b.skr_konto || ''};1200;S`);
    }
  }

  return columnHeaders + '\n' + csvRows.join('\n');
}





export async function getL7Daten(filter: { belegart?: string, kategorieId?: string }) {
  assertBuchhaltungContract()
  const supabase = await createClient()
  
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
    return undefined;
  }

  const kontenMap = new Map<string, { id: string; label: string }>();
  const ksMap = new Map<string, { id: string; label: string }>();
  let ustEffekt = 0;
  const rows: Array<Record<string, unknown>> = belege ?? [];

  for (const b of rows) {
    ustEffekt += Number(b.ust_betrag || 0);
    const konto = Array.isArray(b.konto) ? b.konto[0] : b.konto;
    if (isRecord(konto)) {
      const nummer = optionalString(konto.nummer);
      const bezeichnung = optionalString(konto.bezeichnung);
      if (nummer && bezeichnung) {
        kontenMap.set(nummer, { id: nummer, label: `${nummer} - ${bezeichnung}` });
      }
    }
    const kostenstelle = Array.isArray(b.kostenstelle) ? b.kostenstelle[0] : b.kostenstelle;
    if (isRecord(kostenstelle)) {
      const kuerzel = optionalString(kostenstelle.kuerzel);
      const name = optionalString(kostenstelle.name);
      if (kuerzel && name) {
        ksMap.set(kuerzel, { id: kuerzel, label: `${kuerzel} - ${name}` });
      }
    }
  }

  const konten = Array.from(kontenMap.values());
  const kostenstellen = Array.from(ksMap.values());
  
  const hasKontierung = konten.length > 0 || ksMap.size > 0;
  if (!hasKontierung && rows.length > 0) {
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
