'use server'

import { createAuthorizedDataClient } from '@/lib/supabase/server'

export interface PeriodenabschlussStatus {
  id: string;
  jahr: number;
  monat: number;
  status: string;
  geschlossen_am: string | null;
  belege_ohne_konto: number;
  belege_ohne_kostenstelle: number;
  rechnungen_ohne_auftrag: number;
  rechnungen_offen: number;
  auftraege_ohne_db: number;
}

export type PeriodenabschlussCommandDenial = {
  ok: false;
  error: "CONFLICT";
  message: "NOT_AVAILABLE: Periodenabschluss benötigt den W3-Command-Vertrag.";
};

export async function getPeriodenabschlussStatusAction(): Promise<PeriodenabschlussStatus | null> {
  const supabase = await createAuthorizedDataClient('read');
  const { data, error } = await supabase
    .from('v_periodenabschluss_status')
    .select('*')
    .eq('status', 'offen')
    .order('jahr', { ascending: true })
    .order('monat', { ascending: true })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error("Fehler beim Laden des Periodenabschluss-Status:", error);
    throw new Error('Fehler beim Laden des Periodenabschluss-Status.');
  }
  
  return data || null;
}

export async function runEnergieVerteilungAction(jahr: number, monat: number): Promise<PeriodenabschlussCommandDenial> {
  void jahr;
  void monat;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Periodenabschluss benötigt den W3-Command-Vertrag." };
}

export async function schliessePeriodeAction(periodeId: string): Promise<PeriodenabschlussCommandDenial> {
  void periodeId;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Periodenabschluss benötigt den W3-Command-Vertrag." };
}

export async function finalSchliessePeriodeAction(periodeId: string): Promise<PeriodenabschlussCommandDenial> {
  void periodeId;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Periodenabschluss benötigt den W3-Command-Vertrag." };
}
