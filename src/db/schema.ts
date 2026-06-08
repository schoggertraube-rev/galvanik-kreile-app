import { pgTable, text, timestamp, boolean, integer, jsonb, uuid, varchar, numeric } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

// Helper for CUID primary keys
const cuidPrimaryKey = (name: string) => text(name).primaryKey().$defaultFn(() => createId());

// 1. Users & Roles
export const appUsers = pgTable("app_users", {
  id: uuid("id").primaryKey().defaultRandom(), // matches Supabase auth.users.id
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  role: varchar("role", { length: 50 }).notNull().default("werkstatt"), // developer, admin, meister, buero, werkstatt, readonly
  location: text("location"),
  language: text("language").default("de"),
  pinHash: text("pin_hash"),
  active: boolean("active").default(true).notNull(),
  kostensatzEurProStunde: numeric("kostensatz_eur_pro_stunde", { precision: 8, scale: 2 }),
  istProduktiv: boolean("ist_produktiv").default(true),
  wochenstunden: numeric("wochenstunden", { precision: 5, scale: 2 }),
  urlaubstageProJahr: integer("urlaubstage_pro_jahr"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 2. Customers
export const customers = pgTable("customers", {
  id: cuidPrimaryKey("id"),
  customerNumber: varchar("customer_number", { length: 50 }),
  name: text("name").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // business, privat, institution
  city: text("city"),
  zipCode: text("zip_code"),
  address: text("address"),
  companyName: text("company_name"),
  phone: text("phone"),
  email: text("email"),
  prefComm: varchar("pref_comm", { length: 50 }),
  risk: varchar("risk", { length: 50 }).default("Niedrig"),
  riskNote: text("risk_note"),
  notes: text("notes"),
  imageUrls: text("image_urls").array().default([]),
  marketingOptOut: boolean("marketing_opt_out").default(false),
  lastReactivatedAt: timestamp("last_reactivated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. Price Agreements (Standalone table linked to Customer)
export const priceAgreements = pgTable("price_agreements", {
  id: cuidPrimaryKey("id"),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(),
  rate: text("rate").notNull(),
  date: timestamp("date").defaultNow().notNull(),
});

// 4. Orders
export const orders = pgTable("orders", {
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).default("galvanik-kreile"),
  orderNumber: text("order_number").notNull().unique(),
  customerId: text("customer_id").notNull().references(() => customers.id),
  title: text("title").notNull(),
  task: text("task"),
  station: varchar("station", { length: 100 }).notNull().default("wareneingang"),
  currentStationId: varchar("current_station_id", { length: 100 }),
  status: varchar("status", { length: 50 }).notNull().default("in_progress"),
  risk: varchar("risk", { length: 50 }).default("green"),
  priorityComputed: varchar("priority_computed", { length: 50 }).default("green"),
  inquiryId: text("inquiry_id"), // FK to inquiries for attribution
  parts: jsonb("parts").$type<Record<string, unknown>[]>(), // Legacy / MVP fallback
  statusText: text("status_text"),
  delayReason: text("delay_reason"),
  recommendedAction: text("recommended_action"),
  kostenstellePrimaerId: uuid("kostenstelle_primaer_id"),
  dbGeplant: numeric("db_geplant", { precision: 12, scale: 2 }),
  dbIst: numeric("db_ist", { precision: 12, scale: 2 }),
  dbLetzteBerechnung: timestamp("db_letzte_berechnung", { withTimezone: true }),
  intakeDate: timestamp("intake_date").defaultNow(),
  dueDate: timestamp("due_date"),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 4.5 Items (Standalone table for parts, referenced by orders.actions.ts)
export const items = pgTable("items", {
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).default("galvanik-kreile"),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  customerId: text("customer_id").notNull().references(() => customers.id),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  currentStationId: varchar("current_station_id", { length: 100 }).default("wareneingang"),
  material: text("material"),
  surfaceRequested: text("surface_requested"),
  photoIds: jsonb("photo_ids").$type<string[]>(),
  photo: text("photo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 5. Events / Timeline
export const events = pgTable("events", {
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).default("galvanik-kreile"),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  itemId: text("item_id"),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  description: text("description"),
  notes: text("notes"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  status: varchar("status", { length: 50 }).default("success"),
  userId: uuid("user_id").references(() => appUsers.id),
  workerId: varchar("worker_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 6. Complaints / Reklamationen
export const complaints = pgTable("complaints", {
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).default("galvanik-kreile"),
  orderId: text("order_id").notNull().references(() => orders.id),
  customerId: text("customer_id").notNull().references(() => customers.id),
  itemId: text("item_id"),
  reason: text("reason").notNull(),
  stationId: text("station_id"),
  description: text("description").notNull().default(''),
  photoIds: jsonb("photo_ids").$type<string[]>(),
  status: varchar("status", { length: 50 }).default("open"),
  resolvedAt: timestamp("resolved_at"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 7. Inventory & Baths
export const baths = pgTable("baths", {
  id: cuidPrimaryKey("id"),
  name: text("name").notNull(),
  status: varchar("status", { length: 50 }).default("stable"),
  lastMeasuredAt: timestamp("last_measured_at"),
  temperatureMax: integer("temperature_max"),
  temperatureMin: integer("temperature_min"),
  phMax: integer("ph_max"),
  phMin: integer("ph_min"),
});

export const inventoryItems = pgTable("inventory_items", {
  id: cuidPrimaryKey("id"),
  tenantId: text("tenant_id"),
  name: text("name").notNull(),
  category: varchar("category", { length: 100 }),
  currentStock: integer("current_stock").default(0),
  minStock: integer("min_stock").default(0),
  unit: varchar("unit", { length: 20 }),
  einkaufspreisEur: numeric("einkaufspreis_eur", { precision: 10, scale: 4 }),
  einheitNormiert: text("einheit_normiert"),
  kostenstelleDefaultKuerzel: text("kostenstelle_default_kuerzel"),
  letzterPreisAktualisiertAm: timestamp("letzter_preis_aktualisiert_am", { withTimezone: true }),
  letzterPreisQuelleBelegId: uuid("letzter_preis_quelle_beleg_id"),
});

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  inventoryItemId: text("inventory_item_id").notNull(),
  movementType: text("movement_type").notNull(),
  quantity: numeric("quantity").notNull(),
  reason: text("reason"),
  orderId: text("order_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  kostenstelleKuerzel: text("kostenstelle_kuerzel"),
  stationKuerzel: text("station_kuerzel"),
  erfasstVon: uuid("erfasst_von").references(() => appUsers.id),
  warAusVorlage: boolean("war_aus_vorlage").default(false),
  vorlageId: uuid("vorlage_id"),
  snapshotEinkaufspreisEur: numeric("snapshot_einkaufspreis_eur", { precision: 10, scale: 4 }),
  notiz: text("notiz"),
});

// Legacy aliases for backward compatibility with old actions
export const statusEvents = events;

// 8. Inquiries (QuoteRequests)
export const inquiries = pgTable("inquiries", {
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).notNull(),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
  customerName: text("customer_name").notNull(),
  subject: text("subject").notNull().default(''),
  description: text("description").notNull().default(''),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  rustLevel: text("rust_level"),
  dirtLevel: text("dirt_level"),
  partCount: integer("part_count").notNull().default(1),
  material: text("material").notNull().default(''),
  status: text("status").notNull().default('offen'),
  photo: text("photo"),
  quelleTyp: text("quelle_typ").notNull().default('unbekannt'),
  quelleTouchpointId: uuid("quelle_touchpoint_id"), // Will reference marketing_touchpoints
  quelleManuell: text("quelle_manuell"),
  quelleKonfidenz: numeric("quelle_konfidenz", { precision: 5, scale: 2 }), // 0..1
  pricing: jsonb("pricing").$type<{
    grundarbeit: number;
    reinigung: number;
    entmetallisierung: number;
    schleifaufwand: number;
    badchemie: number;
    risikopuffer: number;
    marge: number;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 9. UI Events Tracking
export const uiEventsTable = pgTable("ui_events", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  tenantId: text("tenant_id").notNull(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  sessionId: text("session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 10. Admin & Features
export const featureFlags = pgTable("feature_flags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  enabled: boolean("enabled").default(false),
  rolesAllowed: text("roles_allowed").array().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const importJobs = pgTable("import_jobs", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  createdBy: uuid("created_by").references(() => appUsers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const importJobRows = pgTable("import_job_rows", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  jobId: text("job_id").notNull().references(() => importJobs.id, { onDelete: "cascade" }),
  rowIndex: integer("row_index").notNull(),
  data: jsonb("data").notNull(),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  action: text("action").notNull(),
  tableName: text("table_name"),
  recordId: text("record_id"),
  actorId: uuid("actor_id").references(() => appUsers.id),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const companySettingsTable = pgTable("company_settings", {
  id: text("id").primaryKey().default("default"),
  tenantId: text("tenant_id").notNull(),
  companyName: text("company_name").notNull().default(""),
  tagline: text("tagline").default(""),
  street: text("street").default(""),
  zip: text("zip").default(""),
  city: text("city").default(""),
  country: text("country").default("Deutschland"),
  phone: text("phone").default(""),
  email: text("email").default(""),
  website: text("website").default(""),
  iban: text("iban").default(""),
  bic: text("bic").default(""),
  bankName: text("bank_name").default(""),
  taxId: text("tax_id").default(""),
  logoUrl: text("logo_url").default("/logo.png"),
  emailGreeting: text("email_greeting").default("Sehr geehrte Damen und Herren,"),
  emailPickupInfo: text("email_pickup_info").default("Ihr Auftrag ist fertig und kann abgeholt werden."),
  emailPaymentInfo: text("email_payment_info").default("Bitte ueberweisen Sie den Rechnungsbetrag unter Angabe der Auftragsnummer."),
  emailAgbText: text("email_agb_text").default(""),
  emailFooter: text("email_footer").default("Mit freundlichen Gruessen, Ihr Team von Galvanik Kreile"),
  emailAdditionalNotes: text("email_additional_notes").default(""),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const phoneNotes = pgTable("phone_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("galvanik-kreile"),
  threadId: uuid("thread_id"),
  customerId: text("customer_id").references(() => customers.id),
  orderId: text("order_id").references(() => orders.id),
  rawText: text("raw_text"),
  generatedAnswer: text("generated_answer"),
  callerName: text("caller_name"),
  company: text("company"),
  phone: text("phone"),
  category: text("category"),
  urgency: text("urgency"),
  status: text("status").default("draft"),
  extractionJson: jsonb("extraction_json").default({}),
  linksJson: jsonb("links_json").default([]),
  createdBy: uuid("created_by").references(() => appUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


// 12. Phase 3 (Resilience & Marketing)
export const offlineOutbox = pgTable("offline_outbox", {
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  mutationType: varchar("mutation_type", { length: 100 }).notNull(),
  payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  retryCount: integer("retry_count").default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export const orderCostPositions = pgTable("order_cost_positions", {
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(), // labor, material, external
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const communicationDrafts = pgTable("communication_drafts", {
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  type: varchar("type", { length: 50 }).notNull().default("reactivation"), // reactivation, quote, general
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, sent, archived
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 13. Marketing Tracking & Attribution
export const marketingTouchpoints = pgTable("marketing_touchpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  aktionId: text("aktion_id"),
  kanal: text("kanal").notNull(),
  titel: text("titel"),
  ausgefuehrtAm: timestamp("ausgefuehrt_am").defaultNow().notNull(),
  budget: numeric("budget", { precision: 12, scale: 2 }).default("0"),
  aufwandMinuten: integer("aufwand_minuten").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const kostenPosten = pgTable("kosten_posten", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  modul: text("modul").notNull().default("marketing"),
  kanal: text("kanal"),
  kampagneId: text("kampagne_id"),
  beschreibung: text("beschreibung"),
  betrag: numeric("betrag", { precision: 12, scale: 2 }).notNull(),
  gebuchtAm: timestamp("gebucht_am").defaultNow().notNull(),
});

// 14. Qualitätskontrolle (QS)
export const qs = pgTable("qs", {
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  ergebnis: varchar("ergebnis", { length: 50 }).notNull(), // "bestanden", "nacharbeit", "ausschuss"
  pruefer: text("pruefer"),
  datum: timestamp("datum").defaultNow().notNull(),
  bemerkung: text("bemerkung"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 15. Bäder (Galvanik)
export const baeder = pgTable("baeder", {
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  name: varchar("name", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("ok"), // "ok", "warnung", "kritisch"
  temperatur: numeric("temperatur", { precision: 5, scale: 2 }),
  phWert: numeric("ph_wert", { precision: 4, scale: 2 }),
  letzteWartung: timestamp("letzte_wartung"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 16. Bad-Messwerte (Historie)
export const badMesswerte = pgTable("bad_messwerte", {
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  badId: text("bad_id").notNull().references(() => baeder.id, { onDelete: "cascade" }),
  wertTyp: varchar("wert_typ", { length: 50 }).notNull(), // "temperatur", "ph", "chemie"
  wert: numeric("wert", { precision: 10, scale: 2 }).notNull(),
  gemessenVon: text("gemessen_von"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// 17. Lager & Chemie
export const lagerArtikel = pgTable("lager_artikel", {
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  artikelnummer: varchar("artikelnummer", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  kategorie: varchar("kategorie", { length: 50 }).notNull(), // "chemie", "verpackung", "verschleiss"
  bestand: numeric("bestand", { precision: 10, scale: 2 }).notNull().default("0"),
  mindestbestand: numeric("mindestbestand", { precision: 10, scale: 2 }).notNull().default("0"),
  einheit: varchar("einheit", { length: 20 }).notNull().default("Stk"),
  letzterWareneingang: timestamp("letzter_wareneingang"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 11. Buchhaltung & Finanzen
export * from "./schema_buchhaltung";

// 18. Erfassung (Zeit & Verbrauch)
export * from "./schema_erfassung";
