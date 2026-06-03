'use server'

import { createClient } from '@/lib/supabase/server'
import type { Beleg, BelegDetail, BelegFilter } from '@/lib/buchhaltung/types'

/**
 * Ruft die Liste der Belege aus der Datenbank ab.
 */
export async function listBelegeAction(filter?: BelegFilter): Promise<Beleg[]> {
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
  const supabase = await createClient()
  
  // Nur 'pruefen' oder 'erfasst' dürfen bearbeitet/freigegeben werden
  const { data: current, error: fetchError } = await supabase.from('beleg').select('status').eq('id', id).single()
  if (fetchError || !current) throw new Error('Beleg nicht gefunden.')
  if (current.status === 'festgeschrieben' || current.status === 'storniert') {
    throw new Error('Dieser Beleg ist bereits festgeschrieben oder storniert und kann nicht freigegeben werden.')
  }
  
  const payload: any = { status: 'erfasst' }
  
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

// ── Helper ────────────────────────────────────────────────────────────

function mapToClientBeleg(dbData: any): Beleg {
  return {
    id: dbData.id,
    erfasstAm: dbData.erfasst_am,
    belegdatum: dbData.belegdatum,
    lieferantId: dbData.lieferant_id,
    lieferantText: dbData.lieferant_text,
    brutto: dbData.brutto,
    netto: dbData.netto,
    ustSatz: dbData.ust_satz,
    ustBetrag: dbData.ust_betrag,
    vorsteuerAbzug: dbData.vorsteuer_abzug,
    kategorieId: dbData.kategorie_id,
    skrKonto: dbData.skr_konto,
    absetzbarProzent: dbData.absetzbar_prozent,
    absetzbarGrund: dbData.absetzbar_grund,
    belegart: dbData.belegart,
    originalDatei: dbData.original_datei,
    originalFormat: dbData.original_format,
    ocrConfidence: dbData.ocr_confidence,
    status: dbData.status as any,
    storniertVon: dbData.storniert_von,
    bankZahlungId: dbData.bank_zahlung_id,
    erstelltVon: dbData.erstellt_von
  }
}
