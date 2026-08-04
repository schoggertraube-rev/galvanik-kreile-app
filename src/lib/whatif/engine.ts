// --- KONTEXT (vom Server geladen) ---
export type KontextDaten = {
  db_marge_je_ks: Record<string, number | null>;   // kuerzel -> Marge 0..1, null wenn Datengrundlage fehlt
  kostensatz_je_ks: Record<string, number>;         // kuerzel -> EUR/h
  auslastung_je_ks: Record<string, number>;         // kuerzel -> 0..1
  verfuegbare_stunden_je_ks: Record<string, number>;
  umsatz_12m_je_kundengruppe: Record<string, number>;
  db_marge_gesamt: number;
  top_kunden_je_gruppe: Record<string, { name: string; umsatz: number }[]>;
  kostenstellen_liste?: { kuerzel: string, name: string }[];
};

// --- INVESTITION ---
export type InvestitionInput = {
  investitionssumme: number;
  lebensdauer_jahre: number;    // Default: 7
  stundenersparnis_tag?: number;
  mehrumsatz_monat?: number;
  kostenstelle_kuerzel: string;
  zinssatz_prozent: number;     // Default: 0 (Eigenmittel)
};
export type InvestitionResult = {
  abschreibung_monatlich: number;
  zins_monatlich: number;
  einsparung_oder_db_monatlich: number;
  netto_monatswirkung: number;
  break_even_monate: number | null;  // null wenn nie
  roi_5_jahre_prozent: number;
  empfehlung: 'ja' | 'abwaegen' | 'nein';
  empfehlung_text: string;
};

export function berechneInvestition(input: InvestitionInput, kontext: KontextDaten): InvestitionResult {
  const abschreibung_monatlich = input.investitionssumme / (input.lebensdauer_jahre * 12);
  const zins_monatlich = (input.investitionssumme * (input.zinssatz_prozent / 100)) / 12; // simplified
  const ks_kostensatz = kontext.kostensatz_je_ks[input.kostenstelle_kuerzel] || 0;
  
  const einsparung = (input.stundenersparnis_tag || 0) * 22 * ks_kostensatz; // 22 Arbeitstage/Monat
  const mehrumsatz_db = (input.mehrumsatz_monat || 0) * (kontext.db_marge_je_ks[input.kostenstelle_kuerzel] || kontext.db_marge_gesamt || 0);
  
  const einsparung_oder_db_monatlich = einsparung + mehrumsatz_db;
  const netto_monatswirkung = einsparung_oder_db_monatlich - abschreibung_monatlich - zins_monatlich;
  
  const cashflow_monatlich = einsparung_oder_db_monatlich - zins_monatlich; // Abschreibung is non-cash, but break even uses cashflow
  let break_even_monate: number | null = null;
  if (cashflow_monatlich > 0) {
    break_even_monate = input.investitionssumme / cashflow_monatlich;
  }
  
  const roi_5_jahre_prozent = cashflow_monatlich > 0 
    ? ((cashflow_monatlich * 60 - input.investitionssumme) / input.investitionssumme) * 100 
    : -100;
  
  let empfehlung: 'ja' | 'abwaegen' | 'nein' = 'nein';
  let empfehlung_text = 'Die Investition rechnet sich wirtschaftlich nicht.';
  
  if (break_even_monate !== null) {
    if (break_even_monate <= 24) {
      empfehlung = 'ja';
      empfehlung_text = `Sehr gute Investition. Amortisation bereits nach ${Math.round(break_even_monate)} Monaten.`;
    } else if (break_even_monate <= 48) {
      empfehlung = 'abwaegen';
      empfehlung_text = `Amortisation nach ${Math.round(break_even_monate)} Monaten. Strategisch prüfen.`;
    }
  }

  if (netto_monatswirkung < 0 && empfehlung !== 'nein') {
      empfehlung = 'nein';
      empfehlung_text = 'Negative monatliche Netto-Wirkung (inkl. kalkulatorischer Abschreibung).';
  }

  return {
    abschreibung_monatlich,
    zins_monatlich,
    einsparung_oder_db_monatlich,
    netto_monatswirkung,
    break_even_monate,
    roi_5_jahre_prozent,
    empfehlung,
    empfehlung_text
  };
}

// --- MITARBEITER ---
export type MitarbeiterInput = {
  bruttogehalt_monatlich: number;
  lohnnebenkosten_faktor: number;  // Default: 1.28
  wochenstunden: number;
  urlaubstage: number;             // Default: 28
  krankheitsquote: number;         // Default: 0.04
  kostenstelle_kuerzel: string;
  produktive_quote: number;        // Default: 0.75
  verrechnungssatz: number;
};
export type MitarbeiterResult = {
  vollkosten_monatlich: number;
  produktive_stunden_monatlich: number;
  kostensatz_real: number;
  mehrumsatz_vollauslastung: number;
  db_zusatz_vollauslastung: number;
  netto_effekt: number;
  break_even_auslastung: number;   // z.B. 0.62 = 62%
  empfehlung: 'ja' | 'abwaegen' | 'nein';
  empfehlung_text: string;
};

export function berechneMitarbeiter(input: MitarbeiterInput, kontext: KontextDaten): MitarbeiterResult {
  const vollkosten_monatlich = input.bruttogehalt_monatlich * input.lohnnebenkosten_faktor;
  
  // Jahresarbeitszeit
  const arbeitstage_jahr = 250 - input.urlaubstage - (250 * input.krankheitsquote);
  const stunden_tag = input.wochenstunden / 5;
  const netto_arbeitsstunden_jahr = arbeitstage_jahr * stunden_tag;
  const produktive_stunden_monatlich = (netto_arbeitsstunden_jahr / 12) * input.produktive_quote;
  
  const kostensatz_real = produktive_stunden_monatlich > 0 ? vollkosten_monatlich / produktive_stunden_monatlich : 0;
  
  const mehrumsatz_vollauslastung = produktive_stunden_monatlich * input.verrechnungssatz;
  const marge = kontext.db_marge_je_ks[input.kostenstelle_kuerzel] ?? kontext.db_marge_gesamt ?? 0;
  const db_zusatz_vollauslastung = mehrumsatz_vollauslastung * marge;
  
  const netto_effekt = db_zusatz_vollauslastung - vollkosten_monatlich;
  
  const break_even_auslastung = db_zusatz_vollauslastung > 0 ? vollkosten_monatlich / db_zusatz_vollauslastung : 1;
  
  const aktuelle_auslastung_ks = kontext.auslastung_je_ks[input.kostenstelle_kuerzel] || 0;
  
  let empfehlung: 'ja' | 'abwaegen' | 'nein' = 'nein';
  let empfehlung_text = 'Zu hohes Risiko. Break-Even Auslastung nicht realistisch.';
  
  if (break_even_auslastung <= aktuelle_auslastung_ks) {
    empfehlung = 'ja';
    empfehlung_text = `Die aktuelle Auslastung (${Math.round(aktuelle_auslastung_ks*100)}%) deckt den Break-Even (${Math.round(break_even_auslastung*100)}%). Klare Einstellungsempfehlung.`;
  } else if (break_even_auslastung <= 0.85) {
    empfehlung = 'abwaegen';
    empfehlung_text = `Break-Even bei ${Math.round(break_even_auslastung*100)}% Auslastung. Wenn Auftragslage wächst, vertretbar.`;
  }

  return {
    vollkosten_monatlich,
    produktive_stunden_monatlich,
    kostensatz_real,
    mehrumsatz_vollauslastung,
    db_zusatz_vollauslastung,
    netto_effekt,
    break_even_auslastung,
    empfehlung,
    empfehlung_text
  };
}

// --- PREISERHOEHUNG ---
export type PreisInput = {
  erhoehung_prozent: number;
  kundengruppe: 'alle' | 'stamm' | 'neu' | 'privat' | 'gewerbe'; // mapped to 'alle' or simple matching for now
  abwanderungsquote: number;       // Default: 0.05
};
export type PreisResult = {
  basis_umsatz_12m: number;
  erhoehter_umsatz: number;
  risiko_umsatzverlust: number;
  netto_effekt: number;
  top_5_gefaehrdet: { name: string; umsatz: number }[];
  empfehlung: 'ja' | 'abwaegen' | 'nein';
  empfehlung_text: string;
};

export function berechnePreis(input: PreisInput, kontext: KontextDaten): PreisResult {
  const basis_umsatz_12m = kontext.umsatz_12m_je_kundengruppe[input.kundengruppe] || 0;
  
  const preis_faktor = 1 + (input.erhoehung_prozent / 100);
  const bleibende_quote = 1 - input.abwanderungsquote;
  
  const erhoehter_umsatz = basis_umsatz_12m * bleibende_quote * preis_faktor;
  const risiko_umsatzverlust = basis_umsatz_12m * input.abwanderungsquote;
  
  const netto_effekt = erhoehter_umsatz - basis_umsatz_12m;
  
  const kunden = kontext.top_kunden_je_gruppe[input.kundengruppe] || [];
  const top_5_gefaehrdet = kunden.slice(0, 5);
  
  let empfehlung: 'ja' | 'abwaegen' | 'nein' = 'nein';
  let empfehlung_text = 'Preiserhöhung kompensiert den erwarteten Kundenverlust nicht.';
  
  if (netto_effekt > 0) {
    if (input.abwanderungsquote <= 0.1) {
      empfehlung = 'ja';
      empfehlung_text = `Positiver Netto-Effekt von € ${Math.round(netto_effekt)}. Die erwartete Abwanderung ist vertretbar.`;
    } else {
      empfehlung = 'abwaegen';
      empfehlung_text = `Zwar positiv (€ ${Math.round(netto_effekt)}), aber hohe erwartete Abwanderung birgt strategische Risiken.`;
    }
  }

  return {
    basis_umsatz_12m,
    erhoehter_umsatz,
    risiko_umsatzverlust,
    netto_effekt,
    top_5_gefaehrdet,
    empfehlung,
    empfehlung_text
  };
}

// --- NEUKUNDE ---
export type NeukundeInput = {
  auftragswert: number;
  stunden_pro_auftrag: number;
  haeufigkeit_jahr: number;
  hauptstation: string;
  zahlungsfrist_tage: number;      // Default: 30
};
export type NeukundeResult = {
  jahresumsatz: number;
  db_jahr: number;
  zusatz_auslastung_stunden: number;
  auslastung_nach_annahme: number;
  working_capital_bedarf: number;
  empfehlung: 'ja' | 'engpass_beachten' | 'nein';
  empfehlung_text: string;
};

export function berechneNeukunde(input: NeukundeInput, kontext: KontextDaten): NeukundeResult {
  const jahresumsatz = input.auftragswert * input.haeufigkeit_jahr;
  const marge = kontext.db_marge_je_ks[input.hauptstation] ?? kontext.db_marge_gesamt ?? 0;
  const db_jahr = jahresumsatz * marge;
  
  const zusatz_auslastung_stunden = input.stunden_pro_auftrag * input.haeufigkeit_jahr;
  
  // umrechnen auf Monatsbasis für Auslastungsquote
  const zusatz_stunden_monat = zusatz_auslastung_stunden / 12;
  const verfuegbar = kontext.verfuegbare_stunden_je_ks[input.hauptstation] || 1;
  const aktuelle_auslastung = kontext.auslastung_je_ks[input.hauptstation] || 0;
  
  const auslastung_nach_annahme = aktuelle_auslastung + (zusatz_stunden_monat / verfuegbar);
  
  // Working capital
  const jahres_kosten = jahresumsatz - db_jahr;
  const kosten_pro_tag = jahres_kosten / 365;
  const working_capital_bedarf = kosten_pro_tag * input.zahlungsfrist_tage;
  
  let empfehlung: 'ja' | 'engpass_beachten' | 'nein' = 'nein';
  let empfehlung_text = 'Auftrag bringt voraussichtlich negativen Deckungsbeitrag.';
  
  if (db_jahr > 0) {
    if (auslastung_nach_annahme <= 0.95) {
      empfehlung = 'ja';
      empfehlung_text = 'Positiver DB und Auslastung der Hauptstation bleibt im grünen Bereich.';
    } else {
      empfehlung = 'engpass_beachten';
      empfehlung_text = `ACHTUNG: Auslastung der Station ${input.hauptstation} steigt auf ${Math.round(auslastung_nach_annahme*100)}%. Engpassgefahr!`;
    }
  }

  return {
    jahresumsatz,
    db_jahr,
    zusatz_auslastung_stunden,
    auslastung_nach_annahme,
    working_capital_bedarf,
    empfehlung,
    empfehlung_text
  };
}
