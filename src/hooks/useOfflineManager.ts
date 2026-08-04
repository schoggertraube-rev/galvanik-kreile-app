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
    // In a real implementation this would write to IndexedDB or localStorage
    console.log('[OfflineManager] Action enqueued:', action)
  }, [])

  return {
    outbox,
    enqueueAction
  }
}
