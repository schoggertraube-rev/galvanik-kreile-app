import "server-only";

/**
 * Server-Fassade des Moduls orders (ARCHITEKTUR_MODULE_PATH1.md Naht 1/2,
 * _MODULDOSSIERS/G04_AUFTRAEGE/04_SCHNITTSTELLEN_DATEN.md §5).
 *
 * Diese Datei enthaelt bewusst NUR den KPI-Read-Port fuer M02. Die weiteren im
 * Dossier vorgesehenen Ports (`getOrders`, `getOrderCard`, Commands) bleiben in
 * diesem Paket unangetastet und werden hier nicht vorweggenommen.
 */

export { getOrderTimelinessFacts } from "./server/getOrderTimelinessFacts";
export type { OrderTimelinessFactsResult } from "./server/getOrderTimelinessFacts";
export type {
  OrderCancellationClass,
  OrderTimelinessConsistency,
  OrderTimelinessFact,
  OrderTimelinessFacts,
  OrderTimelinessMissingReason,
  OrderTimelinessRange,
  OrderTimelinessSource,
  OrderTimelinessValue,
} from "./domain/orderTimelinessFacts";
