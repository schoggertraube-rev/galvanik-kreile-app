/**
 * The only product process graph currently approved for normal orders.
 * A client may request a command, never select a destination station.
 */
export const OPERATIONAL_PROCESS_CHAIN = [
  "wareneingang",
  "entmetallisierung",
  "schleiferei",
  "galvanik",
  "qualitaetssicherung",
  "warenausgang",
] as const;

export type OperationalProcessStation = (typeof OPERATIONAL_PROCESS_CHAIN)[number];

/** The only mutable states accepted by the canonical process action. */
export const OPERATIONAL_PROCESS_STATUSES = [
  "ready",
  "in_progress",
  "completed",
] as const;

export type OperationalProcessStatus = (typeof OPERATIONAL_PROCESS_STATUSES)[number];

/**
 * Browser commands must carry one stable UUID across retries.  The server
 * stores it in events.client_event_id once W1 has been applied, so a lost
 * response can be resolved from its durable receipt instead of advancing a
 * later process step.
 */
const CLIENT_EVENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCanonicalClientEventId(value: string | null | undefined): value is string {
  return typeof value === "string" && CLIENT_EVENT_ID_PATTERN.test(value);
}

export function normalizeOperationalProcessStation(value: string | null | undefined): OperationalProcessStation | null {
  // "beschichtung" is an historic UI label for the canonical galvanik step.
  const normalized = value === "beschichtung" ? "galvanik" : value;
  return OPERATIONAL_PROCESS_CHAIN.includes(normalized as OperationalProcessStation)
    ? normalized as OperationalProcessStation
    : null;
}

export function getNextOperationalProcessStation(
  currentStation: OperationalProcessStation,
): OperationalProcessStation | null {
  const currentIndex = OPERATIONAL_PROCESS_CHAIN.indexOf(currentStation);
  return OPERATIONAL_PROCESS_CHAIN[currentIndex + 1] ?? null;
}

export function normalizeOperationalProcessStatus(
  value: string | null | undefined,
): OperationalProcessStatus | null {
  return OPERATIONAL_PROCESS_STATUSES.includes(value as OperationalProcessStatus)
    ? value as OperationalProcessStatus
    : null;
}

export function requiresQualityApprovalForCompletion(currentStation: OperationalProcessStation): boolean {
  return currentStation === "qualitaetssicherung";
}
