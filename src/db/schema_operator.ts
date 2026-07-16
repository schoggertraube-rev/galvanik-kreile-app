import { bigint, index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const tenantOperatorControls = pgTable("tenant_operator_controls", {
  tenantId: text("tenant_id").primaryKey(),
  plan: varchar("plan", { length: 20 }).notNull(),
  mode: varchar("mode", { length: 20 }).notNull(),
  reason: varchar("reason", { length: 40 }).notNull(),
  notice: varchar("notice", { length: 500 }),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
  policyVersion: bigint("policy_version", { mode: "number" }).notNull(),
  canonicalPayload: text("canonical_payload").notNull(),
  signature: varchar("signature", { length: 100 }).notNull(),
  requestDigest: varchar("request_digest", { length: 64 }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("tenant_operator_controls_mode_idx").on(table.mode, table.effectiveAt),
]);

export const operatorControlEvents = pgTable("operator_control_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  policyVersion: bigint("policy_version", { mode: "number" }).notNull(),
  plan: varchar("plan", { length: 20 }).notNull(),
  mode: varchar("mode", { length: 20 }).notNull(),
  reason: varchar("reason", { length: 40 }).notNull(),
  notice: varchar("notice", { length: 500 }),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
  canonicalPayload: text("canonical_payload").notNull(),
  signature: varchar("signature", { length: 100 }).notNull(),
  requestDigest: varchar("request_digest", { length: 64 }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("operator_control_events_tenant_version_uidx").on(table.tenantId, table.policyVersion),
  index("operator_control_events_tenant_received_idx").on(table.tenantId, table.receivedAt),
]);
