import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type {
  OperationalEventStatus,
  PersistedOperationalEventType,
} from "@/lib/events/operationalEventContract";

// Helper for CUID primary keys
const cuidPrimaryKey = (name: string) => text(name).primaryKey().$defaultFn(() => createId());

// 1. Users & Roles
export const appUsers = pgTable("app_users", {
  id: uuid("id").primaryKey().defaultRandom(), // matches Supabase auth.users.id
  tenantId: text("tenant_id").notNull(),
  email: text("email").notNull(),
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
}, (table) => [
  uniqueIndex("app_users_tenant_id_uidx").on(table.tenantId, table.id),
]);

// 2. Customers
export const customers = pgTable("customers", {
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  customerNumber: varchar("customer_number", { length: 50 }),
  name: text("name").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // business, privat, institution
  street: text("street"),
  city: text("city"),
  zipCode: text("zip_code"),
  country: text("country"),
  address: text("address"), // Raw full address string
  companyName: text("company_name"),
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
  paymentPreference: text("payment_preference").default('rechnung_14'),
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
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
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
  priority: text("priority").default("normal"),
  dueDate: timestamp("due_date"),
  promisedDueDate: timestamp("promised_due_date", { withTimezone: true }),
  completedDate: timestamp("completed_date", { withTimezone: true }),
  attachmentUrl: text("attachment_url"),
  source: text("source"),
  sourceRef: text("source_ref"),
  freetextOriginal: text("freetext_original"),
  isQuote: boolean("is_quote").default(false),
  quoteStatus: text("quote_status"),
  quoteConvertedOrderId: text("quote_converted_order_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("orders_tenant_id_uidx").on(table.tenantId, table.id),
]);

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
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  customerId: text("customer_id").notNull().references(() => customers.id),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  currentStationId: varchar("current_station_id", { length: 100 }).default("wareneingang"),
  material: text("material"),
  surfaceRequested: text("surface_requested"),
  photoIds: jsonb("photo_ids").$type<string[]>(),
  photo: text("photo"),
  repairTypes: text("repair_types").array().default([]),
  stationSequence: jsonb("station_sequence").default([]),
  currentStep: integer("current_step").default(0),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId, table.orderId],
    foreignColumns: [orders.tenantId, orders.id],
    name: "items_tenant_order_fk",
  }).onDelete("cascade"),
  check(
    "items_template_surface_key_chk",
    sql`${table.surfaceRequested} is null or position('|' in ${table.surfaceRequested}) = 0`,
  ),
]);

// 5. Events / Timeline
export const events = pgTable("events", {
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  clientEventId: uuid("client_event_id"),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
  itemId: text("item_id"),
  eventType: varchar("event_type", { length: 100 }).notNull().$type<PersistedOperationalEventType>(),
  description: text("description"),
  notes: text("notes"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  status: varchar("status", { length: 50 }).notNull().default("success").$type<OperationalEventStatus>(),
  userId: uuid("user_id").references(() => appUsers.id),
  workerId: varchar("worker_id", { length: 100 }),
  station: text("station"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("events_tenant_client_event_uidx").on(table.tenantId, table.clientEventId),
  index("events_tenant_order_created_idx").on(table.tenantId, table.orderId, table.createdAt),
  index("events_tenant_item_created_idx").on(table.tenantId, table.itemId, table.createdAt),
]);

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
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  category: text("category"),
  currentStock: numeric("current_stock", { precision: 14, scale: 4 }).default("0").notNull(),
  minStock: numeric("min_stock", { precision: 14, scale: 4 }).default("0"),
  unit: text("unit").notNull(),
  einkaufspreisEur: numeric("einkaufspreis_eur", { precision: 10, scale: 4 }),
  einheitNormiert: text("einheit_normiert"),
  kostenstelleDefaultKuerzel: text("kostenstelle_default_kuerzel"),
  letzterPreisAktualisiertAm: timestamp("letzter_preis_aktualisiert_am", { withTimezone: true }),
  letzterPreisQuelleBelegId: uuid("letzter_preis_quelle_beleg_id"),
}, (table) => [
  uniqueIndex("inventory_items_tenant_id_uidx").on(table.tenantId, table.id),
  check(
    "inventory_items_current_stock_nonnegative",
    sql`${table.currentStock}::text not in ('NaN', 'Infinity', '-Infinity') and ${table.currentStock} >= 0`,
  ),
  check(
    "inventory_items_min_stock_valid_chk",
    sql`${table.minStock} is null or (${table.minStock}::text not in ('NaN', 'Infinity', '-Infinity') and ${table.minStock} >= 0)`,
  ),
  check(
    "inventory_items_purchase_price_valid_chk",
    sql`${table.einkaufspreisEur} is null or (${table.einkaufspreisEur}::text not in ('NaN', 'Infinity', '-Infinity') and ${table.einkaufspreisEur} >= 0)`,
  ),
  check("inventory_items_tenant_nonblank_chk", sql`btrim(${table.tenantId}) <> ''`),
  check("inventory_items_unit_nonblank_chk", sql`btrim(${table.unit}) <> ''`),
]);

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  inventoryItemId: text("inventory_item_id").notNull(),
  movementType: text("movement_type").notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
  unit: text("unit").notNull(),
  reason: text("reason"),
  orderId: text("order_id"),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  kostenstelleKuerzel: text("kostenstelle_kuerzel"),
  stationKuerzel: text("station_kuerzel"),
  erfasstVon: uuid("erfasst_von").notNull(),
  warAusVorlage: boolean("war_aus_vorlage"),
  vorlageId: uuid("vorlage_id"),
  snapshotEinkaufspreisEur: numeric("snapshot_einkaufspreis_eur", { precision: 10, scale: 4 }),
  notiz: text("notiz"),
  clientRequestId: uuid("client_request_id"),
}, (table) => [
  foreignKey({
    columns: [table.tenantId, table.inventoryItemId],
    foreignColumns: [inventoryItems.tenantId, inventoryItems.id],
    name: "stock_movements_tenant_inventory_fk",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.tenantId, table.orderId],
    foreignColumns: [orders.tenantId, orders.id],
    name: "stock_movements_tenant_order_fk",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.tenantId, table.createdBy],
    foreignColumns: [appUsers.tenantId, appUsers.id],
    name: "stock_movements_tenant_created_by_fk",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.tenantId, table.erfasstVon],
    foreignColumns: [appUsers.tenantId, appUsers.id],
    name: "stock_movements_tenant_erfasst_von_fk",
  }).onDelete("restrict"),
  check(
    "stock_movements_quantity_nonzero",
    sql`${table.quantity}::text not in ('NaN', 'Infinity', '-Infinity') and ${table.quantity} <> 0`,
  ),
  check(
    "stock_movements_type_chk",
    sql`${table.movementType} in ('stock_in', 'stock_out', 'consumption', 'verbrauch', 'correction', 'waste')`,
  ),
  check(
    "stock_movements_quantity_direction_chk",
    sql`(
      (${table.movementType} = 'stock_in' and ${table.quantity} > 0)
      or (${table.movementType} in ('stock_out', 'consumption', 'verbrauch', 'waste') and ${table.quantity} < 0)
      or (${table.movementType} = 'correction' and ${table.quantity} <> 0)
    )`,
  ),
  check(
    "stock_movements_reason_required_chk",
    sql`${table.movementType} not in ('correction', 'waste') or (${table.reason} is not null and btrim(${table.reason}) <> '')`,
  ),
  check(
    "stock_movements_template_provenance_chk",
    sql`(
      ${table.vorlageId} is null and ${table.warAusVorlage} is distinct from true
    ) or (
      ${table.vorlageId} is not null and ${table.warAusVorlage} is true
    )`,
  ),
  check(
    "stock_movements_snapshot_price_valid_chk",
    sql`${table.snapshotEinkaufspreisEur} is null or (${table.snapshotEinkaufspreisEur}::text not in ('NaN', 'Infinity', '-Infinity') and ${table.snapshotEinkaufspreisEur} >= 0)`,
  ),
  check("stock_movements_actor_consistency_chk", sql`${table.createdBy} = ${table.erfasstVon}`),
  check("stock_movements_tenant_nonblank_chk", sql`btrim(${table.tenantId}) <> ''`),
  check("stock_movements_unit_nonblank_chk", sql`btrim(${table.unit}) <> ''`),
  index("stock_movements_tenant_inventory_created_id_idx").on(
    table.tenantId,
    table.inventoryItemId,
    table.createdAt,
    table.id,
  ),
  index("stock_movements_tenant_order_created_idx").on(table.tenantId, table.orderId, table.createdAt),
  index("stock_movements_tenant_request_idx").on(table.tenantId, table.clientRequestId),
]);

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

export const kvpItems = pgTable("kvp_items", {
  id: cuidPrimaryKey("id"),
  tenantId: text("tenant_id").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  benefit: text("benefit").notNull(),
  status: text("status").notNull().default("neu"),
  problemDesc: text("problem_desc"),
  hasPhoto: boolean("has_photo").notNull().default(false),
  date: text("date"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 8.5 Scan Uploads
export const scanUploads = pgTable("scan_uploads", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  fileUrl: text("file_url").notNull(),
  recordKind: text("record_kind").notNull().default("legacy"),
  fileType: text("file_type"),
  contentSha256: varchar("content_sha256", { length: 64 }),
  fileSizeBytes: integer("file_size_bytes"),
  processingAttemptCount: integer("processing_attempt_count").notNull().default(0),
  processingClaimedAt: timestamp("processing_claimed_at", { withTimezone: true }),
  lastProcessingError: text("last_processing_error"),
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
  tenantId: text("tenant_id").notNull(),
  clientRequestId: uuid("client_request_id"),
  action: text("action").notNull(),
  tableName: text("table_name"),
  recordId: text("record_id"),
  actorId: uuid("actor_id"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("audit_log_tenant_request_action_uidx")
    .on(table.tenantId, table.clientRequestId, table.action)
    .where(sql`${table.clientRequestId} is not null`),
  index("audit_log_tenant_created_idx").on(table.tenantId, table.createdAt),
  foreignKey({
    columns: [table.tenantId, table.actorId],
    foreignColumns: [appUsers.tenantId, appUsers.id],
    name: "audit_log_tenant_actor_fk",
  }).onDelete("restrict"),
  check("audit_log_tenant_nonblank_chk", sql`btrim(${table.tenantId}) <> ''`),
]);

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
export const baeder = pgTable("baths", {
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  name: varchar("name", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("not_evaluated"),
  temperatureMin: numeric("temperature_min", { precision: 5, scale: 2 }),
  temperatureMax: numeric("temperature_max", { precision: 5, scale: 2 }),
  phMin: numeric("ph_min", { precision: 4, scale: 2 }),
  phMax: numeric("ph_max", { precision: 4, scale: 2 }),
  letzteWartung: timestamp("last_measured_at"),
  targetValues: jsonb("target_values").notNull().default({}),
  processType: text("process_type").notNull().default("unknown"),
  stationId: text("station_id"),
  notes: text("notes"),
});

// 16. Bad-Messwerte (Historie)
export const badMesswerte = pgTable("bath_measurements", {
  id: cuidPrimaryKey("id"),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  badId: text("bath_id").notNull().references(() => baeder.id, { onDelete: "cascade" }),
  temperature: numeric("temperature", { precision: 10, scale: 2 }),
  phValue: numeric("ph_value", { precision: 10, scale: 2 }),
  notes: text("notes"),
  statusAfterMeasurement: varchar("status_after_measurement", { length: 50 }).notNull().default("not_evaluated"),
  measuredByUserId: text("measured_by_user_id").references(() => appUsers.id, { onDelete: "restrict" }),
  measuredAt: timestamp("measured_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
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

// --- Phase 2: Mollie, Resend & Networking ---

export const communications = pgTable("communications", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  customerId: text("customer_id").references(() => customers.id),
  orderId: text("order_id").references(() => orders.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id"),
  createdBy: uuid("created_by").references(() => appUsers.id),
  subject: text("subject"),
  body: text("body"),
  type: text("type"),
  channelType: text("channel_type"),
  resendMessageId: text("resend_message_id"),
  recipient: text("recipient"),
  templateKey: text("template_key"),
  idempotencyKey: text("idempotency_key"),
  status: text("status").default("queued"),
  attemptCount: integer("attempt_count").notNull().default(0),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  errorCode: text("error_code"),
  openedAt: timestamp("opened_at"),
  bouncedAt: timestamp("bounced_at"),
  complainedAt: timestamp("complained_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("communications_tenant_idempotency_uidx").on(table.tenantId, table.idempotencyKey),
  index("communications_delivery_status_idx").on(table.status, table.claimedAt),
  index("communications_tenant_invoice_created_idx").on(table.tenantId, table.invoiceId, table.createdAt),
]);

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

export const emailWebhookEvents = pgTable("email_webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull().default("galvanik-kreile"),
  providerEventId: text("provider_event_id").notNull(),
  providerMessageId: text("provider_message_id"),
  eventType: text("event_type").notNull(),
  status: text("status").notNull().default("processing"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  errorCode: text("error_code"),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("email_webhook_events_provider_event_uidx").on(table.providerEventId),
  index("email_webhook_events_message_idx").on(table.providerMessageId, table.receivedAt),
]);

export const appUsageEvents = pgTable("app_usage_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull(),
  clientEventId: uuid("client_event_id").notNull(),
  actorPseudonym: varchar("actor_pseudonym", { length: 64 }).notNull(),
  actorRole: varchar("actor_role", { length: 50 }).notNull(),
  sessionId: uuid("session_id").notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  route: varchar("route", { length: 200 }).notNull(),
  target: varchar("target", { length: 100 }),
  deviceClass: varchar("device_class", { length: 20 }).notNull(),
  outcome: varchar("outcome", { length: 20 }),
  durationMs: integer("duration_ms"),
  resultCount: integer("result_count"),
  queryLength: integer("query_length"),
  clickCount: integer("click_count"),
  buildId: varchar("build_id", { length: 100 }),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("app_usage_events_tenant_client_uidx").on(table.tenantId, table.clientEventId),
  index("app_usage_events_tenant_occurred_idx").on(table.tenantId, table.occurredAt),
  index("app_usage_events_tenant_type_idx").on(table.tenantId, table.eventType, table.occurredAt),
]);

export const developerFeedback = pgTable("developer_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 50 }).notNull(),
  clientRequestId: uuid("client_request_id").notNull(),
  actorPseudonym: varchar("actor_pseudonym", { length: 64 }).notNull(),
  actorRole: varchar("actor_role", { length: 50 }).notNull(),
  route: varchar("route", { length: 200 }).notNull(),
  message: text("message").notNull(),
  buildId: varchar("build_id", { length: 100 }),
  status: varchar("status", { length: 20 }).notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("developer_feedback_actor_request_uidx").on(table.tenantId, table.actorPseudonym, table.clientRequestId),
  index("developer_feedback_tenant_created_idx").on(table.tenantId, table.createdAt),
  index("developer_feedback_tenant_status_idx").on(table.tenantId, table.status, table.createdAt),
]);

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
  quoteDigest: text("quote_digest"),
  webhookTokenHash: text("webhook_token_hash"),
  receiptUrl: text("receipt_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
