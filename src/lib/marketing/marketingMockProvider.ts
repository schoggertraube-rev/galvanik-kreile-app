/* ═══════════════════════════════════════════════════════════
   Marketing Studio — Mock Data Provider
   Uses demo data from HTML reference + real customer data where available
   Spec: 21 (Datenmodell), 27 (Build)
   ═══════════════════════════════════════════════════════════ */

import type {
  MarketingDataProvider, AktionVorschlag, Kampagne,
  FunnelDaten, Segment, LernInsight, WirkungMini, StoryIdee, SortMode
} from './marketingTypes';

/* ── Beste Aktion ─────────────────────────────────────────── */
const besteAktion: AktionVorschlag = {
  id: 'a-001',
  status: 'vorschlag', publishCapability: 'proposal_only', publishReason: 'Nur Testdaten; keine Provider-Freigabe.',
  titel: 'Vorher-/Nachher der Oldtimer-Felge posten',
  kanal: 'instagram',
  kanalLabel: 'Instagram',
  score: 94,
  caption: 'Aus matt wird Glanz ✨ Diese Oldtimer-Felge kam rostig zu uns — und ging verchromt zurück.',
  hashtags: '#galvanik #restauration #oldtimer #frankfurt #handwerk',
  begruendung: 'Restaurations-Fotos wirken bei dir 3× stärker als Text — und Dienstag 9–11 Uhr ist dein bestes Fenster. Bild & Text liegen fertig bereit.',
  erwarteterOutput: '~4 Anfragen',
  aufwand: '2 Min',
  kosten: '0 € Kosten',
  varianten: [
    { titel: 'Vorher-/Nachher der Oldtimer-Felge posten', caption: 'Aus matt wird Glanz ✨ Diese Oldtimer-Felge kam rostig zu uns — und ging verchromt zurück.', hashtags: '#galvanik #restauration #oldtimer #frankfurt #handwerk' },
    { titel: 'Detail-Aufnahme der Verchromung posten', caption: 'Spiegelglatt. So sieht frisch verchromtes Metall aus der Nähe aus. 🔍', hashtags: '#verchromung #detail #galvanik #metall' },
    { titel: 'Reel: 15 Sekunden Politur posten', caption: 'Von stumpf zu strahlend in 15 Sekunden. Handarbeit, die man sieht. ▶️', hashtags: '#reel #vorhernachher #politur #kreile' },
  ],
  segment: 'Oldtimer / Fahrzeuge',
  quelle: 'Auftrag #8043',
};

/* ── Alle Vorschläge ──────────────────────────────────────── */
const alleVorschlaege: AktionVorschlag[] = [
  besteAktion,
  {
    id: 'a-002',
    status: 'vorschlag', publishCapability: 'proposal_only', publishReason: 'Nur Testdaten; keine Provider-Freigabe.',
    titel: 'Museen & Restaurierung wecken',
    kanal: 'email',
    kanalLabel: 'E-Mail',
    score: 88,
    caption: 'Lange nichts von uns gehört? Wir frischen Ihre Schätze wieder auf — melden Sie sich gern.',
    hashtags: '#museum #restaurierung #kreile',
    begruendung: '6 Stammkunden seit > 8 Monaten still. Personalisierte Mails bereit.',
    erwarteterOutput: '~2 Anfragen',
    aufwand: '5 Min',
    kosten: '0 € Kosten',
    varianten: [],
    segment: 'Museen / Restaurierung',
    quelle: '6 Stammkunden seit > 8 Monaten still',
  },
  {
    id: 'a-003',
    status: 'vorschlag', publishCapability: 'proposal_only', publishReason: 'Nur Testdaten; keine Provider-Freigabe.',
    titel: '3 Google-Bewertungen anfragen',
    kanal: 'google',
    kanalLabel: 'Google',
    score: 76,
    caption: 'Zufrieden mit unserer Arbeit? Über eine kurze Google-Bewertung freuen wir uns riesig ⭐',
    hashtags: '#bewertung #danke #frankfurt',
    begruendung: 'Zufriedene Kunden der letzten Abholungen fragen.',
    erwarteterOutput: '~3 Bewertungen',
    aufwand: '3 Min',
    kosten: '0 € Kosten',
    varianten: [],
    segment: 'Allgemein',
  },
  {
    id: 'a-004',
    status: 'vorschlag', publishCapability: 'proposal_only', publishReason: 'Nur Testdaten; keine Provider-Freigabe.',
    titel: 'Wissens-Post „Was ist Vernickeln?"',
    kanal: 'instagram',
    kanalLabel: 'Instagram',
    score: 68,
    caption: 'Wussten Sie? Vernickeln schützt Metall jahrzehntelang vor Korrosion. Wir zeigen, wie.',
    hashtags: '#wissen #galvanik #vernickeln',
    begruendung: 'Kurz erklärt, baut Vertrauen & Reichweite auf.',
    erwarteterOutput: '~2 Anfragen',
    aufwand: '5 Min',
    kosten: '0 € Kosten',
    varianten: [],
  },
];

/* ── Kampagnen ────────────────────────────────────────────── */
const kampagnen: Kampagne[] = [
  { id: 'k-1', titel: 'Oldtimer-Saison 2026', kanal: 'Instagram · 6 Posts · läuft', status: 'aktiv', statusLabel: 'Läuft', fortschritt: 66, ergebnis: '+3.200 €', statusColor: 'var(--good, #2E9E6B)' },
  { id: 'k-2', titel: 'Stammkunden-Reaktivierung Q2', kanal: 'E-Mail · 4 Segmente · geplant', status: 'geplant', statusLabel: 'Geplant', fortschritt: 25, ergebnis: 'Prognose +1.800 €', statusColor: 'var(--watch, #C98A12)' },
  { id: 'k-3', titel: 'Bewertungs-Offensive', kanal: 'Google · fortlaufend', status: 'aktiv', statusLabel: 'Fortlaufend', fortschritt: 45, ergebnis: '+8 Bewertungen', statusColor: 'var(--mk2, #C2185B)' },
];

/* ── Funnel ────────────────────────────────────────────────── */
const funnel: FunnelDaten = {
  stufen: [
    { label: 'Posts / Mails', wert: 14, breite: 10 },
    { label: 'Reichweite', wert: 8420, breite: 100 },
    { label: 'Klicks / Profil', wert: 612, breite: 34 },
    { label: 'Anfragen', wert: 23, breite: 18 },
    { label: 'Aufträge', wert: 9, breite: 11 },
  ],
  umsatz: 5760,
  plannedBudget: 0,
  roi: null,
};

/* ── Segmente ──────────────────────────────────────────────── */
const segmente: Segment[] = [
  { id: 's-1', name: 'Oldtimer / Fahrzeuge', emoji: '🚗', kundenAnzahl: null, weckbar: null, evidence: 'membership_not_connected' },
  { id: 's-2', name: 'Schmuck', emoji: '💎', kundenAnzahl: null, weckbar: null, evidence: 'membership_not_connected' },
  { id: 's-3', name: 'Besteck / Silber', emoji: '🍴', kundenAnzahl: null, weckbar: null, evidence: 'membership_not_connected' },
  { id: 's-4', name: 'Kirchen / Institutionen', emoji: '⛪', kundenAnzahl: null, weckbar: null, evidence: 'membership_not_connected' },
  { id: 's-5', name: 'Museen / Restaurierung', emoji: '🏛️', kundenAnzahl: null, weckbar: null, evidence: 'membership_not_connected' },
  { id: 's-6', name: 'Geschäftskunden', emoji: '🏢', kundenAnzahl: null, weckbar: null, evidence: 'membership_not_connected' },
];

/* ── Lern-Insights ─────────────────────────────────────────── */
const lernInsights: LernInsight[] = [
  { id: 'l-1', titel: 'Dienstag 9–11 Uhr ist Gold', text: 'Posts in diesem Fenster bringen <b>3× mehr Profilbesuche</b> als am Wochenende. Aus 18 Posts der letzten 90 Tage.' },
  { id: 'l-2', titel: 'Vorher-/Nachher schlägt alles', text: 'Restaurations-Fotos erzeugen <b>doppelt so viele Anfragen</b> wie Textposts. Format wird bevorzugt vorgeschlagen.' },
  { id: 'l-3', titel: 'Museen reagieren am besten auf Mail', text: 'Reaktivierungs-Quote im Segment Museen liegt bei <b>54 %</b> — deutlich über dem Schnitt.' },
  { id: 'l-4', titel: 'Bewertungen zahlen sich aus', text: 'Jede neue Google-Bewertung korreliert mit <b>~1,5 zusätzlichen Anfragen</b> im Folgemonat.' },
];

/* ── Wirkung-Mini ──────────────────────────────────────────── */
const wirkungMini: WirkungMini[] = [
  { label: 'Anfragen aus Marketing', wert: 23, suffix: '', sparkValues: [30, 45, 40, 62, 55, 85, 100] },
  { label: 'Umsatz daraus', wert: 5760, suffix: ' €', sparkValues: [35, 30, 55, 48, 70, 78, 100] },
  { label: 'Return on Invest', wert: 91, suffix: '×', divisor: 10, sparkValues: [40, 52, 48, 66, 60, 82, 100] },
];

/* ── Story-Ideen ───────────────────────────────────────────── */
const storyIdeen: StoryIdee[] = [
  { id: 'si-1', label: 'Vorher / Nachher', caption: 'Aus matt wird Glanz ✨ Diese Oldtimer-Felge kam rostig zu uns — und ging verchromt zurück.', hashtags: '#galvanik #restauration #oldtimer #frankfurt', titel: 'Vorher-/Nachher Oldtimer-Felge', icon: 'Building2' },
  { id: 'si-2', label: 'Kundenstimme', caption: '„Wie neu!" — unser Kunde über das restaurierte Silberbesteck seiner Großmutter. Solche Geschichten lieben wir.', hashtags: '#silber #restauration #erbstueck', titel: 'Kundenstimme Silberbesteck', icon: 'Star' },
  { id: 'si-3', label: 'Museen wecken', caption: 'Lange nichts von uns gehört? Wir frischen Ihre Schätze wieder auf — melden Sie sich gern.', hashtags: '#museum #restaurierung #kreile', titel: 'Reaktivierung Museen', icon: 'Landmark' },
  { id: 'si-4', label: 'Bewertung holen', caption: 'Zufrieden mit unserer Arbeit? Über eine kurze Google-Bewertung freuen wir uns riesig ⭐', hashtags: '#bewertung #danke #frankfurt', titel: 'Bewertung holen', icon: 'Star' },
  { id: 'si-5', label: 'Wissen teilen', caption: 'Wussten Sie? Vernickeln schützt Metall jahrzehntelang vor Korrosion. Wir zeigen, wie.', hashtags: '#wissen #galvanik #vernickeln', titel: 'Wissens-Post', icon: 'Lightbulb' },
  { id: 'si-6', label: 'Eigene Idee', caption: '', hashtags: '', titel: '', icon: 'Plus', isAdd: true },
];

/* ── Provider ──────────────────────────────────────────────── */
export const marketingMockProvider: MarketingDataProvider = {
  async getBesteAktion() { return besteAktion; },
  async listVorschlaege(sort?: SortMode) {
    const list = [...alleVorschlaege];
    switch (sort) {
      case 'einfach': return list.sort((a, b) => a.aufwand.localeCompare(b.aufwand));
      case 'relevanz': return list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
      case 'kanal': return list.sort((a, b) => a.kanal.localeCompare(b.kanal));
      default: return list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    }
  },
  async getKampagnen() { return kampagnen; },
  async getFunnel() { return funnel; },
  async getSegmente() { return segmente; },
  async getLernInsights() { return lernInsights; },
  async getWirkungMini() { return wirkungMini; },
  async getStoryIdeen() { return storyIdeen; },
};
