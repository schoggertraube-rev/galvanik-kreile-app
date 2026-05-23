import { pgTable, text, timestamp, varchar, integer, real, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: varchar('id').primaryKey(),
  authUserId: varchar('auth_user_id'),
  tenantId: varchar('tenant_id').notNull(),
  email: varchar('email').notNull(),
  fullName: varchar('full_name').notNull(),
  role: varchar('role').notNull(), // admin | meister | office | workshop | quality
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const customers = pgTable('customers', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  customerNumber: varchar('customer_number'),
  name: text('name').notNull(),
  type: varchar('type').notNull(),
  city: text('city'),
  email: varchar('email'),
  phone: varchar('phone')
});

export const inventoryItems = pgTable('inventory_items', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  sku: varchar('sku').notNull(),
  name: text('name').notNull(),
  category: varchar('category'),
  unit: varchar('unit'),
  currentStock: integer('current_stock').notNull(),
  minStock: integer('min_stock').notNull()
});

export const baths = pgTable('baths', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  bathNumber: varchar('bath_number').notNull(),
  name: text('name').notNull(),
  processType: varchar('process_type').notNull(),
  stationId: varchar('station_id').notNull()
});

export const orders = pgTable('orders', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  orderNumber: varchar('order_number').notNull(),
  customerId: varchar('customer_id').references(() => customers.id),
  title: text('title').notNull(),
  currentStationId: varchar('current_station_id'),
  status: varchar('status').notNull(),
  priorityComputed: varchar('priority_computed')
});

export const items = pgTable('items', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  itemNumber: varchar('item_number'),
  orderId: varchar('order_id').references(() => orders.id).notNull(),
  customerId: varchar('customer_id'),
  name: text('name').notNull(),
  quantity: integer('quantity').notNull(),
  currentStationId: varchar('current_station_id')
});

export const stockMovements = pgTable('stock_movements', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  inventoryItemId: varchar('inventory_item_id').references(() => inventoryItems.id).notNull(),
  movementType: varchar('movement_type').notNull(),
  quantity: integer('quantity').notNull(),
  unit: varchar('unit'),
  createdBy: varchar('created_by').references(() => users.id)
});

export const bathMeasurements = pgTable('bath_measurements', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  bathId: varchar('bath_id').references(() => baths.id).notNull(),
  temperature: integer('temperature'),
  ph: real('ph'),
  statusAfterMeasurement: varchar('status_after_measurement')
});

export const statusEvents = pgTable('status_events', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  orderId: varchar('order_id').references(() => orders.id).notNull(),
  itemId: varchar('item_id').references(() => items.id),
  workerId: varchar('worker_id').references(() => users.id),
  eventType: varchar('event_type').notNull(),
  notes: text('notes'),
  timestamp: timestamp('timestamp').defaultNow().notNull()
});
