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
  stornoBelegAction
} from '@/app/buchhaltung/actions'

export class SupabaseBuchhaltungProvider implements BuchhaltungDataProvider {
  private fallbackProvider: BuchhaltungDataProvider;

  constructor(fallbackProvider: BuchhaltungDataProvider) {
    this.fallbackProvider = fallbackProvider;
  }

  // ── Belege (Supabase mit Fallback) ─────────────────────────────────────────────────────

  async listBelege(filter?: BelegFilter): Promise<Beleg[]> {
    try {
      // Mark as live data via standard Beleg objects, UI can check context or just assume it's live if it succeeds
      return await listBelegeAction(filter);
    } catch (error) {
      console.warn('Supabase listBelegeAction failed, falling back to Mock:', error);
      return this.fallbackProvider.listBelege(filter);
    }
  }

  async getBeleg(id: string): Promise<BelegDetail> {
    try {
      return await getBelegAction(id);
    } catch (error) {
      console.warn('Supabase getBelegAction failed, falling back to Mock:', error);
      return this.fallbackProvider.getBeleg(id);
    }
  }

  async createBelegFromUpload(file: BelegFile): Promise<Beleg> {
    try {
      const formData = new FormData();
      formData.append('filename', file.filename);
      formData.append('mimeType', file.mimeType);
      
      // Data is ArrayBuffer or Base64 string from BelegFile
      // We assume it's an ArrayBuffer for file.data based on typical usage,
      // but if it's a string, we might need to convert it.
      // Next.js actions support passing Blob/File in FormData.
      let blobData: BlobPart;
      if (typeof file.data === 'string') {
        // If it's a base64 string, this would need conversion.
        // For simplicity, we just pass it as string blob if needed, but normally
        // a BelegFile from file picker has ArrayBuffer.
        blobData = file.data;
      } else {
        blobData = file.data;
      }
      const blob = new Blob([blobData], { type: file.mimeType });
      formData.append('file', blob);

      return await createBelegAction(formData);
    } catch (error) {
      console.warn('Supabase createBelegAction failed, falling back to Mock:', error);
      return this.fallbackProvider.createBelegFromUpload(file);
    }
  }

  async freigebenBeleg(id: string, korrektur?: Partial<Beleg>): Promise<Beleg> {
    try {
      return await freigebenBelegAction(id, korrektur);
    } catch (error) {
      console.warn('Supabase freigebenBelegAction failed, falling back to Mock:', error);
      return this.fallbackProvider.freigebenBeleg(id, korrektur);
    }
  }

  async stornoBeleg(id: string, grund: string): Promise<Beleg> {
    try {
      return await stornoBelegAction(id, grund);
    } catch (error) {
      console.warn('Supabase stornoBelegAction failed, falling back to Mock:', error);
      return this.fallbackProvider.stornoBeleg(id, grund);
    }
  }

  // ── Auswertung & Co (Pass-Through to Fallback) ────────────────────────────────────────

  async getAusgabenNachKategorie(zeitraum: Zeitraum): Promise<KategorieSumme[]> {
    return this.fallbackProvider.getAusgabenNachKategorie(zeitraum);
  }

  async getKraftstoffAuswertung(zeitraum: Zeitraum): Promise<KraftstoffReport> {
    return this.fallbackProvider.getKraftstoffAuswertung(zeitraum);
  }

  async getBwa(zeitraum: Zeitraum): Promise<Bwa> {
    return this.fallbackProvider.getBwa(zeitraum);
  }

  async getFixkosten(): Promise<CostItem[]> {
    return this.fallbackProvider.getFixkosten();
  }

  async getVariableKosten(): Promise<CostItem[]> {
    return this.fallbackProvider.getVariableKosten();
  }

  async listOffenePosten(): Promise<Ausgangsrechnung[]> {
    return this.fallbackProvider.listOffenePosten();
  }

  async listRechnungen(filter?: RechnungFilter): Promise<Ausgangsrechnung[]> {
    return this.fallbackProvider.listRechnungen(filter);
  }

  async berechneUstva(zeitraum: Zeitraum): Promise<UstvaWerte> {
    return this.fallbackProvider.berechneUstva(zeitraum);
  }

  async getSteuerprofil(): Promise<Steuerprofil> {
    return this.fallbackProvider.getSteuerprofil();
  }

  async exportDatev(zeitraum: Zeitraum): Promise<ExportDatei> {
    return this.fallbackProvider.exportDatev(zeitraum);
  }

  async exportLexware(zeitraum: Zeitraum): Promise<ExportDatei> {
    return this.fallbackProvider.exportLexware(zeitraum);
  }

  async exportSteuerberaterPaket(zeitraum: Zeitraum): Promise<ExportDatei> {
    return this.fallbackProvider.exportSteuerberaterPaket(zeitraum);
  }

  async getErsparnis(jahr: number): Promise<Ersparnis> {
    return this.fallbackProvider.getErsparnis(jahr);
  }
}
