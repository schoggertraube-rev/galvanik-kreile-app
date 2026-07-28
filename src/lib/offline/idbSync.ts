/**
 * Compatibility boundary for the historic browser mutation queue.
 *
 * There is no approved tenant, conflict-resolution, receipt or recovery
 * contract for offline mutations. Every operation therefore rejects before it
 * can read, queue, synchronise, mutate, or delete browser data.
 */
export type SyncOperation = "CREATE" | "UPDATE" | "DELETE";

export type SyncMutation = {
  id: string;
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  timestamp: string;
  status: "pending" | "syncing" | "failed";
  retryCount: number;
  lastError?: string;
};

export class OfflineSyncNotConfiguredError extends Error {
  constructor(rejectedInputCount: number) {
    super(
      `NOT_CONFIGURED: Offline-Mutationen sind nicht freigegeben.${rejectedInputCount > 0 ? " Übergebene Eingaben wurden nicht verarbeitet." : ""}`,
    );
    this.name = "OfflineSyncNotConfiguredError";
  }
}

function offlineSyncUnavailable(...rejectedInputs: readonly unknown[]): never {
  throw new OfflineSyncNotConfiguredError(rejectedInputs.length);
}

export const syncQueue = {
  async add(
    entityType: string,
    entityId: string,
    operation: SyncOperation,
    payload: Record<string, unknown>,
  ): Promise<string> {
    return offlineSyncUnavailable(entityType, entityId, operation, payload);
  },

  async getAll(): Promise<SyncMutation[]> {
    return offlineSyncUnavailable();
  },

  async markFailed(id: string, errorMessage: string): Promise<void> {
    return offlineSyncUnavailable(id, errorMessage);
  },

  async remove(id: string): Promise<void> {
    return offlineSyncUnavailable(id);
  },
};
