"use client";

/**
 * A network indicator is not evidence that local changes can be synchronized.
 * The offline receipt contract is intentionally unavailable, so no status is
 * rendered that could imply a functioning queue.
 */
export function OfflineSyncBadge() {
  return null;
}
