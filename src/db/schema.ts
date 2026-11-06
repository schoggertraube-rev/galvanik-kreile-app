import { sql } from "drizzle-orm";
import { pgTable, bigserial, text, timestamp, time, boolean, integer, jsonb, uuid, varchar, numeric, primaryKey, pgSchema, date, bigint, foreignKey, unique, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

// AP-EIN Teil 4: eigenständige Aufgaben; orders.task bleibt die Auftragsbeschreibung.
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  clientKey: uuid("client_key").notNull(),
  art: text("art").notNull(),
  titel: text("titel").notNull(),
  faelligAm: date("faellig_am").notNull(),
  uhrzeit: time("uhrzeit"),
  vorlaufTage: integer("vorlauf_tage").notNull(),
  fuerLogin: uuid("fuer_login").references(()=>appUsers.id),
  fuerBereich: text("fuer_bereich"),
  bezugTyp: text("bezug_typ").notNull(),
  bezugId: text("bezug_id"),
  itemId: uuid("item_id"),
  notiz: text("notiz"),
  status: text("status").notNull(),
  erledigtVon: uuid("erledigt_von").references(()=>appUsers.id),
  erledigtAm: timestamp("erledigt_am", { withTimezone: true }),
  erledigtNotiz: text("erledigt_notiz"),
  erstelltVon: uuid("erstellt_von").notNull().references(()=>appUsers.id),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull(),
  version: integer("version").notNull(),
}, (table) => [unique("tasks_tenant_client_key").on(table.tenantId, table.clientKey),unique("tasks_tenant_id").on(table.tenantId,table.id),foreignKey({columns:[table.tenantId,table.itemId],foreignColumns:[intakeItems.tenantId,intakeItems.id]}).onDelete('restrict')]);

// Helper for CUID primary keys
const cuidPrimaryKey = (name: string) => text(name).primaryKey().$defaultFn(() => createId());

// 1. Users & Roles
export const appUsers = pgTable("app_users", {
  id: uuid("id").primaryKey().defaultRandom(), // matches Supabase auth.users.id
  tenantId: text("tenant_id").notNull(),
  email: text("email"),
  fullName: text("full_name").notNull(),
  shortCode: varchar("kuerzel", { length: 8 }),
  designation: text("bezeichnung"),
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const appUserRights = pgTable("app_user_rights", {
  tenantId: text("tenant_id").notNull(),
  userId: uuid("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
  area: text("bereich").notNull(),
  grantedBy: uuid("granted_by").references(() => appUsers.id, { onDelete: "set null" }),
  grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.tenantId, table.userId, table.area] })]);

export const pinRateLimits = pgTable("pin_rate_limits", {
  operatorId: uuid("operator_id")
    .primaryKey()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lastFailedAt: timestamp("last_failed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  tenantId: text("tenant_id").notNull().default("galvanik-kreile"),
});

// 2. Customers
export const customers = pgTable("customers", {
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  customerNumber: varchar("customer_number", { length: 50 }),
  name: text("name").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // business, privat, lieferant
  street: text("street"),
  city: text("city"),
  zipCode: text("zip_code"),
  country: text("country"),
  address: text("address"), // Raw full address string
  companyName: text("company_name"),
  salutation: text("salutation"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  contactRole: text("contact_role"),
  houseNumber: text("house_number"),
  billingEmail: text("billing_email"),
  website: text("website"),
  handoverPreference: text("handover_preference"),
  iban: text("iban"),
  paymentTermDays: integer("zahlungsziel_tage"),
  addressStatus: text("address_status"),
  addressCheckedAt: timestamp("address_checked_at",{withTimezone:true}),
  autoInfo: boolean("auto_info").notNull().default(true),
  vorrang: boolean("vorrang").notNull().default(false),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  prefComm: varchar("pref_comm", { length: 50 }),
  risk: varchar("risk", { length: 50 }).default("Niedrig"),
  riskNote: text("risk_note"),
  notes: text("notes"),
  imageUrls: jsonb("image_urls").default([]),
  paymentProfile: jsonb("payment_profile").default({}),
  approvalProfile: jsonb("approval_profile").default({}),
  expectationProfile: jsonb("expectation_profile").default({}),
  technicalProfile: jsonb("technical_profile").default({}),
  trustLevel: text("trust_level"),
  internalWarning: text("internal_warning"),
  tags: jsonb("tags").default([]),
  creditRating: text("credit_rating"),
  shippingPreference: text("shipping_preference").default('abholung'),
  paymentPreference: text("payment_preference"),
  invoiceTermsEnabled: boolean("ziel_freigeschaltet").notNull().default(false),
  invoiceTermDays: integer("ziel_tage"),
  cashDiscountPercent: numeric("skonto_prozent", { precision: 5, scale: 2 }),
  cashDiscountDays: integer("skonto_tage"),
  vatId: text("vat_id"),
  classification: text("classification").default('B'),
  internalNotes: text("internal_notes"),
  marketingOptOut: boolean("marketing_opt_out").default(false),
  lastReactivatedAt: timestamp("last_reactivated_at"),
  behaviorNotes: text("behavior_notes"),
  source: text("source"),
  sourceRef: text("source_ref"),
  enrichedFields: jsonb("enriched_fields").default([]),
  isLead: boolean("is_lead").default(false),
  leadSince: timestamp("lead_since", { withTimezone: true }),
  convertedAt: timestamp("converted_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const addressDirectory = pgTable("address_directory", {
  id: bigserial("id", {mode:"number"}).primaryKey(), country:text("country").notNull(),
  zipCode:text("zip_code").notNull(),city:text("city").notNull(),district:text("district"),street:text("street"),
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
  geprueft: boolean("geprueft"),
  pickupByName:text("pickup_by_name"),pickupByNote:text("pickup_by_note"),pickupBySource:text("pickup_by_source"),
  pickupByAt:timestamp("pickup_by_at",{withTimezone:true}),pickupByLogin:uuid("pickup_by_login"),
  ausgabeFrei:boolean("ausgabe_frei").notNull().default(false),
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).default("galvanik-kreile"),
  orderNumber: text("order_number").notNull().unique(),
  customerId: text("customer_id").notNull().references(() => customers.id),
  title: text("title").notNull(),
  task: text("task"),
  station: varchar("station", { length: 100 }).notNull().default("angenommen"),
  currentStation: text("current_station").default("angenommen"),
  currentStationId: varchar("current_station_id", { length: 100 }),
  version: integer("version").notNull().default(1),
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
  priority: text("priority").default("normal"),
  dueDate: timestamp("due_date"),
  promisedDueDate: timestamp("promised_due_date", { withTimezone: true }),
  intakeTermStatus: text("intake_term_status"),
  intakeSource: text("intake_source"),
  handoverMode: text("handover_mode"),
  paymentMode: text("payment_mode").notNull().default("vorkasse"),
  paymentModeVersion: integer("payment_mode_version").notNull().default(0),
  completedDate: timestamp("completed_date", { withTimezone: true }),
  attachmentUrl: text("attachment_url"),
  source: text("source"),
  sourceRef: text("source_ref"),
  freetextOriginal: text("freetext_original"),
  isQuote: boolean("is_quote").default(false),
  quoteStatus: text("quote_status"),
  quoteConvertedOrderId: text("quote_converted_order_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  ware: text("ware").notNull().default(sql`'da'::text`),
  wareSeit: timestamp("ware_seit", { withTimezone: true }),
  wunschtermin: date("wunschtermin", { mode: "string" }),
  terminHerkunft: text("termin_herkunft"),
  terminstatusSeit: timestamp("terminstatus_seit", { withTimezone: true }),
  processingWeeks: integer("processing_weeks"),
}, table => [unique("orders_tenant_id_identity_key").on(table.tenantId, table.id)]);

// 4.5 Calendar Events
export const calendarEvents = pgTable("calendar_events", {
  id: cuidPrimaryKey("id"),
  tenantId: text("tenant_id").notNull(),
  orderId: text("order_id"),
  customerId: text("customer_id"),
  title: text("title").notNull(),
  eventType: text("event_type").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  timeSlot: text("time_slot"),
  status: text("status").notNull().default("planned"),
  source: text("source"),
  sourceRef: text("source_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// 4.5 Items (Standalone table for parts, referenced by orders.actions.ts)
export const items = pgTable("items", {
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).default("galvanik-kreile"),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  customerId: text("customer_id").notNull().references(() => customers.id),
  name: text("name").notNull(),
  quantity: numeric("quantity", { mode: "number" }).notNull().default(1),
  currentStationId: varchar("current_station_id", { length: 100 }).default("angenommen"),
  material: text("material"),
  surfaceRequested: text("surface_requested"),
  executionRequested: text("execution_requested").notNull().default("offen"),
  catalogServiceId: uuid("catalog_service_id"),
  unit: text("unit"),
  preisNetto: numeric("preis_netto", { precision: 10, scale: 2 }),
  vatRateBasisPoints: integer("vat_rate_basis_points"),
  photoIds: jsonb("photo_ids").$type<string[]>(),
  photo: text("photo"),
  repairTypes: text("repair_types").array().default([]),
  stationSequence: jsonb("station_sequence").default([]),
  currentStep: integer("current_step").default(0),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  aufwandMin: integer("aufwand_min"),
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
  station: text("station"),
  clientEventId: uuid("client_event_id"),
  eventSchemaVersion: integer("event_schema_version"),
  correlationId: uuid("correlation_id"),
  aggregateVersion: integer("aggregate_version"),
  fromStation: text("from_station"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 6. Complaints / Reklamationen
export const complaints = pgTable("complaints", {
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).default("galvanik-kreile"),
  orderId: text("order_id").notNull().references(() => orders.id),
  customerId: text("customer_id").notNull().references(() => customers.id),
  itemId: text("item_id"),
  intakeItemId: uuid("intake_item_id"),
  reason: text("reason").notNull(),
  stationId: text("station_id"),
  description: text("description").notNull().default(''),
  photoIds: jsonb("photo_ids").$type<string[]>(),
  status: varchar("status", { length: 50 }).default("open"),
  resolvedAt: timestamp("resolved_at"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [foreignKey({name:'complaints_intake_tenant_fk',columns:[table.tenantId,table.intakeItemId],foreignColumns:[intakeItems.tenantId,intakeItems.id]}).onDelete('restrict')]);

// 7. Inventory & Baths
export const bathsOld = pgTable("baths", {
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
  extractedData: jsonb("extracted_data"),
  convertedToOrderId: text("converted_to_order_id"),
  convertedToCustomerId: text("converted_to_customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 8.5 Scan Uploads
export const scanUploads = pgTable("scan_uploads", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type"),
  uploadedBy: uuid("uploaded_by").references(() => appUsers.id),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  detectedType: text("detected_type"),
  detectionConfidence: numeric("detection_confidence", { precision: 3, scale: 2 }),
  extractedData: jsonb("extracted_data"),
  status: text("status").notNull().default("new"),
  linkedOrderId: text("linked_order_id"),
  linkedCustomerId: text("linked_customer_id"),
  linkedInvoiceId: text("linked_invoice_id"),
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
  shippingService:text("versand_dienst").notNull(),shippingNumberPattern:text("versand_nummer_format").notNull(),
  shippingNumberHint:text("versand_nummer_hinweis").notNull(),shippingTrackingUrl:text("versand_verfolgung_url"),shippingLabelApi:text("versand_label_api"),
  id: text("id").primaryKey().default("default"),
  tenantId: text("tenant_id").notNull(),
  companyName: text("company_name").notNull().default(""),
  openingHours: text("oeffnungszeiten"),
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
  invoiceVatRateBasisPoints: integer("invoice_vat_rate_basis_points").default(1900).notNull(),
  invoicePaymentTermDays: integer("invoice_payment_term_days"),
  dailyOutputEur: integer("tagesleistung_eur").notNull().default(800),
  logoUrl: text("logo_url").default("/logo.png"),
  emailGreeting: text("email_greeting").default("Sehr geehrte Damen und Herren,"),
  emailPickupInfo: text("email_pickup_info").default("Ihr Auftrag ist fertig und kann abgeholt werden."),
  emailPaymentInfo: text("email_payment_info").default("Bitte ueberweisen Sie den Rechnungsbetrag unter Angabe der Auftragsnummer."),
  emailAgbText: text("email_agb_text").default(""),
  emailFooter: text("email_footer").default("Mit freundlichen Gruessen, Ihr Team von Galvanik Kreile"),
  emailAdditionalNotes: text("email_additional_notes").default(""),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  uebergabepufferTage: integer("uebergabepuffer_tage").notNull().default(1),
  auslastungPasstPct: integer("auslastung_passt_pct").notNull().default(80),
  auslastungKnappPct: integer("auslastung_knapp_pct").notNull().default(100),
  auslastungWenigPct: integer("auslastung_wenig_pct").notNull().default(50),
  auslastungVorrangPct: integer("auslastung_vorrang_pct").notNull().default(110),
});

export const catalogServices = pgTable("catalog_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  surface: text("surface").notNull(),
  unit: text("unit").notNull(),
  netPriceCents: integer("net_price_cents").notNull(),
  vatRateBasisPoints: integer("vat_rate_basis_points").notNull().default(1900),
  standardLeadTimeWorkingDays: integer("standard_lead_time_working_days").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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

// 15. Bäder (Galvanik)
export const baeder = pgTable("baths", {
  id: cuidPrimaryKey("id"),
  name: varchar("name", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("stable"), // ok, warning, critical, stable
  temperatureMin: numeric("temperature_min", { precision: 5, scale: 2 }),
  temperatureMax: numeric("temperature_max", { precision: 5, scale: 2 }),
  phMin: numeric("ph_min", { precision: 4, scale: 2 }),
  phMax: numeric("ph_max", { precision: 4, scale: 2 }),
  letzteWartung: timestamp("last_measured_at"),
  targetValues: jsonb("target_values").notNull().default({}),
  processType: text("process_type").notNull().default("unknown"),
  stationId: text("station_id"),
});

// 16. Bad-Messwerte (Historie)
export const badMesswerte = pgTable("bath_measurements", {
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  badId: text("bath_id").notNull().references(() => baeder.id, { onDelete: "cascade" }),
  temperature: numeric("temperature", { precision: 10, scale: 2 }),
  phValue: numeric("ph_value", { precision: 10, scale: 2 }),
  notes: text("notes"),
  measuredAt: timestamp("measured_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 11. Buchhaltung & Finanzen
export * from "./schema_buchhaltung";

// 18. Erfassung (Zeit & Verbrauch)
export * from "./schema_erfassung";

// --- Phase 2: Mollie, Resend & Networking ---

export const communications = pgTable("communications", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  customerId: text("customer_id").references(() => customers.id),
  orderId: text("order_id").references(() => orders.id, { onDelete: "cascade" }),
  subject: text("subject"),
  body: text("body"),
  type: text("type"),
  channelType: text("channel_type"),
  resendMessageId: text("resend_message_id"),
  status: text("status").default("queued"),
  openedAt: timestamp("opened_at"),
  bouncedAt: timestamp("bounced_at"),
  complainedAt: timestamp("complained_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  templateKey: text("template_key").notNull().unique(),
  name: text("name").notNull(),
  subjectTemplate: text("subject_template").notNull(),
  bodyHtmlTemplate: text("body_html_template").notNull(),
  bodyTextTemplate: text("body_text_template"),
  variables: jsonb("variables").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const priceLines = pgTable("price_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  itemId: text("item_id").references(() => items.id, { onDelete: "cascade" }),
  positionText: text("position_text").notNull(),
  qty: numeric("qty", { precision: 10, scale: 2 }).default("1"),
  unitPriceEur: numeric("unit_price_eur", { precision: 10, scale: 2 }).notNull(),
  unitTotalEur: numeric("unit_total_eur", { precision: 10, scale: 2 }), // Generated
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
  amountEur: numeric("amount_eur", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  provider: text("provider").notNull(),
  providerIntentId: text("provider_intent_id"),
  mollieStatus: text("mollie_status"),
  mollieMethod: text("mollie_method"),
  receiptUrl: text("receipt_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});


// AP-EIN: canonical intake tables. SQL constraints and RLS remain migration-owned.
const intakePrivateSchema = pgSchema("private");
export const goodsReceipts=pgTable("goods_receipt",{
 id:uuid("id").primaryKey(),tenantId:text("tenant_id").notNull(),clientKey:uuid("client_key").notNull(),itemId:uuid("item_id"),orderId:text("auftrag_id").notNull(),
 mode:text("modus").notNull(),status:text("status").notNull(),card:integer("karte").notNull(),packagesReceived:integer("packstuecke_da"),packagesTotal:integer("packstuecke_gesamt"),condition:text("zustand"),
 deviations:text("abweichung").array().notNull(),foundUnattended:boolean("abgestellt").notNull(),foundAt:timestamp("fund_zeit",{withTimezone:true}),procedure:text("verfahren_wie_kv"),procedureNote:text("verfahren_abweichung"),
 photos:jsonb("fotos").notNull(),quantities:jsonb("mengen").notNull(),open:text("offen").array().notNull(),taskId:uuid("aufgabe_id"),confirmedBy:uuid("bestaetigt_von"),confirmedAt:timestamp("bestaetigt_am",{withTimezone:true}),version:integer("version").notNull().default(1),
 createdAt:timestamp("erstellt_am",{withTimezone:true}).notNull().default(sql`statement_timestamp()`),updatedAt:timestamp("geaendert_am",{withTimezone:true}).notNull().default(sql`statement_timestamp()`),
},table=>[unique().on(table.tenantId,table.id),unique().on(table.tenantId,table.clientKey),foreignKey({columns:[table.tenantId,table.orderId],foreignColumns:[orders.tenantId,orders.id]}).onDelete('restrict'),foreignKey({name:'goods_receipt_task_tenant_fk',columns:[table.tenantId,table.taskId],foreignColumns:[tasks.tenantId,tasks.id]}).onDelete('restrict')]);
export const intakeDrafts = intakePrivateSchema.table("intake_drafts", {
  id:uuid("id").primaryKey().defaultRandom(),tenantId:text("tenant_id").notNull(),actorId:uuid("actor_id").notNull(),
  art:text("art"),payload:jsonb("payload").notNull(),status:text("status").notNull().default("open"),zuletztFeld:text("zuletzt_feld"),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().default(sql`statement_timestamp()`),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().default(sql`statement_timestamp()`),
});
// Identity anchor for the unchanged existing parent of quote_positions.
const privateQuoteIdentity = intakePrivateSchema.table("quotes", { id: uuid("id").primaryKey() });

export const intakeItems = pgTable("intake_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  clientKey: text("client_key").notNull(),
  kanal: text("kanal").notNull(),
  richtung: text("richtung").notNull().default(sql`'rein'::text`),
  quelle: text("quelle").notNull(),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().default(sql`statement_timestamp()`),
  erstelltVon: uuid("erstellt_von").notNull(),
  erstelltAuf: text("erstellt_auf"),
  empfangenAm: timestamp("empfangen_am", { withTimezone: true }),
  absenderName: text("absender_name"),
  absenderAdresse: text("absender_adresse"),
  betreff: text("betreff"),
  text: text("text"),
  textSprache: text("text_sprache"),
  kundeId: text("kunde_id"),
  vorgangArt: text("vorgang_art"),
  vorgangId: text("vorgang_id"),
  zuordnung: text("zuordnung").notNull().default(sql`'offen'::text`),
  zuordnungGrund: text("zuordnung_grund"),
  einsatz: text("einsatz").notNull().default(sql`'offen'::text`),
  geaendertVon: uuid("geaendert_von"),
  geaendertAm: timestamp("geaendert_am", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`statement_timestamp()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`statement_timestamp()`),
  absenderTelefon: text("absender_telefon"),
  absenderBestaetigt: boolean("absender_bestaetigt").notNull().default(false),
  an: text("an").array().notNull().default(sql`'{}'::text[]`),
  cc: text("cc").array().notNull().default(sql`'{}'::text[]`),
  gruppeAdresse: text("gruppe_adresse"),
  kennzeichen: text("kennzeichen").array().notNull().default(sql`'{}'::text[]`),
  zuordnungRegel: text("zuordnung_regel"),
  anliegen: text("anliegen").array().notNull().default(sql`'{}'::text[]`),
  anliegenAbgewaehlt:text("anliegen_abgewaehlt").array().notNull().default(sql`'{}'::text[]`),
  anliegenHaupt: text("anliegen_haupt"),
  anliegenOffen: text("anliegen_offen").array().notNull().default(sql`'{}'::text[]`),
  teilVon: uuid("teil_von"),
  verweisItem: uuid("verweis_item"),
  einsatzAktion: text("einsatz_aktion"),
  einsatzVermerk: text("einsatz_vermerk"),
  einsatzAm: timestamp("einsatz_am", { withTimezone: true }),
  einsatzVon: uuid("einsatz_von"),
  wartetSeit: timestamp("wartet_seit", { withTimezone: true }),
  graphMessageId: text("graph_message_id"),
  internetMessageId: text("internet_message_id"),
  conversationId: text("conversation_id"),
  inReplyTo: text("in_reply_to"),
  references: text("references").array().notNull().default(sql`'{}'::text[]`),
  antwortAufItem: uuid("antwort_auf_item"),
  sendestatus: text("sendestatus"),
  sendefehler: text("sendefehler"),
  gesendetAm: timestamp("gesendet_am", { withTimezone: true }),
  aussortiert: text("aussortiert"),
  infoAutomatisch: boolean("info_automatisch").notNull().default(false),
}, (table) => [
  unique("intake_item_tenant_id_key").on(table.tenantId, table.id),
  unique("intake_item_client_key_uidx").on(table.tenantId, table.clientKey),
  foreignKey({ columns: [table.tenantId, table.teilVon], foreignColumns: [table.tenantId, table.id] }).onDelete("restrict"),
  foreignKey({ columns: [table.tenantId, table.verweisItem], foreignColumns: [table.tenantId, table.id] }).onDelete("restrict"),
  foreignKey({ columns: [table.tenantId, table.antwortAufItem], foreignColumns: [table.tenantId, table.id] }).onDelete("restrict"),
]);

export const intakeEvents = pgTable("intake_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  itemId: uuid("item_id").notNull(),
  zeit: timestamp("zeit", { withTimezone: true }).notNull().default(sql`statement_timestamp()`),
  art: text("art").notNull(),
  befehlId: uuid("befehl_id").notNull(),
  von: text("von").notNull(),
  vorher: jsonb("vorher"),
  nachher: jsonb("nachher"),
  geraetId: text("geraet_id"),
}, (table) => [
  foreignKey({ columns: [table.itemId], foreignColumns: [intakeItems.id] }).onDelete("restrict"),
  index("intake_event_live_files_idx").on(table.tenantId, table.zeit, table.id).where(sql`${table.art} IN ('original_gespeichert','erkannt')`),
]);

export const intakeFiles = pgTable("intake_file", {
  id: uuid("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  itemId: uuid("item_id").notNull(),
  clientKey: text("client_key").notNull(),
  art: text("art").notNull(),
  abgeleitetVon: text("abgeleitet_von").array().notNull().default(sql`'{}'::text[]`),
  fotoArt: text("foto_art"),
  dateiname: text("dateiname").notNull(),
  mime: text("mime").notNull(),
  bytes: bigint("bytes", { mode: "number" }).notNull(),
  sha256: text("sha256").notNull(),
  speicherpfad: text("speicherpfad").notNull(),
  vorschauPfad: text("vorschau_pfad"),
  aufgenommenAm: timestamp("aufgenommen_am", { withTimezone: true }).notNull(),
  aufgenommenVon: uuid("aufgenommen_von").notNull(),
  aufgenommenAuf: text("aufgenommen_auf"),
  reihenfolge: integer("reihenfolge").notNull(),
  lesbar: boolean("lesbar").notNull(),
  erkennungStatus: text("erkennung_status").notNull(),
  erkannterText: text("erkannter_text"),
  sprache: text("sprache"),
  geoeffnet: boolean("geoeffnet").notNull(),
}, (table) => [
  unique().on(table.tenantId, table.id),
  unique().on(table.tenantId, table.clientKey),
  foreignKey({ columns: [table.tenantId, table.itemId], foreignColumns: [intakeItems.tenantId, intakeItems.id] }).onDelete("restrict"),
]);

export const intakeSuggestions = pgTable("intake_suggestion", {
  orderId:text("order_id"),
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  itemId: uuid("item_id").notNull(),
  fileId: uuid("file_id"),
  feld: text("feld").notNull(),
  wert: jsonb("wert").notNull(),
  sicherheit: text("sicherheit").notNull(),
  regel: text("regel"),
  grund: text("grund"),
  fundstelle: jsonb("fundstelle"),
  status: text("status").notNull(),
  entschiedenVon: text("entschieden_von"),
  entschiedenAm: timestamp("entschieden_am", { withTimezone: true }),
  geprueftVon: uuid("geprueft_von"),
  geprueftAm: timestamp("geprueft_am", { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.tenantId, table.itemId], foreignColumns: [intakeItems.tenantId, intakeItems.id] }).onDelete("restrict"),
  foreignKey({ columns: [table.tenantId, table.fileId], foreignColumns: [intakeFiles.tenantId, intakeFiles.id] }).onDelete("restrict"),
]);

export const deviceRequests = pgTable("device_request", {
  id: uuid("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  loginId: uuid("login_id").notNull(),
  itemId: uuid("item_id").notNull(),
  zweck: text("zweck").notNull(),
  kontext: jsonb("kontext"),
  tokenHash: text("token_hash").notNull(),
  tokenSitzung: text("token_sitzung").notNull(),
  status: text("status").notNull(),
  beendetArt: text("beendet_art"),
  angenommenAuf: text("angenommen_auf").array().notNull().default(sql`'{}'::text[]`),
  fertigAuf: text("fertig_auf").array().notNull().default(sql`'{}'::text[]`),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().default(sql`statement_timestamp()`),
  ablaufAm: timestamp("ablauf_am", { withTimezone: true }).notNull(),
}, (table) => [
  foreignKey({ columns: [table.tenantId, table.itemId], foreignColumns: [intakeItems.tenantId, intakeItems.id] }).onDelete("restrict"),
]);

export const outboxMails = pgTable("outbox_mails", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  objekt: text("objekt").notNull(),
  vorlage: text("vorlage").notNull(),
  an: text("an").notNull(),
  status: text("status").notNull(),
  fehlerCode: text("fehler_code"),
  erstelltAm: timestamp("erstellt_am", { withTimezone: true }).notNull().default(sql`statement_timestamp()`),
  gesendetAm: timestamp("gesendet_am", { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.tenantId, table.objekt], foreignColumns: [orders.tenantId, orders.id] }).onDelete("restrict"),
]);

export const quotePositions = intakePrivateSchema.table("quote_positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  quoteId: uuid("quote_id").notNull(),
  position: integer("position").notNull(),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull(),
  material: text("material"),
  surfaceRequested: text("surface_requested").notNull(),
  unitPriceCents: bigint("unit_price_cents", { mode: "number" }).notNull(),
  lineTotalCents: bigint("line_total_cents", { mode: "number" }).generatedAlwaysAs(sql`((quantity)::bigint * unit_price_cents)`),
  revision: integer("revision").notNull().default(1),
  unit: text("unit"),
  aufwandMin: integer("aufwand_min"),
}, (table) => [
  foreignKey({ columns: [table.quoteId], foreignColumns: [privateQuoteIdentity.id] }).onDelete("restrict"),
]);
