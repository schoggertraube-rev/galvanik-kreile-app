'use client'

import { useCallback, useEffect, useState } from 'react'
import { IndexedDBHelper, type OfflineAction } from '@/lib/offline/IndexedDBHelper'
import { OfflineManager } from '@/lib/offline/OfflineManager'

export function useOfflineManager() {
  const [outbox, setOutbox] = useState<OfflineAction[]>([])
  const [outboxError, setOutboxError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setOutbox(await IndexedDBHelper.getQueue())
      setOutboxError(null)
    } catch (error) {
      console.error('Offline outbox refresh failed', error)
      setOutboxError('Lokale Warteschlange ist nicht lesbar; Bestand unbekannt.')
      throw error
    }
  }, [])

  useEffect(() => {
    let active = true
    void IndexedDBHelper.getQueue()
      .then((queue) => {
        if (active) {
          setOutbox(queue)
          setOutboxError(null)
        }
      })
      .catch((error) => {
        console.error('Offline outbox initial load failed', error)
        if (active) setOutboxError('Lokale Warteschlange ist nicht lesbar; Bestand unbekannt.')
      })
    const listener = () => { void refresh().catch(() => undefined) }
    window.addEventListener('kreile-sync-queue-updated', listener)
    return () => {
      active = false
      window.removeEventListener('kreile-sync-queue-updated', listener)
    }
  }, [refresh])

  const enqueueAction = useCallback(async (actionType: OfflineAction['actionType'], payload: unknown) => {
    const action = await OfflineManager.enqueueAction(actionType, payload)
    await refresh().catch(() => undefined)
    return action
  }, [refresh])

  return { outbox, outboxError, enqueueAction, refresh }
}
