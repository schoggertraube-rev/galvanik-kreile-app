'use client'

import { useCallback, useEffect, useState } from 'react'
import { IndexedDBHelper, type OfflineAction } from '@/lib/offline/IndexedDBHelper'
import { OfflineManager } from '@/lib/offline/OfflineManager'

export function useOfflineManager() {
  const [outbox, setOutbox] = useState<OfflineAction[]>([])

  const refresh = useCallback(async () => {
    setOutbox(await IndexedDBHelper.getQueue())
  }, [])

  useEffect(() => {
    void refresh()
    const listener = () => void refresh()
    window.addEventListener('kreile-sync-queue-updated', listener)
    return () => window.removeEventListener('kreile-sync-queue-updated', listener)
  }, [refresh])

  const enqueueAction = useCallback(async (actionType: OfflineAction['actionType'], payload: unknown) => {
    const action = await OfflineManager.enqueueAction(actionType, payload)
    await refresh()
    return action
  }, [refresh])

  return { outbox, enqueueAction, refresh }
}
