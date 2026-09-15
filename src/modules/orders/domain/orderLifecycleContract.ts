/**
 * F1.2 — D-ARCH-002: single, central naming contract for the operational order
 * status lifecycle. F1.2 only builds the first transition (angenommen -> galvanik);
 * fertig/abgeholt are fixed here as names only, so nothing breaks in F1.3/F1.5.
 * This module holds names only — no workflow engine, no second source of truth.
 * The station status remains a location truth, never a time truth: transition
 * timestamps must never be read as worked time or billing.
 */

export const ORDER_LIFECYCLE_STATUS = {
  ANGENOMMEN: "angenommen",
  GALVANIK: "galvanik",
  FERTIG: "fertig",
  ABGEHOLT: "abgeholt",
} as const;

export type OrderLifecycleStatus =
  (typeof ORDER_LIFECYCLE_STATUS)[keyof typeof ORDER_LIFECYCLE_STATUS];

/** Fixed forward sequence of the lifecycle contract (names only; F1.2 builds step 1 only). */
export const ORDER_LIFECYCLE_STATUS_SEQUENCE: readonly OrderLifecycleStatus[] = [
  ORDER_LIFECYCLE_STATUS.ANGENOMMEN,
  ORDER_LIFECYCLE_STATUS.GALVANIK,
  ORDER_LIFECYCLE_STATUS.FERTIG,
  ORDER_LIFECYCLE_STATUS.ABGEHOLT,
];

/** Accounting status is a separate axis from the station lifecycle (D-ARCH-002). */
export const ORDER_ACCOUNTING_STATUS = {
  BEZAHLT: "bezahlt",
} as const;

export type OrderAccountingStatus =
  (typeof ORDER_ACCOUNTING_STATUS)[keyof typeof ORDER_ACCOUNTING_STATUS];

export function isOrderLifecycleStatus(value: unknown): value is OrderLifecycleStatus {
  return (
    typeof value === "string" &&
    (ORDER_LIFECYCLE_STATUS_SEQUENCE as readonly string[]).includes(value)
  );
}
