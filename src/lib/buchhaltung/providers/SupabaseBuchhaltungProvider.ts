import type { BuchhaltungDataProvider } from './BuchhaltungDataProvider'
import type {
  Beleg, BelegDetail, BelegFilter, BelegFile,
  Ausgangsrechnung, RechnungFilter,
  Zeitraum, KategorieSumme, KraftstoffReport, Bwa,
  CostItem, UstvaWerte, Steuerprofil, ErsparnisResult,
  ExportDatei
} from '../types'

import {
  listBelegeAction,
  getBelegAction,
  createBelegAction,
  freigebenBelegAction,
  stornoBelegAction,
  generateDatevExportAction,
  generateLexwareExportAction,
  getCockpitMetricsAction,
  getSteuerprofilAction,
  listKostenpostenAction,
  listOffenePostenAction,
  listRechnungenAction,
} from '@/app/buchhaltung/actions'
import {
  getBwaAnalysisAction,
  getKraftstoffAnalysisAction,
  getSparzaehlerAnalysisAction,
} from '@/app/buchhaltung/analysis.actions'
import { createStoredZip } from '../storedZip'

function costStatus(giltAb?: string, giltBis?: string): string {
  const today = new Date().toISOString().substring(0, 10)
  if (giltAb && giltAb > today) return 'zukuenftig'
  if (giltBis && giltBis < today) return 'beendet'
  return 'aktiv'
}

function fuelType(value: string): 'diesel' | 'super' | 'superplus' | 'adblue' | 'unbekannt' {
  const normalized = value.trim().toLowerCase()
  if (normalized.includes('adblue')) return 'adblue'
  if (normalized.includes('diesel')) return 'diesel'
  if (normalized.includes('superplus') || normalized.includes('super plus')) return 'superplus'
  if (normalized.includes('super') || normalized.includes('benzin')) return 'super'
  return 'unbekannt'
}

function bookingCount(csv: string, headerLines: number): number {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0)
  return Math.max(0, lines.length - headerLines)
}

export class SupabaseBuchhaltungProvider implements BuchhaltungDataProvider {
  // ── Belege (Supabase) ─────────────────────────────────────────────────────

  async listBelege(filter?: BelegFilter): Promise<Beleg[]> {
    return await listBelegeAction(filter);
  }

  async getBeleg(id: string): Promise<BelegDetail> {
    return await getBelegAction(id);
  }

  async createBelegFromUpload(file: BelegFile): Promise<Beleg> {
    const formData = new FormData();
    
    let blobData: BlobPart;
    if (typeof file.data === 'string') {
      blobData = file.data;
    } else {
      blobData = file.data;
    }
    const blob = new Blob([blobData], { type: file.mimeType });
    formData.append('file', blob, file.filename);

    return await createBelegAction(formData);
  }

  async freigebenBeleg(id: string, korrektur?: Partial<Beleg>): Promise<Beleg> {
    return await freigebenBelegAction(id, korrektur);
  }

  async stornoBeleg(id: string, grund: string): Promise<Beleg> {
    return await stornoBelegAction(id, grund);
  }

  // ── Auswertung & Co (Live from Actions) ────────────────────────────────────────

  async getAusgabenNachKategorie(zeitraum: Zeitraum): Promise<KategorieSumme[]> {
    const metrics = await getCockpitMetricsAction(zeitraum.von, zeitraum.bis)
    const umsatz = metrics.bwa.einnahmen
    return metrics.kategorien.map((entry) => ({
      ...entry,
      anteilAmUmsatz: umsatz > 0 ? (entry.summe / umsatz) * 100 : undefined,
    }))
  }

  async getKraftstoffAuswertung(zeitraum: Zeitraum): Promise<KraftstoffReport> {
    const data = await getKraftstoffAnalysisAction(zeitraum.von, zeitraum.bis)
    const byType = new Map<ReturnType<typeof fuelType>, { liter: number; kosten: number }>()
    for (const entry of data.nachSorte) {
      const type = fuelType(entry.sorte)
      const current = byType.get(type) || { liter: 0, kosten: 0 }
      current.liter += entry.liter
      current.kosten += entry.kosten
      byType.set(type, current)
    }
    return {
      gesamtkosten: data.gesamtKosten,
      gesamtLiter: data.gesamtLiter,
      durchschnittPreisProLiter: data.avgPreis,
      anzahlTankungen: data.sourceReceiptCount,
      includedReceiptCount: data.includedReceiptCount,
      missingDetailCount: data.missingDetailCount,
      missingLiterCount: data.missingLiterCount,
      missingAmountCount: data.missingAmountCount,
      missingInputCount: data.missingInputCount,
      dataState: data.dataState,
      nachSorte: [...byType.entries()].map(([sorte, values]) => ({ sorte, ...values })),
      nachOrt: data.nachOrt,
      nachMonat: data.nachMonat,
    }
  }

  async getBwa(zeitraum: Zeitraum): Promise<Bwa> {
    const data = await getBwaAnalysisAction(zeitraum.von, zeitraum.bis)
    const positionen: Bwa['positionen'] = [
      { bezeichnung: 'Umsatzerloese', betrag: data.einnahmen, typ: 'einnahme' },
      { bezeichnung: 'Materialaufwand', betrag: data.material, typ: 'ausgabe_variabel' },
      { bezeichnung: 'Fremdleistungen', betrag: data.fremdleistungen, typ: 'ausgabe_variabel' },
      { bezeichnung: 'Nicht fachlich zugeordnete Belege', betrag: data.nichtZugeordnet, typ: 'ausgabe_variabel' },
      { bezeichnung: 'Sonstige variable Betriebskosten', betrag: data.betrieb + data.variableKosten, typ: 'ausgabe_variabel' },
      { bezeichnung: 'Personalkosten', betrag: data.personal, typ: 'ausgabe_fix' },
      { bezeichnung: 'Fixkosten', betrag: data.fixkosten, typ: 'ausgabe_fix' },
    ].filter((entry) => entry.betrag !== 0) as Bwa['positionen']
    return {
      zeitraum,
      umsatzerloese: data.einnahmen,
      materialaufwand: data.material,
      fremdleistungen: data.fremdleistungen,
      nichtZugeordnet: data.nichtZugeordnet,
      deckungsbeitrag: data.deckungsbeitrag,
      fixkosten: data.fixkosten + data.personal,
      betriebsergebnis: data.betriebsergebnis,
      truthStatus: data.truthStatus,
      missingInputCount: data.missingInputCount,
      positionen,
    }
  }

  async getFixkosten(): Promise<CostItem[]> {
    const costs = await listKostenpostenAction({ art: 'fix' })
    return costs.map((cost) => ({
      id: cost.id,
      name: cost.bezeichnung,
      amount: cost.betrag,
      interval: cost.intervall,
      category: 'fix',
      status: costStatus(cost.giltAb, cost.giltBis),
    }))
  }

  async getVariableKosten(): Promise<CostItem[]> {
    const costs = await listKostenpostenAction({ art: 'variabel' })
    return costs.map((cost) => ({
      id: cost.id,
      name: cost.bezeichnung,
      amount: cost.betrag,
      interval: cost.intervall,
      category: 'variabel',
      status: costStatus(cost.giltAb, cost.giltBis),
    }))
  }

  async listOffenePosten(): Promise<Ausgangsrechnung[]> {
    return listOffenePostenAction()
  }

  async listRechnungen(filter?: RechnungFilter): Promise<Ausgangsrechnung[]> {
    return listRechnungenAction(filter)
  }

  async berechneUstva(zeitraum: Zeitraum): Promise<UstvaWerte> {
    const metrics = await getCockpitMetricsAction(zeitraum.von, zeitraum.bis)
    return metrics.ustva
  }

  async getSteuerprofil(): Promise<Steuerprofil> {
    return getSteuerprofilAction()
  }

  async exportDatev(zeitraum: Zeitraum): Promise<ExportDatei> {
    const csv = await generateDatevExportAction(zeitraum.von, zeitraum.bis)
    return {
      typ: 'datev',
      dateiname: `EXTF_Buchungsstapel_${zeitraum.von.substring(0, 7)}.csv`,
      inhalt: new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      mimeType: 'text/csv',
      anzahlBuchungen: bookingCount(csv, 2),
      zeitraum
    };
  }

  async exportLexware(zeitraum: Zeitraum): Promise<ExportDatei> {
    const csv = await generateLexwareExportAction(zeitraum.von, zeitraum.bis)
    return {
      typ: 'lexware',
      dateiname: `Lexware_Export_${zeitraum.von.substring(0, 7)}.csv`,
      inhalt: new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      mimeType: 'text/csv',
      anzahlBuchungen: bookingCount(csv, 1),
      zeitraum
    };
  }

  async exportSteuerberaterPaket(zeitraum: Zeitraum): Promise<ExportDatei> {
    const [datev, lexware] = await Promise.all([
      generateDatevExportAction(zeitraum.von, zeitraum.bis),
      generateLexwareExportAction(zeitraum.von, zeitraum.bis),
    ])
    const period = `${zeitraum.von}_${zeitraum.bis}`
    const datevName = `EXTF_Buchungsstapel_${period}.csv`
    const lexwareName = `Lexware_Export_${period}.csv`
    const manifest = JSON.stringify({
      schemaVersion: 1,
      zeitraum,
      files: [
        { name: datevName, format: 'DATEV-EXTF', bookings: bookingCount(datev, 2) },
        { name: lexwareName, format: 'Lexware-CSV', bookings: bookingCount(lexware, 1) },
      ],
      receiptsIncluded: false,
      note: 'Belegdateien sind in diesem Export nicht enthalten.',
    }, null, 2)
    const archive = createStoredZip([
      { name: datevName, content: datev },
      { name: lexwareName, content: lexware },
      { name: 'manifest.json', content: manifest },
    ])
    const archiveCopy = new Uint8Array(archive.byteLength)
    archiveCopy.set(archive)
    return {
      typ: 'steuerberater_zip',
      dateiname: `Steuerberater_Paket_${period}.zip`,
      inhalt: new Blob([archiveCopy.buffer], { type: 'application/zip' }),
      mimeType: 'application/zip',
      anzahlBuchungen: bookingCount(datev, 2),
      zeitraum,
    }
  }

  async getErsparnis(jahr: number): Promise<ErsparnisResult> {
    return getSparzaehlerAnalysisAction(`${jahr}-01-01`, `${jahr}-12-31`)
  }
}
