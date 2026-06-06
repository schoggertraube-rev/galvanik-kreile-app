/* ═══════════════════════════════════════════════════════════
   Marketing — Drizzle Schema (prepared, not pushed)
   Spec: 21 (Datenmodell), 27 §4-6
   
   IMPORTANT: This schema is PREPARED but NOT automatically
   migrated to Supabase. Migration requires explicit user
   approval and the Supabase push workflow (Spec 27 §12).
   ═══════════════════════════════════════════════════════════ */

import { pgTable, uuid, text, boolean, timestamp, numeric, integer, date, jsonb } from 'drizzle-orm/pg-core';

/* ── Aktion (Spec 21 §2) ─────────────────────────────────── */
export const aktion = pgTable('aktion', {
  id: uuid('id').defaultRandom().primaryKey(),
  kampagneId: uuid('kampagne_id'),
  typ: text('typ').notNull(),            // post|mail|review_request|ad
  kanalId: uuid('kanal_id'),
  segmentId: uuid('segment_id'),
  titel: text('titel'),
  inhalt: jsonb('inhalt'),               // Text, Hashtags, Bildref
  status: text('status').notNull().default('vorschlag'),
  erwarteterOutput: numeric('erwarteter_output'),
  aufwandMin: integer('aufwand_min'),
  kostenBudget: numeric('kosten_budget', { precision: 10, scale: 2 }).default('0'),
  score: numeric('score', { precision: 6, scale: 2 }),
  freigegebenVon: uuid('freigegeben_von'),
  ausgefuehrtAm: timestamp('ausgefuehrt_am'),
  erstelltAm: timestamp('erstellt_am').defaultNow().notNull(),
});

/* ── Touchpoint (Spec 21 §2) ──────────────────────────────── */
export const touchpoint = pgTable('touchpoint', {
  id: uuid('id').defaultRandom().primaryKey(),
  aktionId: uuid('aktion_id').notNull(),
  kanalId: uuid('kanal_id'),
  externeRef: text('externe_ref'),
  utmCampaign: text('utm_campaign'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  reichweite: integer('reichweite'),
  klicks: integer('klicks'),
  ausgefuehrtAm: timestamp('ausgefuehrt_am').defaultNow(),
});

/* ── Attribution (Spec 21 §2) ─────────────────────────────── */
export const attribution = pgTable('attribution', {
  id: uuid('id').defaultRandom().primaryKey(),
  touchpointId: uuid('touchpoint_id'),
  leadId: uuid('lead_id'),
  auftragId: uuid('auftrag_id'),
  umsatz: numeric('umsatz', { precision: 12, scale: 2 }),
  modell: text('modell').default('last_touch'),
  erstelltAm: timestamp('erstellt_am').defaultNow(),
});

/* ── Lern-Metrik (Spec 21 §2) ─────────────────────────────── */
export const lernMetrik = pgTable('lern_metrik', {
  id: uuid('id').defaultRandom().primaryKey(),
  dimension: text('dimension').notNull(),
  wert: text('wert').notNull(),
  aktionen: integer('aktionen').default(0),
  anfragen: integer('anfragen').default(0),
  umsatz: numeric('umsatz', { precision: 12, scale: 2 }).default('0'),
  konfidenz: numeric('konfidenz', { precision: 5, scale: 2 }),
  aktualisiertAm: timestamp('aktualisiert_am').defaultNow(),
});

/* ── Einwilligung (Spec 21 §2) ────────────────────────────── */
export const einwilligung = pgTable('einwilligung', {
  id: uuid('id').defaultRandom().primaryKey(),
  kundeId: uuid('kunde_id').notNull(),
  kanal: text('kanal').notNull(),
  status: text('status').notNull(),
  quelle: text('quelle'),
  zeitpunkt: timestamp('zeitpunkt').defaultNow(),
  nachweis: text('nachweis'),
});

/* ── Marketing Asset (Spec 27 §4) ─────────────────────────── */
export const marketingAsset = pgTable('marketing_asset', {
  id: uuid('id').defaultRandom().primaryKey(),
  quelle: text('quelle').notNull(),          // auftragsfoto | kundenbild
  auftragId: uuid('auftrag_id'),
  kundeId: uuid('kunde_id'),
  segmentId: uuid('segment_id'),
  storagePfad: text('storage_pfad').notNull(),
  typ: text('typ'),                          // vorher | nachher | detail | kundenfoto
  freigabeMarketing: boolean('freigabe_marketing').default(false),
  qualitaetScore: numeric('qualitaet_score', { precision: 5, scale: 2 }),
  erstelltAm: timestamp('erstellt_am').defaultNow().notNull(),
});

/* ── Feedback-Mail (Spec 27 §5) ───────────────────────────── */
export const feedbackMail = pgTable('feedback_mail', {
  id: uuid('id').defaultRandom().primaryKey(),
  auftragId: uuid('auftrag_id').notNull(),
  kundeId: uuid('kunde_id').notNull(),
  segmentId: uuid('segment_id'),
  ankunftQuelle: text('ankunft_quelle'),
  ankunftAm: timestamp('ankunft_am'),
  geplantFuer: timestamp('geplant_fuer'),
  status: text('status').notNull().default('geplant'),
  gesendetAm: timestamp('gesendet_am'),
  tokenUpload: text('token_upload'),
  tokenFeedback: text('token_feedback'),
  einwilligungOk: boolean('einwilligung_ok').default(false),
});

/* ── Feedback-Eingang (Spec 27 §5) ────────────────────────── */
export const feedbackEingang = pgTable('feedback_eingang', {
  id: uuid('id').defaultRandom().primaryKey(),
  feedbackMailId: uuid('feedback_mail_id'),
  zufriedenheit: integer('zufriedenheit'),
  googleBewertungGeklickt: boolean('google_bewertung_geklickt').default(false),
  fotosHochgeladen: integer('fotos_hochgeladen').default(0),
  freitext: text('freitext'),
  eingegangenAm: timestamp('eingegangen_am').defaultNow(),
});

/* ── Statistik-Kennzahl (Spec 27 §6) ─────────────────────── */
export const statistikKennzahl = pgTable('statistik_kennzahl', {
  id: uuid('id').defaultRandom().primaryKey(),
  metrik: text('metrik').notNull(),
  periode: date('periode').notNull(),
  wert: numeric('wert', { precision: 14, scale: 2 }),
  quelle: text('quelle'),
  aktualisiertAm: timestamp('aktualisiert_am').defaultNow(),
});
