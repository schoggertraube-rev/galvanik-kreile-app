import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, integer, jsonb, uuid, numeric, date, check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { customers, inquiries, itemPhotoJobs, orders } from "./schema";

export const kampagne = pgTable("kampagne", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("galvanik-kreile"),
  truthStatus: text("truth_status").notNull().default("verified"),
  name: text("name").notNull(),
  ziel: text("ziel"),
  zeitraumVon: date("zeitraum_von"),
  zeitraumBis: date("zeitraum_bis"),
  budget: numeric("budget", { precision: 12, scale: 2 }).default("0"),
  status: text("status").notNull().default("geplant"),
  isDemo: boolean("is_demo").default(false),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("kampagne_tenant_id_uidx").on(table.tenantId, table.id),
  check(
    "kampagne_truth_status_check",
    sql`${table.truthStatus} IN ('verified', 'legacy_unverified')`,
  ),
]);

export const kanal = pgTable("kanal", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("galvanik-kreile"),
  truthStatus: text("truth_status").notNull().default("verified"),
  typ: text("typ").notNull(), // instagram, email, google, web
  name: text("name").notNull(),
  verbunden: boolean("verbunden").default(false),
  config: jsonb("config"),
  accessTokenEncrypted: text("access_token_encrypted"),
  status: text("status").default("nicht_verbunden"),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("kanal_tenant_id_uidx").on(table.tenantId, table.id),
  uniqueIndex("kanal_instagram_tenant_uidx")
    .on(table.tenantId)
    .where(sql`${table.typ} = 'instagram'`),
  check(
    "kanal_truth_status_check",
    sql`${table.truthStatus} IN ('verified', 'legacy_unverified')`,
  ),
]);

export const segment = pgTable("segment", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("galvanik-kreile"),
  truthStatus: text("truth_status").notNull().default("verified"),
  name: text("name").notNull(),
  icon: text("icon"),
  farbe: text("farbe").default("#e91e63"),
  beschreibung: text("beschreibung"),
  filterRegel: jsonb("filter_regel"),
  isDemo: boolean("is_demo").default(false),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("segment_tenant_id_uidx").on(table.tenantId, table.id),
  check(
    "segment_truth_status_check",
    sql`${table.truthStatus} IN ('verified', 'legacy_unverified')`,
  ),
]);

export const aktion = pgTable("aktion", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("galvanik-kreile"),
  truthStatus: text("truth_status").notNull().default("verified"),
  kampagneId: uuid("kampagne_id"),
  typ: text("typ").notNull(), // post, mail, review_request, ad
  kanalId: uuid("kanal_id"),
  segmentId: uuid("segment_id"),
  titel: text("titel").notNull(),
  inhalt: jsonb("inhalt"),
  status: text("status").notNull().default("vorschlag"), // vorschlag, geplant, freigegeben, ausgefuehrt, fehler
  erwarteterOutput: numeric("erwarteter_output", { precision: 12, scale: 2 }),
  aufwandMin: integer("aufwand_min").default(0),
  kostenBudget: numeric("kosten_budget", { precision: 12, scale: 2 }),
  budgetStatus: text("budget_status").notNull().default("not_measured"),
  budgetMeasuredAt: timestamp("budget_measured_at"),
  budgetSource: text("budget_source"),
  score: numeric("score", { precision: 6, scale: 2 }).default("0"),
  freigegebenVon: text("freigegeben_von"),
  geplantFuer: timestamp("geplant_fuer"),
  ausgefuehrtAm: timestamp("ausgefuehrt_am"),
  isDemo: boolean("is_demo").default(false),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("aktion_tenant_id_uidx").on(table.tenantId, table.id),
  check(
    "aktion_budget_truth_check",
    sql`
      ${table.truthStatus} IN ('verified', 'legacy_unverified')
      AND ${table.budgetStatus} IN ('not_measured', 'measured', 'legacy_unverified')
      AND (${table.kostenBudget} IS NULL OR ${table.kostenBudget} >= 0)
      AND (${table.budgetStatus} <> 'not_measured' OR ${table.kostenBudget} IS NULL)
      AND (
        ${table.budgetStatus} <> 'measured'
        OR (
          ${table.budgetMeasuredAt} IS NOT NULL
          AND NULLIF(BTRIM(${table.budgetSource}), '') IS NOT NULL
          AND ${table.kostenBudget} IS NOT NULL
        )
      )
    `,
  ),
  foreignKey({
    columns: [table.tenantId, table.kampagneId],
    foreignColumns: [kampagne.tenantId, kampagne.id],
    name: "aktion_tenant_kampagne_fkey",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.tenantId, table.kanalId],
    foreignColumns: [kanal.tenantId, kanal.id],
    name: "aktion_tenant_kanal_fkey",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.tenantId, table.segmentId],
    foreignColumns: [segment.tenantId, segment.id],
    name: "aktion_tenant_segment_fkey",
  }).onDelete("restrict"),
]);

export const touchpoint = pgTable("touchpoint", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("galvanik-kreile"),
  aktionId: uuid("aktion_id"),
  kanalId: uuid("kanal_id"),
  externeRef: text("externe_ref"),
  utmCampaign: text("utm_campaign"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  reichweite: integer("reichweite"),
  klicks: integer("klicks"),
  metricsStatus: text("metrics_status").notNull().default("not_measured"),
  metricsMeasuredAt: timestamp("metrics_measured_at"),
  metricsSource: text("metrics_source"),
  ausgefuehrtAm: timestamp("ausgefuehrt_am").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("touchpoint_tenant_id_uidx").on(table.tenantId, table.id),
  uniqueIndex("touchpoint_externe_ref_uidx").on(table.tenantId, table.externeRef),
  foreignKey({
    columns: [table.tenantId, table.aktionId],
    foreignColumns: [aktion.tenantId, aktion.id],
    name: "touchpoint_tenant_aktion_fkey",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.tenantId, table.kanalId],
    foreignColumns: [kanal.tenantId, kanal.id],
    name: "touchpoint_tenant_kanal_fkey",
  }).onDelete("restrict"),
]);

export const attribution = pgTable("attribution", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("galvanik-kreile"),
  touchpointId: uuid("touchpoint_id"),
  leadId: text("lead_id"),
  auftragId: text("auftrag_id"),
  umsatz: numeric("umsatz", { precision: 12, scale: 2 }),
  revenueStatus: text("revenue_status").notNull().default("not_measured"),
  revenueMeasuredAt: timestamp("revenue_measured_at"),
  revenueSource: text("revenue_source"),
  modell: text("modell").default("last_click"),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId, table.touchpointId],
    foreignColumns: [touchpoint.tenantId, touchpoint.id],
    name: "attribution_tenant_touchpoint_fkey",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.tenantId, table.leadId],
    foreignColumns: [inquiries.tenantId, inquiries.id],
    name: "attribution_tenant_lead_fkey",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.tenantId, table.auftragId],
    foreignColumns: [orders.tenantId, orders.id],
    name: "attribution_tenant_auftrag_fkey",
  }).onDelete("restrict"),
]);

export const lernMetrik = pgTable("lern_metrik", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("galvanik-kreile"),
  truthStatus: text("truth_status").notNull().default("verified"),
  dimension: text("dimension").notNull(),
  wert: text("wert").notNull(),
  aktionen: integer("aktionen").default(0),
  anfragen: integer("anfragen").default(0),
  umsatz: numeric("umsatz", { precision: 12, scale: 2 }).default("0"),
  konfidenz: numeric("konfidenz", { precision: 5, scale: 2 }).default("0"),
  aktualisiertAm: timestamp("aktualisiert_am").defaultNow().notNull(),
}, (table) => [
  check(
    "lern_metrik_truth_status_check",
    sql`${table.truthStatus} IN ('verified', 'legacy_unverified')`,
  ),
]);

export const einwilligung = pgTable("einwilligung", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("galvanik-kreile"),
  kundeId: text("kunde_id").notNull(),
  kanal: text("kanal").notNull(), // email, sms
  status: text("status").notNull().default("widerrufen"), // erteilt, widerrufen
  quelle: text("quelle").notNull(),
  nachweis: text("nachweis"),
  zeitpunkt: timestamp("zeitpunkt").defaultNow().notNull(),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId, table.kundeId],
    foreignColumns: [customers.tenantId, customers.id],
    name: "einwilligung_tenant_kunde_fkey",
  }).onDelete("restrict"),
]);

export const telemetrieEvent = pgTable("telemetrie_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("galvanik-kreile"),
  eventTyp: text("event_typ").notNull(),
  meta: jsonb("meta"),
  zeitpunkt: timestamp("zeitpunkt").defaultNow().notNull(),
  isAnonym: boolean("is_anonym").default(true),
});

export const marketingAsset = pgTable("marketing_asset", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("galvanik-kreile"),
  quelle: text("quelle").notNull(), // auftragsfoto, kundenbild
  auftragId: text("auftrag_id"),
  kundeId: text("kunde_id"),
  segmentId: uuid("segment_id"),
  storagePfad: text("storage_pfad").notNull(),
  storageBucket: text("storage_bucket"),
  sourceItemPhotoJobId: uuid("source_item_photo_job_id"),
  sourceItemPhotoUploadedAt: timestamp("source_item_photo_uploaded_at", { withTimezone: true }),
  typ: text("typ").notNull(),
  freigabeMarketing: boolean("freigabe_marketing").notNull().default(false),
  qualitaetScore: numeric("qualitaet_score", { precision: 4, scale: 2 }).default("0"),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("marketing_asset_tenant_id_uidx").on(table.tenantId, table.id),
  foreignKey({
    columns: [table.tenantId, table.auftragId],
    foreignColumns: [orders.tenantId, orders.id],
    name: "marketing_asset_tenant_auftrag_fkey",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.tenantId, table.kundeId],
    foreignColumns: [customers.tenantId, customers.id],
    name: "marketing_asset_tenant_kunde_fkey",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.tenantId, table.segmentId],
    foreignColumns: [segment.tenantId, segment.id],
    name: "marketing_asset_tenant_segment_fkey",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.tenantId, table.auftragId,
      table.storagePfad,
      table.sourceItemPhotoJobId,
      table.sourceItemPhotoUploadedAt,
    ],
    foreignColumns: [
      itemPhotoJobs.tenantId,
      itemPhotoJobs.orderId,
      itemPhotoJobs.storagePath,
      itemPhotoJobs.id,
      itemPhotoJobs.uploadedAt,
    ],
    name: "marketing_asset_item_photo_source_fkey",
  }).onUpdate("restrict").onDelete("restrict"),
  check(
    "marketing_asset_storage_bucket_format_chk",
    sql`${table.storageBucket} is null or ${table.storageBucket} = 'item-photos'`,
  ),
  check(
    "marketing_asset_source_pair_chk",
    sql`(${table.sourceItemPhotoJobId} is null) = (${table.sourceItemPhotoUploadedAt} is null)`,
  ),
  check(
    "marketing_asset_storage_publish_path_chk",
    sql`${table.freigabeMarketing} is not true or ((
      ${table.storageBucket} = 'item-photos'
      and ${table.auftragId} is not null
      and length(${table.storagePfad}) between 20 and 1024
      and left(
        ${table.storagePfad},
        length(${table.tenantId} || '/' || ${table.auftragId} || '/')
      ) = ${table.tenantId} || '/' || ${table.auftragId} || '/'
      and left(${table.storagePfad}, 1) <> '/'
      and position(E'\\' in ${table.storagePfad}) = 0
      and position('/../' in '/' || ${table.storagePfad} || '/') = 0
      and ${table.storagePfad} !~ '[[:cntrl:]]'
      and ${table.sourceItemPhotoJobId} is not null
      and ${table.sourceItemPhotoUploadedAt} is not null
    ) is true)`,
  ),
]);

export const marketingPublishJob = pgTable("marketing_publish_job", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("galvanik-kreile"),
  aktionId: uuid("aktion_id").notNull(),
  assetId: uuid("asset_id").notNull(),
  kanalId: uuid("kanal_id").notNull(),
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
  uniqueIndex("marketing_publish_job_action_uidx").on(table.tenantId, table.aktionId),
  index("marketing_publish_job_tenant_status_idx").on(table.tenantId, table.status, table.claimedAt),
  foreignKey({
    columns: [table.tenantId, table.aktionId],
    foreignColumns: [aktion.tenantId, aktion.id],
    name: "marketing_publish_job_tenant_aktion_fkey",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.tenantId, table.assetId],
    foreignColumns: [marketingAsset.tenantId, marketingAsset.id],
    name: "marketing_publish_job_tenant_asset_fkey",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.tenantId, table.kanalId],
    foreignColumns: [kanal.tenantId, kanal.id],
    name: "marketing_publish_job_tenant_kanal_fkey",
  }).onDelete("restrict"),
  check(
    "marketing_publish_job_status_chk",
    sql`${table.status} in ('reserved', 'publishing', 'succeeded', 'failed', 'uncertain')`,
  ),
  check(
    "marketing_publish_job_attempt_count_chk",
    sql`${table.attemptCount} >= 0`,
  ),
  check(
    "marketing_publish_job_error_code_chk",
    sql`${table.errorCode} is null or length(${table.errorCode}) <= 120`,
  ),
  check(
    "marketing_publish_job_succeeded_external_refs_chk",
    sql`${table.status} <> 'succeeded' or (
      ${table.externalContainerId} is not null
      and ${table.externalMediaId} is not null
    )`,
  ),
]);

export const feedbackMail = pgTable("feedback_mail", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("galvanik-kreile"),
  auftragId: text("auftrag_id"),
  kundeId: text("kunde_id"),
  segmentId: uuid("segment_id"),
  ankunftQuelle: text("ankunft_quelle"),
  ankunftAm: timestamp("ankunft_am"),
  geplantFuer: timestamp("geplant_fuer"),
  status: text("status").notNull().default("geplant"), // geplant, gesendet, geoeffnet, reagiert, storniert, fehler, versand_unsicher
  gesendetAm: timestamp("gesendet_am"),
  tokenUpload: text("token_upload"),
  tokenFeedback: text("token_feedback"),
  einwilligungOk: boolean("einwilligung_ok").default(false),
  erstelltAm: timestamp("erstellt_am").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("feedback_mail_tenant_id_uidx").on(table.tenantId, table.id),
  foreignKey({
    columns: [table.tenantId, table.auftragId],
    foreignColumns: [orders.tenantId, orders.id],
    name: "feedback_mail_tenant_auftrag_fkey",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.tenantId, table.kundeId],
    foreignColumns: [customers.tenantId, customers.id],
    name: "feedback_mail_tenant_kunde_fkey",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.tenantId, table.segmentId],
    foreignColumns: [segment.tenantId, segment.id],
    name: "feedback_mail_tenant_segment_fkey",
  }).onDelete("restrict"),
]);

export const feedbackEingang = pgTable("feedback_eingang", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("galvanik-kreile"),
  feedbackMailId: uuid("feedback_mail_id"),
  zufriedenheit: integer("zufriedenheit"), // 1-5
  googleBewertungGeklickt: boolean("google_bewertung_geklickt").default(false),
  fotosHochgeladen: integer("fotos_hochgeladen").default(0),
  freitext: text("freitext"),
  eingegangenAm: timestamp("eingegangen_am").defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId, table.feedbackMailId],
    foreignColumns: [feedbackMail.tenantId, feedbackMail.id],
    name: "feedback_eingang_tenant_feedback_mail_fkey",
  }).onDelete("restrict"),
]);

export const statistikKennzahl = pgTable("statistik_kennzahl", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("galvanik-kreile"),
  metrik: text("metrik").notNull(),
  periode: text("periode").notNull(), // e.g. YYYY-MM
  wert: numeric("wert", { precision: 12, scale: 2 }).notNull(),
  quelle: text("quelle"),
  aktualisiertAm: timestamp("aktualisiert_am").defaultNow().notNull(),
});
