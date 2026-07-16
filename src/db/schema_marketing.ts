import { pgTable, text, timestamp, boolean, integer, jsonb, uuid, numeric, date, index, uniqueIndex } from "drizzle-orm/pg-core";
import { customers } from "./schema";
import { orders, inquiries } from "./schema";

export const kampagne = pgTable("kampagne", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ziel: text("ziel"),
  zeitraumVon: date("zeitraum_von"),
  zeitraumBis: date("zeitraum_bis"),
  budget: numeric("budget", { precision: 12, scale: 2 }).default("0"),
  status: text("status").notNull().default("geplant"),
  isDemo: boolean("is_demo").default(false),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
});

export const kanal = pgTable("kanal", {
  id: uuid("id").primaryKey().defaultRandom(),
  typ: text("typ").notNull(), // instagram, email, google, web
  name: text("name").notNull(),
  verbunden: boolean("verbunden").default(false),
  config: jsonb("config"),
  accessTokenEncrypted: text("access_token_encrypted"),
  status: text("status").default("nicht_verbunden"),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
});

export const segment = pgTable("segment", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  icon: text("icon"),
  farbe: text("farbe").default("#e91e63"),
  beschreibung: text("beschreibung"),
  filterRegel: jsonb("filter_regel"),
  isDemo: boolean("is_demo").default(false),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
});

export const aktion = pgTable("aktion", {
  id: uuid("id").primaryKey().defaultRandom(),
  kampagneId: uuid("kampagne_id").references(() => kampagne.id),
  typ: text("typ").notNull(), // post, mail, review_request, ad
  kanalId: uuid("kanal_id").references(() => kanal.id),
  segmentId: uuid("segment_id").references(() => segment.id),
  titel: text("titel").notNull(),
  inhalt: jsonb("inhalt"),
  status: text("status").notNull().default("vorschlag"), // vorschlag, geplant, freigegeben, ausgefuehrt, fehler
  erwarteterOutput: numeric("erwarteter_output", { precision: 12, scale: 2 }),
  aufwandMin: integer("aufwand_min").default(0),
  kostenBudget: numeric("kosten_budget", { precision: 12, scale: 2 }).default("0"),
  score: numeric("score", { precision: 6, scale: 2 }).default("0"),
  freigegebenVon: text("freigegeben_von"),
  geplantFuer: timestamp("geplant_fuer"),
  ausgefuehrtAm: timestamp("ausgefuehrt_am"),
  isDemo: boolean("is_demo").default(false),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
});

export const touchpoint = pgTable("touchpoint", {
  id: uuid("id").primaryKey().defaultRandom(),
  aktionId: uuid("aktion_id").references(() => aktion.id),
  kanalId: uuid("kanal_id").references(() => kanal.id),
  externeRef: text("externe_ref"),
  utmCampaign: text("utm_campaign"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  reichweite: integer("reichweite").default(0),
  klicks: integer("klicks").default(0),
  ausgefuehrtAm: timestamp("ausgefuehrt_am").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("touchpoint_externe_ref_uidx").on(table.externeRef),
]);

export const attribution = pgTable("attribution", {
  id: uuid("id").primaryKey().defaultRandom(),
  touchpointId: uuid("touchpoint_id").references(() => touchpoint.id),
  leadId: text("lead_id").references(() => inquiries.id),
  auftragId: text("auftrag_id").references(() => orders.id),
  umsatz: numeric("umsatz", { precision: 12, scale: 2 }).default("0"),
  modell: text("modell").default("last_click"),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
});

export const lernMetrik = pgTable("lern_metrik", {
  id: uuid("id").primaryKey().defaultRandom(),
  dimension: text("dimension").notNull(),
  wert: text("wert").notNull(),
  aktionen: integer("aktionen").default(0),
  anfragen: integer("anfragen").default(0),
  umsatz: numeric("umsatz", { precision: 12, scale: 2 }).default("0"),
  konfidenz: numeric("konfidenz", { precision: 5, scale: 2 }).default("0"),
  aktualisiertAm: timestamp("aktualisiert_am").defaultNow().notNull(),
});

export const einwilligung = pgTable("einwilligung", {
  id: uuid("id").primaryKey().defaultRandom(),
  kundeId: text("kunde_id").notNull().references(() => customers.id),
  kanal: text("kanal").notNull(), // email, sms
  status: text("status").notNull().default("widerrufen"), // erteilt, widerrufen
  quelle: text("quelle").notNull(),
  nachweis: text("nachweis"),
  zeitpunkt: timestamp("zeitpunkt").defaultNow().notNull(),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
});

export const telemetrieEvent = pgTable("telemetrie_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventTyp: text("event_typ").notNull(),
  meta: jsonb("meta"),
  zeitpunkt: timestamp("zeitpunkt").defaultNow().notNull(),
  isAnonym: boolean("is_anonym").default(true),
});

export const marketingAsset = pgTable("marketing_asset", {
  id: uuid("id").primaryKey().defaultRandom(),
  quelle: text("quelle").notNull(), // auftragsfoto, kundenbild
  auftragId: text("auftrag_id").references(() => orders.id),
  kundeId: text("kunde_id").references(() => customers.id),
  segmentId: uuid("segment_id").references(() => segment.id),
  storagePfad: text("storage_pfad").notNull(),
  storageBucket: text("storage_bucket"),
  typ: text("typ").notNull(),
  freigabeMarketing: boolean("freigabe_marketing").default(false),
  qualitaetScore: numeric("qualitaet_score", { precision: 4, scale: 2 }).default("0"),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
});

export const marketingPublishJob = pgTable("marketing_publish_job", {
  id: uuid("id").primaryKey().defaultRandom(),
  aktionId: uuid("aktion_id").notNull().references(() => aktion.id),
  assetId: uuid("asset_id").notNull().references(() => marketingAsset.id),
  kanalId: uuid("kanal_id").notNull().references(() => kanal.id),
  status: text("status").notNull().default("reserved"),
  externalContainerId: text("external_container_id"),
  externalMediaId: text("external_media_id"),
  attemptCount: integer("attempt_count").notNull().default(0),
  claimedAt: timestamp("claimed_at"),
  completedAt: timestamp("completed_at"),
  errorCode: text("error_code"),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
  aktualisiertAm: timestamp("aktualisiert_am").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("marketing_publish_job_action_uidx").on(table.aktionId),
  index("marketing_publish_job_status_idx").on(table.status, table.claimedAt),
]);

export const feedbackMail = pgTable("feedback_mail", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("galvanik-kreile"),
  auftragId: text("auftrag_id").references(() => orders.id),
  kundeId: text("kunde_id").references(() => customers.id),
  segmentId: uuid("segment_id").references(() => segment.id),
  ankunftQuelle: text("ankunft_quelle"),
  ankunftAm: timestamp("ankunft_am"),
  geplantFuer: timestamp("geplant_fuer"),
  status: text("status").notNull().default("geplant"), // geplant, gesendet, geoeffnet, reagiert, storniert, fehler, versand_unsicher
  gesendetAm: timestamp("gesendet_am"),
  tokenUpload: text("token_upload"),
  tokenFeedback: text("token_feedback"),
  einwilligungOk: boolean("einwilligung_ok").default(false),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
});

export const feedbackEingang = pgTable("feedback_eingang", {
  id: uuid("id").primaryKey().defaultRandom(),
  feedbackMailId: uuid("feedback_mail_id").references(() => feedbackMail.id),
  zufriedenheit: integer("zufriedenheit"), // 1-5
  googleBewertungGeklickt: boolean("google_bewertung_geklickt").default(false),
  fotosHochgeladen: integer("fotos_hochgeladen").default(0),
  freitext: text("freitext"),
  eingegangenAm: timestamp("eingegangen_am").defaultNow().notNull(),
});

export const statistikKennzahl = pgTable("statistik_kennzahl", {
  id: uuid("id").primaryKey().defaultRandom(),
  metrik: text("metrik").notNull(),
  periode: text("periode").notNull(), // e.g. YYYY-MM
  wert: numeric("wert", { precision: 12, scale: 2 }).notNull(),
  quelle: text("quelle"),
  aktualisiertAm: timestamp("aktualisiert_am").defaultNow().notNull(),
});
