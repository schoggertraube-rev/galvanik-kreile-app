import { pgTable, text, timestamp, boolean, integer, uuid, numeric, date, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
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
});

export const vorlageVerbrauch = pgTable("vorlage_verbrauch", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  schluessel: text("schluessel").notNull(),
  teilekategorie: text("teilekategorie"),
  oberflaeche: text("oberflaeche"),
  stationKuerzel: text("station_kuerzel").notNull(),
  inventoryItemId: text("inventory_item_id").notNull().references(() => inventoryItems.id),
  einheitNormiert: text("einheit_normiert").notNull(),
  medianMenge: numeric("median_menge", { precision: 10, scale: 4 }).notNull(),
  p25Menge: numeric("p25_menge", { precision: 10, scale: 4 }),
  p75Menge: numeric("p75_menge", { precision: 10, scale: 4 }),
  nReferenzauftraege: integer("n_referenzauftraege").notNull(),
  haeufigkeitProzent: numeric("haeufigkeit_prozent", { precision: 5, scale: 2 }),
  letzteAktualisierung: timestamp("letzte_aktualisierung", { withTimezone: true }).defaultNow(),
});

export const arbeitszeitBuchung = pgTable("arbeitszeit_buchung", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  auftragId: text("auftrag_id").notNull().references(() => orders.id),
  employeeId: uuid("employee_id").notNull().references(() => appUsers.id),
  kostenstelleKuerzel: text("kostenstelle_kuerzel").notNull(),
  stationKuerzel: text("station_kuerzel").notNull(),
  startZeit: timestamp("start_zeit", { withTimezone: true }).notNull(),
  endZeit: timestamp("end_zeit", { withTimezone: true }),
  dauerMinuten: integer("dauer_minuten").notNull(),
  kostensatzEurProStunde: numeric("kostensatz_eur_pro_stunde", { precision: 8, scale: 2 }).notNull(),
  erfasstModus: text("erfasst_modus").notNull(),
  warAusVorlage: boolean("war_aus_vorlage").default(false),
  vorlageId: uuid("vorlage_id").references(() => vorlageZeit.id),
  bemerkung: text("bemerkung"),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).defaultNow(),
  aktualisiertAm: timestamp("aktualisiert_am", { withTimezone: true }).defaultNow(),
  clientRequestId: uuid("client_request_id"),
}, (table) => [
  index("arbeitszeit_buchung_tenant_order_idx").on(table.tenantId, table.auftragId, table.erstelltAm),
  index("arbeitszeit_buchung_tenant_request_idx").on(table.tenantId, table.clientRequestId),
]);

export const captureRequestReceipts = pgTable("capture_request_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  clientRequestId: uuid("client_request_id").notNull(),
  kind: text("kind").notNull(),
  actorId: uuid("actor_id").notNull().references(() => appUsers.id),
  orderId: text("order_id").notNull().references(() => orders.id),
  stationKuerzel: text("station_kuerzel"),
  requestHash: text("request_hash").notNull(),
  result: jsonb("result").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("capture_request_receipts_tenant_request_kind_uidx").on(table.tenantId, table.clientRequestId, table.kind),
  index("capture_request_receipts_tenant_order_created_idx").on(table.tenantId, table.orderId, table.createdAt),
]);

export const kostensatzDefault = pgTable("kostensatz_default", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  stationKuerzel: text("station_kuerzel").notNull(),
  eurProStunde: numeric("eur_pro_stunde", { precision: 8, scale: 2 }).notNull(),
  giltAb: date("gilt_ab").notNull(),
  bemerkung: text("bemerkung"),
});

export const teileKlassifikator = pgTable("teile_klassifikator", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: text("tenant_id").notNull(),
  klasse: text("klasse").notNull(),
  keywords: text("keywords").array().notNull(),
  beispielOberflaechen: text("beispiel_oberflaechen").array(),
});

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
