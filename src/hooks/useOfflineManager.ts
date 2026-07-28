export interface OfflineAction {
  id: string
  type: string
  payload: Record<string, unknown>
  timestamp: string
  status: 'pending' | 'syncing' | 'failed' | 'completed'
}

/**
 * Offline persistence is deliberately unavailable until it has a tenant-scoped,
 * conflict-safe data contract. This adapter neither queues nor persists work.
 */
export class OfflineManagerNotConfiguredError extends Error {
  constructor() {
    super('NOT_CONFIGURED: Offline-Verarbeitung ist noch nicht freigegeben.')
    this.name = 'OfflineManagerNotConfiguredError'
  }
}

export function useOfflineManager() {
  return {
    outbox: [] as OfflineAction[],
    enqueueAction: (_action: OfflineAction): never => {
      void _action
      throw new OfflineManagerNotConfiguredError()
    },
  }
}
