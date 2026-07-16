export const CUSTOMER_ANONYMIZATION_CAPABILITY = {
  available: false,
  reason: "RETENTION_POLICY_AND_DURABLE_RECEIPT_MISSING",
} as const;

/**
 * Deliberately no mutation is exported from this module. Customer
 * anonymization may only be reintroduced as a tenant-bound server workflow
 * with an approved retention matrix, row lock, idempotency receipt and audit
 * evidence in the same transaction.
 */
