'use server'

import { createClient } from '@/lib/supabase/server'

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

export async function getPeriodenabschlussStatusAction(): Promise<PeriodenabschlussStatus | null> {
  const supabase = await createClient();
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

export async function runEnergieVerteilungAction(jahr: number, monat: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('fn_verteile_energiekosten', { p_jahr: jahr, p_monat: monat, p_tenant: 'galvanik-kreile' });
  if (error) {
    console.error("Fehler bei der Energie-Verteilung:", error);
    throw new Error('Fehler bei der Energie-Verteilung.');
  }
  return true;
}

export async function schliessePeriodeAction(periodeId: string) {
  const supabase = await createClient();

  // 1. Serverseitige Blocker-Prüfung
  const { data: statusData, error: statusError } = await supabase
    .from('v_periodenabschluss_status')
    .select('*')
    .eq('id', periodeId)
    .single();

  if (statusError || !statusData) {
    throw new Error('Fehler beim Laden des Status für die Validierung.');
  }

  const blockerCount = statusData.belege_ohne_konto + 
                       statusData.belege_ohne_kostenstelle + 
                       statusData.rechnungen_ohne_auftrag + 
                       statusData.auftraege_ohne_db;

  if (blockerCount > 0) {
    throw new Error(`Periode kann nicht geschlossen werden. Es gibt noch ${blockerCount} Blocker.`);
  }

  // 2. Vorläufig schließen
  const { error } = await supabase.from('periode').update({ 
    status: 'vorlaeufig_geschlossen', 
    geschlossen_am: new Date().toISOString() 
  }).eq('id', periodeId);
  
  if (error) {
    console.error("Fehler beim Schließen der Periode:", error);
    throw new Error('Fehler beim Schließen der Periode.');
  }
  return true;
}

export async function finalSchliessePeriodeAction(periodeId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('periode').update({ 
    status: 'final_geschlossen', 
    geschlossen_am: new Date().toISOString() 
  }).eq('id', periodeId);
  
  if (error) {
    console.error("Fehler beim finalen Schließen der Periode:", error);
    throw new Error('Fehler beim finalen Schließen der Periode.');
  }
  return true;
}
