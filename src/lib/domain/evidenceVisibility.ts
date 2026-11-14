/** S11: metadata of the same stored original, never a copy of its bytes. */
export type EvidenceVisibility = {
  customerVisible: boolean;
  version: number;
  eventId: string | null;
  actorId: string | null;
  occurredAt: string | null;
};

export type EvidenceVisibilityRow = {
  customer_visible: boolean;
  visibility_version: number;
  visibility_event_id: string | null;
  visibility_actor_id: string | null;
  visibility_occurred_at: Date | string | null;
};

/** The SQL projection alone supplies the explicit N9 default. Missing columns
 * are a broken source, not an alternative JavaScript default. */
export function mapEvidenceVisibility(row: EvidenceVisibilityRow): EvidenceVisibility {
  if (typeof row.customer_visible !== 'boolean'
    || !Number.isSafeInteger(row.visibility_version) || row.visibility_version < 0
    || row.visibility_event_id !== null && typeof row.visibility_event_id !== 'string'
    || row.visibility_actor_id !== null && typeof row.visibility_actor_id !== 'string'
    || row.visibility_occurred_at === undefined) throw Error('EVIDENCE_VISIBILITY_SOURCE_INVALID');
  const at = row.visibility_occurred_at === null ? null : new Date(row.visibility_occurred_at);
  if (at !== null && !Number.isFinite(at.getTime())) throw Error('EVIDENCE_VISIBILITY_TIME_INVALID');
  if (row.visibility_version === 0
    ? row.customer_visible || row.visibility_actor_id !== null
    : !row.visibility_event_id || !row.visibility_actor_id || at === null) {
    throw Error('EVIDENCE_VISIBILITY_RECEIPT_INVALID');
  }
  return {customerVisible:row.customer_visible,version:row.visibility_version,
    eventId:row.visibility_event_id,actorId:row.visibility_actor_id,occurredAt:at?.toISOString() ?? null};
}
