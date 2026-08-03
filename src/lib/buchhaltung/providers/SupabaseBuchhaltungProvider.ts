import type { BuchhaltungDataProvider } from './BuchhaltungDataProvider'
import type {
  Beleg, BelegDetail, BelegFilter, BelegFile,
  Ausgangsrechnung, RechnungFilter,
  Zeitraum, KategorieSumme, KraftstoffReport, Bwa,
  CostItem, UstvaWerte, Steuerprofil, Ersparnis,
  ExportDatei
} from '../types'

import {
  listBelegeAction,
  getBelegAction,
  createBelegAction,
  freigebenBelegAction,
  stornoBelegAction,
  exportBelegeAction
} from '@/app/buchhaltung/actions'
import { getSparzaehlerAnalysisAction } from '@/app/buchhaltung/analysis.actions'

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
    formData.append('filename', file.filename);
    formData.append('mimeType', file.mimeType);
    
    let blobData: BlobPart;
    if (typeof file.data === 'string') {
      blobData = file.data;
    } else {
      blobData = file.data;
    }
    const blob = new Blob([blobData], { type: file.mimeType });
    formData.append('file', blob);

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
    void zeitraum;
    return [];
  }

  async getKraftstoffAuswertung(zeitraum: Zeitraum): Promise<KraftstoffReport> {
    void zeitraum;
    return { gesamtkosten: 0, gesamtLiter: 0, durchschnittPreisProLiter: 0, anzahlTankungen: 0, nachSorte: [], nachOrt: [], nachMonat: [] };
  }

  async getBwa(zeitraum: Zeitraum): Promise<Bwa> {
    return { zeitraum, umsatzerloese: 0, materialaufwand: 0, fremdleistungen: 0, deckungsbeitrag: 0, fixkosten: 0, betriebsergebnis: 0, positionen: [] };
  }

  async getFixkosten(): Promise<CostItem[]> {
    return [];
  }

  async getVariableKosten(): Promise<CostItem[]> {
    return [];
  }

  async listOffenePosten(): Promise<Ausgangsrechnung[]> {
    return [];
  }

  async listRechnungen(filter?: RechnungFilter): Promise<Ausgangsrechnung[]> {
    void filter;
    return [];
  }

  async berechneUstva(zeitraum: Zeitraum): Promise<UstvaWerte> {
    try {
      const { getCockpitMetricsAction } = await import('@/app/buchhaltung/actions');
      const metrics = await getCockpitMetricsAction(zeitraum.von, zeitraum.bis);
      return metrics.ustva;
    } catch {
      return { zeitraumVon: zeitraum.von, zeitraumBis: zeitraum.bis, umsatz19: 0, ust19: 0, umsatz7: 0, ust7: 0, umsatz0: 0, vorsteuer: 0, zahllast: 0, status: 'entwurf' };
    }
  }

  async getSteuerprofil(): Promise<Steuerprofil> {
    return { id: '1', bezeichnung: 'GmbH', standardUstSatz: 19, reduziertUstSatz: 7, kleinunternehmer: false, voranmeldungRhythmus: 'monatlich', sachkontenrahmen: 'SKR03' };
  }

  async exportDatev(zeitraum: Zeitraum): Promise<ExportDatei> {
    const res = await exportBelegeAction('DATEV');
    return {
      typ: 'datev',
      dateiname: `EXTF_Buchungsstapel_${zeitraum.von.substring(0, 7)}.csv`,
      inhalt: new Blob([res.csv], { type: 'text/csv' }),
      mimeType: 'text/csv',
      anzahlBuchungen: res.rows.length,
      zeitraum
    };
  }

  async exportLexware(zeitraum: Zeitraum): Promise<ExportDatei> {
    const res = await exportBelegeAction('Lexware');
    return {
      typ: 'lexware',
      dateiname: `Lexware_Export_${zeitraum.von.substring(0, 7)}.csv`,
      inhalt: new Blob([res.csv], { type: 'text/csv' }),
      mimeType: 'text/csv',
      anzahlBuchungen: res.rows.length,
      zeitraum
    };
  }

  async exportSteuerberaterPaket(zeitraum: Zeitraum): Promise<ExportDatei> {
    void zeitraum;
    throw new Error("Nicht implementiert");
  }

  async getErsparnis(jahr: number): Promise<Ersparnis> {
    try {
      const data = await getSparzaehlerAnalysisAction(`${jahr}-01-01`, `${jahr}-12-31`);
      return {
        jahr,
        betrag: data.ersparnisBetrag,
        anzahlAutoBelege: data.anzahlAutoBelege,
        minutenProBeleg: 4,
        beraterStundensatz: 120,
        prozentAutomatisch: data.prozentAutomatisch
      };
    } catch {
      return {
        jahr,
        betrag: 0,
        anzahlAutoBelege: 0,
        minutenProBeleg: 4,
        beraterStundensatz: 120,
        prozentAutomatisch: 0
      };
    }
  }
}
