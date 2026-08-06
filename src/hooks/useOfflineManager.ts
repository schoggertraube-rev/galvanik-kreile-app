/**
 * @deprecated Mock-only hook that stores actions in React state only (no persistence).
 * Use SyncContext instead. Will be removed with OFFLINE-SHELL-001.
 */
'use client'

import { useState, useCallback } from 'react'

export interface OfflineAction {
  id: string
  type: string
  payload: unknown
  timestamp: string
  status: 'pending' | 'syncing' | 'failed' | 'completed'
}

export function useOfflineManager() {
  const [outbox, setOutbox] = useState<OfflineAction[]>([])

  const enqueueAction = useCallback((action: OfflineAction) => {
    setOutbox(prev => [...prev, action])
    // CONTAINMENT: This hook only stores in React state (lost on unmount).
    // No persistence, no sync. Use SyncContext for real offline support.
    console.warn('[useOfflineManager] deprecated — use SyncContext instead')
  }, [])

  return {
    outbox,
    enqueueAction
  }
}
