"use server";
import type {InvoiceTruthRow} from "@/lib/server/invoiceTruthRead";
import {invoiceAgingBucket} from "@/lib/domain/invoiceAgingContract";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";

import {
  createAuthorizedDataClient,
  createClient,
} from '@/lib/supabase/server';
import { hasAuthorizationArea, resolveAuthorization } from '@/lib/server/authorization';
import { APP_TENANT_ID } from '@/lib/server/appSession';
import type { KontextDaten } from '@/lib/whatif/engine';

async function requireCockpitRead(): Promise<void> {
  const result = await resolveAuthorization();
  if (
    !result.ok ||
    result.data.tenantId !== APP_TENANT_ID ||
    !hasAuthorizationArea(result.data, 'wartung')
  ) {
    throw new Error('NOT_AVAILABLE: Cockpit-Datenzugriff erfordert den Bereich Wartung.');
  }
}

export interface EngpassStation {
  kostenstelle_id: string;
  kuerzel: string;
  name: string;
  auslastung_quote: number | null;
  engpass_score: number | null;
  warteschlange_aktuell: number | null;
}

export interface WaitingOrder {
  id: string;
  order_number: string;
  intake_date: string | null;
  current_station: string | null;
}

export interface EngpassDetails {
  waitingOrders: WaitingOrder[];
}

export interface ActiveWarning {
  id: string;
  typ: string;
  titel: string;
  beschreibung: string;
  schwere: string;
  link: string | null;
  erzeugt_am: string | null;
}

export interface KundeClvKachelRow {
  customer_id: string;
  name: string;
  umsatz_gesamt: number;
  db_gesamt: number;
  letzter_auftrag: string | null;
}

export interface KundeClvDetail extends KundeClvKachelRow {
  company_name: string | null;
  kundentyp: string | null;
  db_marge: number | null;
  auftraege_gesamt: number;
  email: string | null;
}

export interface AgingData {
  aging_bucket: string;
  anzahl: number;
  summe: number;
}

export interface AgingInvoiceRow {
  id: string;
  rechnungsnummer: string;
  customer_id: string | null;
  kunde_name: string | null;
  netto: number | null;
  faellig_am: string | null;
  tage_ueberfaellig: number | null;
  mahnstufe: number | null;
}

export interface AuftragDbRankingRow {
  order_id: string;
  order_number: string;
  kunde_name: string | null;
  erloes_netto: number;
  deckungsbeitrag: number;
}

export interface AuftragDbDetails extends AuftragDbRankingRow {
  customer_id: string;
  material_kosten: number;
  arbeitszeit_kosten: number;
  energie_anteil_kosten: number;
}

export interface ForecastMonat {
  monat: string;
  erloes_netto: number;
  ergebnis: number;
}

export interface PipelineForecastRow {
  erwarteter_monat: string;
  pipeline_wert_gewichtet: number;
  pipeline_wert_ungewichtet: number;
}

export interface JahresplanWerte {
  monate: Record<string, number>;
}

export interface ForecastDaten {
  monate: ForecastMonat[];
  pipeline: PipelineForecastRow[];
  plan: JahresplanWerte | null;
}

export interface KundenDetailAuftrag {
  id: string;
  order_number: string;
  intake_date: string | null;
  due_date: string | null;
  status: string;
  umsatz: number;
  db: number;
}

export async function getCockpitKpis() {
  await requireCockpitRead();
  const openInvoices=await canonicalOpenInvoices();
  const supabase = await createClient();
  
  // v_monatsergebnis for current month
  const { data: monatsergebnis } = await supabase
    .from('v_monatsergebnis')
    .select('erloes_netto, ergebnis, monat')
    .limit(1)
    .maybeSingle();

  const openCents=openInvoices.reduce((sum,row)=>sum+row.openAmountCents,0);
  if(!Number.isSafeInteger(openCents))throw Error('INVOICE_OPEN_TOTAL_RANGE_INVALID');
  const offeneForderungen=openCents/100;
  const ueberfaelligCount=openInvoices.filter(row=>row.overdue).length;

  const umsatz = monatsergebnis?.erloes_netto || 0;
  const db = monatsergebnis?.ergebnis || 0;
  const dbMarge = umsatz > 0 ? (db / umsatz) : 0;
  
  // Liquidität
  let liquiditaet = 'Stabil';
  if (offeneForderungen > (umsatz * 0.5)) {
    liquiditaet = 'Kritisch';
  } else if (offeneForderungen > (umsatz * 0.2)) {
    liquiditaet = 'Warnung';
  }

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data: zeiten } = await supabase
    .from('arbeitszeit_buchung')
    .select('kostenstelle_kuerzel, dauer_minuten, kostensatz_eur_pro_stunde')
    .eq('tenant_id', KREILE_TENANT_SLUG)
    .gte('start_zeit', firstDay);

  const umsatzNachStation: Record<string, number> = {};
  if (zeiten) {
    for (const z of zeiten) {
      if (z.kostenstelle_kuerzel) {
        if (!umsatzNachStation[z.kostenstelle_kuerzel]) umsatzNachStation[z.kostenstelle_kuerzel] = 0;
        umsatzNachStation[z.kostenstelle_kuerzel] += ((z.dauer_minuten || 0) / 60.0) * (z.kostensatz_eur_pro_stunde || 0);
      }
    }
  }

  return { 
    umsatz, 
    db, 
    dbMarge, 
    offeneForderungen, 
    ueberfaelligCount,
    liquiditaet,
    umsatzNachStation
  };
}

export async function getTopKunden(limit = 10): Promise<KundeClvKachelRow[]> {
  await requireCockpitRead();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_kunde_clv')
    .select('*')
    .order('db_gesamt', { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error getTopKunden:", error.message, error.details, error.hint);
    return [];
  }
  return data || [];
}

export async function getInaktiveKunden(): Promise<KundeClvKachelRow[]> {
  await requireCockpitRead();
  const supabase = await createClient();
  
  const nineMonthsAgo = new Date();
  nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9);
  
  const { data, error } = await supabase
    .from('v_kunde_clv')
    .select('*')
    .lt('letzter_auftrag', nineMonthsAgo.toISOString())
    .gte('auftraege_gesamt', 3);

  if (error) {
    console.error("Error getInaktiveKunden:", error.message, error.details, error.hint);
    return [];
  }
  return data || [];
}

export async function getEngpassDaten(): Promise<EngpassStation[]> {
  await requireCockpitRead();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_engpass')
    .select('*')
    .order('engpass_score', { ascending: false });

  if (error) {
    console.error("Error getEngpassDaten:", error.message, error.details, error.hint);
    return [];
  }
  return data || [];
}

async function canonicalOpenInvoices():Promise<InvoiceTruthRow[]>{
 const {getInvoiceTruthAction}=await import('@/app/actions/invoices.actions');
 const result=await getInvoiceTruthAction();
 if(result.code!=='OK')throw Error(result.message);
 return result.data.filter(row=>row.status==='issued'&&row.openAmountCents>0);
}
export async function getAgingDaten(): Promise<AgingData[]> {
 await requireCockpitRead();
 const rows=await canonicalOpenInvoices();
 const buckets=new Map<string,{aging_bucket:string;anzahl:number;cents:number}>(['nicht_faellig','ohne_faelligkeit','1-14','15-30','31-60','61-90','>90'].map(aging_bucket=>[aging_bucket,{aging_bucket,anzahl:0,cents:0}]));
 for(const row of rows){
  const bucket=buckets.get(invoiceAgingBucket(row));if(!bucket)throw Error('INVOICE_AGING_BUCKET_INVALID');
  bucket.anzahl+=1;bucket.cents+=row.openAmountCents;
  if(!Number.isSafeInteger(bucket.cents))throw Error('INVOICE_AGING_TOTAL_RANGE_INVALID');
 }
 return [...buckets.values()].map(row=>({aging_bucket:row.aging_bucket,anzahl:row.anzahl,summe:row.cents/100}));
}

export async function getAuftragDbRanking(limit = 10): Promise<AuftragDbRankingRow[]> {
  await requireCockpitRead();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_auftrag_db')
    .select('order_id, order_number, kunde_name, erloes_netto, deckungsbeitrag')
    .or('erloes_netto.gt.0,deckungsbeitrag.neq.0')
    .order('deckungsbeitrag', { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error getAuftragDbRanking:", error.message, error.details, error.hint);
    return [];
  }
  return data || [];
}

export async function getWhatIfKontext(): Promise<KontextDaten> {
  await requireCockpitRead();
  const supabase = await createClient();
  const privileged = await createAuthorizedDataClient('wartung');
  
  const kontext: KontextDaten = {
    db_marge_je_ks: {},
    kostensatz_je_ks: {},
    auslastung_je_ks: {},
    verfuegbare_stunden_je_ks: {},
    umsatz_12m_je_kundengruppe: {},
    db_marge_gesamt: 0,
    top_kunden_je_gruppe: {},
    kostenstellen_liste: []
  };

  const { data: kostenstellen } = await privileged
    .from('kostenstelle')
    .select('kuerzel, name, verfuegbare_stunden_monatlich')
    .eq('tenant_id', KREILE_TENANT_SLUG)
    .eq('typ', 'produktion');
  if (kostenstellen) {
    kontext.kostenstellen_liste = kostenstellen.map(ks => ({ kuerzel: ks.kuerzel, name: ks.name }));
    kostenstellen.forEach(ks => {
      if (ks.kuerzel) {
        kontext.verfuegbare_stunden_je_ks[ks.kuerzel] = ks.verfuegbare_stunden_monatlich;
      }
    });
  }

  const { data: engpass } = await supabase.from('v_engpass').select('*');
  if (engpass) {
    engpass.forEach(e => {
      if (e.kuerzel) {
        kontext.auslastung_je_ks[e.kuerzel] = e.auslastung_quote || 0;
        kontext.kostensatz_je_ks[e.kuerzel] = 45; // Default if not found
      }
    });
  }

  const { data: dbData } = await supabase.from('v_auftrag_db').select('current_station, erloes_netto, deckungsbeitrag, status').in('status', ['completed', 'abgeschlossen']);
  if (dbData) {
    const ksStats: Record<string, { u: number, db: number, c: number }> = {};
    let sumU = 0; let sumDb = 0;
    
    dbData.forEach(d => {
      sumU += (d.erloes_netto || 0);
      sumDb += (d.deckungsbeitrag || 0);
      
      const ks = d.current_station;
      if (ks) {
        if (!ksStats[ks]) ksStats[ks] = { u: 0, db: 0, c: 0 };
        ksStats[ks].u += (d.erloes_netto || 0);
        ksStats[ks].db += (d.deckungsbeitrag || 0);
        ksStats[ks].c += 1;
      }
    });
    
    kontext.db_marge_gesamt = sumU > 0 ? sumDb / sumU : 0;
    
    Object.keys(ksStats).forEach(ks => {
      if (ksStats[ks].c >= 3 && ksStats[ks].u > 0) {
        kontext.db_marge_je_ks[ks] = ksStats[ks].db / ksStats[ks].u;
      } else {
        kontext.db_marge_je_ks[ks] = null; // null triggers "Datengrundlage fehlt"
      }
    });
  }

  const { data: clv } = await supabase.from('v_kunde_clv').select('*');
  if (clv) {
    clv.forEach(c => {
      const g = c.kundentyp || 'alle'; // mapped
      if (!kontext.umsatz_12m_je_kundengruppe[g]) kontext.umsatz_12m_je_kundengruppe[g] = 0;
      kontext.umsatz_12m_je_kundengruppe[g] += (c.umsatz_gesamt || 0);
      
      if (!kontext.top_kunden_je_gruppe[g]) kontext.top_kunden_je_gruppe[g] = [];
      kontext.top_kunden_je_gruppe[g].push({ name: c.name, umsatz: c.umsatz_gesamt });
      
      if (g !== 'alle') {
        if (!kontext.umsatz_12m_je_kundengruppe['alle']) kontext.umsatz_12m_je_kundengruppe['alle'] = 0;
        kontext.umsatz_12m_je_kundengruppe['alle'] += (c.umsatz_gesamt || 0);
        if (!kontext.top_kunden_je_gruppe['alle']) kontext.top_kunden_je_gruppe['alle'] = [];
        kontext.top_kunden_je_gruppe['alle'].push({ name: c.name, umsatz: c.umsatz_gesamt });
      }
    });
    
    Object.keys(kontext.top_kunden_je_gruppe).forEach(g => {
      kontext.top_kunden_je_gruppe[g].sort((a, b) => b.umsatz - a.umsatz);
    });
  }
  return kontext;
}

export async function getEngpassDetails(station: string): Promise<EngpassDetails> {
  await requireCockpitRead();
  const supabase = await createClient();
  
  const { data: waitingOrders } = await supabase.from('orders')
    .select('id, order_number, intake_date, current_station')
    .eq('current_station', station)
    .not('status', 'in', '("completed","abgeschlossen","cancelled","storniert")')
    .order('intake_date', { ascending: true })
    .limit(10);
    
  return {
    waitingOrders: waitingOrders || []
  };
}

export async function getAuftragDbDetails(orderId: string): Promise<AuftragDbDetails | null> {
  await requireCockpitRead();
  const supabase = await createClient();
  const { data } = await supabase.from('v_auftrag_db').select('*').eq('order_id', orderId).single();
  return data;
}

export async function getForecastDaten(): Promise<ForecastDaten> {
  await requireCockpitRead();
  const supabase = await createClient();
  const privileged = await createAuthorizedDataClient('wartung');
  const { data: results, error } = await supabase.from('v_monatsergebnis')
    .select('monat, erloes_netto, ergebnis')
    .order('monat', { ascending: true })
    .limit(12);
    
  const { data: pipeline } = await supabase.from('v_pipeline_forecast')
    .select('erwarteter_monat, pipeline_wert_gewichtet, pipeline_wert_ungewichtet')
    .order('erwarteter_monat', { ascending: true });

  const currentYear = new Date().getFullYear();
  const { data: plan } = await privileged.from('forecast_version')
    .select('werte')
    .eq('tenant_id', KREILE_TENANT_SLUG)
    .eq('jahr', currentYear)
    .eq('version_typ', 'plan')
    .eq('ist_aktiv', true)
    .single();

  if (error) {
    console.error("Error getForecastDaten:", error);
    return { monate: [], pipeline: [], plan: null };
  }
  return { monate: results || [], pipeline: pipeline || [], plan: plan?.werte || null };
}

export async function getKundenDetails(customerId: string): Promise<{ clv: KundeClvDetail | null; letzeAuftraege: KundenDetailAuftrag[] }> {
  await requireCockpitRead();
  const supabase = await createClient();
  
  const { data: clv } = await supabase.from('v_kunde_clv').select('*').eq('customer_id', customerId).single();
  const { data: customer } = await supabase.from('customers').select('email').eq('id', customerId).maybeSingle();
  
  const { data: orders } = await supabase.from('orders')
    .select('id, order_number, intake_date, due_date, status')
    .eq('customer_id', customerId)
    .order('intake_date', { ascending: false })
    .limit(5);

  const { data: auftraegeDb } = await supabase.from('v_auftrag_db')
    .select('order_id, order_number, deckungsbeitrag, erloes_netto, intake_date')
    .eq('customer_id', customerId);

  const details: KundenDetailAuftrag[] = orders ? await Promise.all(orders.map(async o => {
    const dbInfo = auftraegeDb?.find(x => x.order_id === o.id);
    return {
      ...o,
      umsatz: dbInfo?.erloes_netto || 0,
      db: dbInfo?.deckungsbeitrag || 0
    };
  })) : [];

  return { clv: clv ? { ...clv, email: customer?.email ?? null } : null, letzeAuftraege: details };
}


export async function getAgingRechnungen(bucket: string): Promise<AgingInvoiceRow[]> {
 await requireCockpitRead();
 return (await canonicalOpenInvoices()).filter(row=>invoiceAgingBucket(row)===bucket)
  .sort((a,b)=>b.overdueDays-a.overdueDays||a.invoiceNumber.localeCompare(b.invoiceNumber))
  .map(row=>({id:row.invoiceId,rechnungsnummer:row.invoiceNumber,customer_id:row.customerId,kunde_name:row.customerName,
   netto:row.netAmountCents/100,faellig_am:row.dueDate,tage_ueberfaellig:row.overdueDays,mahnstufe:null}));
}

export async function getAktiveWarnungen(): Promise<ActiveWarning[]> {
  await requireCockpitRead();
  const supabase = await createAuthorizedDataClient('wartung');
  const { data, error } = await supabase
    .from('warning_event')
    .select('*')
    .eq('tenant_id', KREILE_TENANT_SLUG)
    .is('dismissed_am', null)
    .order('erzeugt_am', { ascending: false });

  if (error) {
    console.error("Error getAktiveWarnungen:", error.message, error.details, error.hint);
    return [];
  }
  
  // Custom sort to put 'kritisch' first, then 'warnung', then 'info'
  const severityOrder: Record<string, number> = { 'kritisch': 1, 'warnung': 2, 'info': 3 };
  const sorted = (data || []).sort((a, b) => {
    const sA = severityOrder[a.schwere] || 99;
    const sB = severityOrder[b.schwere] || 99;
    if (sA !== sB) return sA - sB;
    return new Date(b.erzeugt_am).getTime() - new Date(a.erzeugt_am).getTime();
  });
  
  return sorted;
}

export async function dismissWarnung(id: string, begruendung: string) {
  void id;
  void begruendung;
  return { ok: false as const, error: "NOT_AVAILABLE" as const, message: "NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt." };
}

export async function refreshWarnungen() {
  return { ok: false as const, error: "NOT_AVAILABLE" as const, message: "NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt." };
}

export async function getAktiverJahresplan(jahr: number) {
  await requireCockpitRead();
  const supabase = await createAuthorizedDataClient('wartung');
  const { data, error } = await supabase
    .from('forecast_version')
    .select('*')
    .eq('tenant_id', KREILE_TENANT_SLUG)
    .eq('jahr', jahr)
    .eq('version_typ', 'plan')
    .eq('ist_aktiv', true)
    .maybeSingle();

  if (error) {
    console.error("Error getAktiverJahresplan:", error);
    return null;
  }
  return data;
}

export async function speichereJahresplan(jahr: number, monate: Record<string, number>) {
  void jahr;
  void monate;
  return { ok: false as const, error: "NOT_AVAILABLE" as const, message: "NOT_AVAILABLE: Jahresplan-Speichern benötigt den W3-Command-Vertrag." };
}

export async function savePhoneNote(_data: { customer_id?: string, caller_name?: string, raw_text: string, category: string, urgency: string }) {
  void _data;
  return { ok: false as const, error: "NOT_AVAILABLE" as const, message: "NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt." };
}
