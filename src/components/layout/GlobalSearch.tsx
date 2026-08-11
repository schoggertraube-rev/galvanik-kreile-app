'use client'

import { useEffect } from 'react'
import { FoundationUnavailable } from '@/components/foundation/FoundationUnavailable'

type GlobalSearchProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpenChange(!open)
        return
      }

      if (open && event.key === 'Escape') {
        event.preventDefault()
        onOpenChange(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onOpenChange, open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-200 flex items-start justify-center bg-navy-900/40 px-4 pt-[15vh]"
      onMouseDown={() => onOpenChange(false)}
    >
      <div
        aria-labelledby="global-search-unavailable-title"
        aria-modal="true"
        className="w-full max-w-xl rounded-2xl bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-neutral-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-navy-900" id="global-search-unavailable-title">
            Globale Suche ist nicht verfügbar
          </h2>
          <button aria-label="Globale Suche schließen" onClick={() => onOpenChange(false)} type="button">
            Schließen
          </button>
        </div>
        <FoundationUnavailable />
      </div>
    </div>
  )
}
