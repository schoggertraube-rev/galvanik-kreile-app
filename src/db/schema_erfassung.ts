import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, integer, uuid, numeric, date, jsonb, index, uniqueIndex, foreignKey, check } from "drizzle-orm/pg-core";
import { orders, appUsers, inventoryItems } from "./schema";

export const vorlageZeit = pgTable("vorlage_zeit", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  schluessel: text("schluessel").notNull(),
  teilekategorie: text("teilekategorie"),
  oberflaeche: text("oberflaeche"),
  stationKuerzel: text("station_kuerzel").notNull(),
  medianMinuten: numeric("median_minuten", { precision: 8, scale: 2 }).notNull(),
  p25Minuten: numeric("p25_minuten", { precision: 8, scale: 2 }),
  p75Minuten: numeric("p75_minuten", { precision: 8, scale: 2 }),
  nReferenzauftraege: integer("n_referenzauftraege").notNull(),
  letzteAktualisierung: timestamp("letzte_aktualisierung", { withTimezone: true }).defaultNow(),
  isActive: boolean("is_active").default(false).notNull(),
}, (table) => [
  uniqueIndex("vorlage_zeit_tenant_id_uidx").on(table.tenantId, table.id),
  uniqueIndex("vorlage_zeit_tenant_key_station_uidx").on(table.tenantId, table.schluessel, table.stationKuerzel),
  check("vorlage_zeit_tenant_nonblank_chk", sql`btrim(${table.tenantId}) <> ''`),
]);

export const vorlageVerbrauch = pgTable("vorlage_verbrauch", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  schluessel: text("schluessel").notNull(),
  teilekategorie: text("teilekategorie"),
  oberflaeche: text("oberflaeche"),
  stationKuerzel: text("station_kuerzel").notNull(),
  inventoryItemId: text("inventory_item_id").notNull(),
  einheitNormiert: text("einheit_normiert").notNull(),
  medianMenge: numeric("median_menge", { precision: 10, scale: 4 }).notNull(),
  p25Menge: numeric("p25_menge", { precision: 10, scale: 4 }),
  p75Menge: numeric("p75_menge", { precision: 10, scale: 4 }),
  nReferenzauftraege: integer("n_referenzauftraege").notNull(),
  haeufigkeitProzent: numeric("haeufigkeit_prozent", { precision: 5, scale: 2 }),
  letzteAktualisierung: timestamp("letzte_aktualisierung", { withTimezone: true }).defaultNow(),
  isActive: boolean("is_active").default(false).notNull(),
}, (table) => [
  uniqueIndex("vorlage_verbrauch_tenant_id_uidx").on(table.tenantId, table.id),
  uniqueIndex("vorlage_verbrauch_tenant_key_station_item_uidx").on(
    table.tenantId,
    table.schluessel,
    table.stationKuerzel,
    table.inventoryItemId,
  ),
  foreignKey({
    columns: [table.tenantId, table.inventoryItemId],
    foreignColumns: [inventoryItems.tenantId, inventoryItems.id],
    name: "vorlage_verbrauch_tenant_inventory_fk",
  }).onDelete("restrict"),
  check("vorlage_verbrauch_tenant_nonblank_chk", sql`btrim(${table.tenantId}) <> ''`),
]);

export const arbeitszeitBuchung = pgTable("arbeitszeit_buchung", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  auftragId: text("auftrag_id").notNull(),
  employeeId: uuid("employee_id").notNull(),
  kostenstelleKuerzel: text("kostenstelle_kuerzel").notNull(),
  stationKuerzel: text("station_kuerzel").notNull(),
  startZeit: timestamp("start_zeit", { withTimezone: true }).notNull(),
  endZeit: timestamp("end_zeit", { withTimezone: true }),
  dauerMinuten: integer("dauer_minuten").notNull(),
  kostensatzEurProStunde: numeric("kostensatz_eur_pro_stunde", { precision: 8, scale: 2 }).notNull(),
  erfasstModus: text("erfasst_modus").notNull(),
  warAusVorlage: boolean("war_aus_vorlage"),
  vorlageId: uuid("vorlage_id"),
  bemerkung: text("bemerkung"),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).defaultNow(),
  aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).defaultNow(),
  clientRequestId: uuid("client_request_id"),
}, (table) => [
  index("arbeitszeit_buchung_tenant_order_idx").on(table.tenantId, table.auftragId, table.erstelltAm),
  index("arbeitszeit_buchung_tenant_request_idx")
    .on(table.tenantId, table.clientRequestId)
    .where(sql`${table.clientRequestId} is not null`),
  foreignKey({
    columns: [table.tenantId, table.auftragId],
    foreignColumns: [orders.tenantId, orders.id],
    name: "arbeitszeit_buchung_tenant_order_fk",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.tenantId, table.employeeId],
    foreignColumns: [appUsers.tenantId, appUsers.id],
    name: "arbeitszeit_buchung_tenant_employee_fk",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.tenantId, table.vorlageId],
    foreignColumns: [vorlageZeit.tenantId, vorlageZeit.id],
    name: "arbeitszeit_buchung_tenant_template_fk",
  }).onDelete("restrict"),
  check("arbeitszeit_buchung_duration_nonnegative", sql`${table.dauerMinuten} >= 0`),
  check(
    "arbeitszeit_buchung_rate_nonnegative",
    sql`${table.kostensatzEurProStunde}::text not in ('NaN', 'Infinity', '-Infinity') and ${table.kostensatzEurProStunde} >= 0`,
  ),
  check(
    "arbeitszeit_buchung_template_provenance_chk",
    sql`(
      ${table.vorlageId} is null and ${table.warAusVorlage} is distinct from true
    ) or (
      ${table.vorlageId} is not null and ${table.warAusVorlage} is true
    )`,
  ),
  check("arbeitszeit_buchung_tenant_nonblank_chk", sql`btrim(${table.tenantId}) <> ''`),
]);

export const captureRequestReceipts = pgTable("capture_request_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  clientRequestId: uuid("client_request_id").notNull(),
  kind: text("kind").notNull(),
  actorId: uuid("actor_id").notNull(),
  orderId: text("order_id").notNull(),
  stationKuerzel: text("station_kuerzel"),
  requestHash: text("request_hash").notNull(),
  result: jsonb("result").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("capture_request_receipts_tenant_request_kind_uidx").on(table.tenantId, table.clientRequestId, table.kind),
  index("capture_request_receipts_tenant_order_created_idx").on(table.tenantId, table.orderId, table.createdAt),
  foreignKey({
    columns: [table.tenantId, table.actorId],
    foreignColumns: [appUsers.tenantId, appUsers.id],
    name: "capture_request_receipts_tenant_actor_fk",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.tenantId, table.orderId],
    foreignColumns: [orders.tenantId, orders.id],
    name: "capture_request_receipts_tenant_order_fk",
  }).onDelete("restrict"),
  check(
    "capture_request_receipts_kind_check",
    sql`${table.kind} in ('time', 'material', 'template', 'station_completion')`,
  ),
  check("capture_request_receipts_hash_check", sql`${table.requestHash} ~ '^[0-9a-f]{64}$'`),
  check(
    "capture_request_receipts_completion_chk",
    sql`isfinite(${table.createdAt}) and (${table.result} is null) = (${table.completedAt} is null) and (${table.completedAt} is null or (isfinite(${table.completedAt}) and ${table.completedAt} >= ${table.createdAt}))`,
  ),
  check("capture_request_receipts_tenant_nonblank_chk", sql`btrim(${table.tenantId}) <> ''`),
]);

export const kostensatzDefault = pgTable("kostensatz_default", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  stationKuerzel: text("station_kuerzel").notNull(),
  eurProStunde: numeric("eur_pro_stunde", { precision: 8, scale: 2 }).notNull(),
  giltAb: date("gilt_ab").notNull(),
  bemerkung: text("bemerkung"),
}, (table) => [
  check(
    "kostensatz_default_rate_valid_chk",
    sql`${table.eurProStunde}::text not in ('NaN', 'Infinity', '-Infinity') and ${table.eurProStunde} >= 0`,
  ),
  check("kostensatz_default_tenant_nonblank_chk", sql`btrim(${table.tenantId}) <> ''`),
]);

export const teileKlassifikator = pgTable("teile_klassifikator", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: text("tenant_id").notNull(),
  klasse: text("klasse").notNull(),
  keywords: text("keywords").array().notNull(),
  beispielOberflaechen: text("beispiel_oberflaechen").array(),
}, (table) => [
  check("teile_klassifikator_tenant_nonblank_chk", sql`btrim(${table.tenantId}) <> ''`),
  check(
    "teile_klassifikator_template_key_chk",
    sql`btrim(${table.klasse}) <> '' and position('|' in ${table.klasse}) = 0 and public.fn_kreile_template_keywords_valid(${table.keywords})`,
  ),
  uniqueIndex("teile_klassifikator_tenant_normalized_class_uidx").on(
    table.tenantId,
    sql`public.fn_kreile_template_normalize(${table.klasse})`,
  ),
]);

export const warningEvent = pgTable("warning_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  typ: text("typ").notNull(),
  titel: text("titel").notNull(),
  beschreibung: text("beschreibung").notNull(),
  schwere: text("schwere").notNull(),
  payload: jsonb("payload"),
  link: text("link"),
  erzeugtAm: timestamp("erzeugt_am", { withTimezone: true }).defaultNow(),
  dismissedAm: timestamp("dismissed_am", { withTimezone: true }),
  dismissedVon: uuid("dismissed_von"),
  begruendung: text("begruendung"),
  suppressBis: timestamp("suppress_bis", { withTimezone: true }),
});
