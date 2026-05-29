import { pgTable, text, timestamp, boolean, integer, jsonb, uuid, varchar } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

// Helper for CUID primary keys
const cuidPrimaryKey = (name: string) => text(name).primaryKey().$defaultFn(() => createId());

// 1. Users & Roles
export const appUsers = pgTable("app_users", {
  id: uuid("id").primaryKey().defaultRandom(), // matches Supabase auth.users.id
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  role: varchar("role", { length: 50 }).notNull().default("workshop"), // developer, admin, meister, office, workshop, readonly
  location: text("location"),
  language: text("language").default("de"),
  pinHash: text("pin_hash"),
  active: boolean("active").default(true).notNull(),
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
  parts: jsonb("parts").$type<Record<string, unknown>[]>(), // Legacy / MVP fallback
  statusText: text("status_text"),
  delayReason: text("delay_reason"),
  recommendedAction: text("recommended_action"),
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
  userId: uuid("user_id").references(() => appUsers.id),
  workerId: varchar("worker_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 6. Complaints / Reklamationen
export const complaints = pgTable("complaints", {
  id: cuidPrimaryKey("id"),
  orderId: text("order_id").notNull().references(() => orders.id),
  customerId: text("customer_id").notNull().references(() => customers.id),
  reason: text("reason").notNull(),
  status: varchar("status", { length: 50 }).default("open"),
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
  name: text("name").notNull(),
  category: varchar("category", { length: 100 }),
  currentStock: integer("current_stock").default(0),
  minStock: integer("min_stock").default(0),
  unit: varchar("unit", { length: 20 }),
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
