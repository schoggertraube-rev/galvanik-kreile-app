'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { SearchHit, SearchTenantResult } from '@/lib/search/searchTenant'

/**
 * Schlanke Suchleiste des Moduls search (Bauplan §3).
 *
 * Die Komponente besitzt keine Datenwahrheit und spricht nie selbst mit
 * Ports: Der Server-Zugriff wird als `search`-Prop injiziert (der Writer
 * verdrahtet bei M7 eine Server-Action, die searchTenant aufruft). Sie zeigt
 * die sechs ehrlichen Zustände Loading / Empty / Error / Denial / Conflict /
 * Data (`data-state`-Attribut am Wurzelelement) und ist per Tastatur
 * bedienbar (Pfeiltasten, Enter, Escape). Optik bewusst neutral im
 * bestehenden Designsystem — die finale Gestalt kommt vom UI-FIX-GATE.
 */

export type SearchBarState =
  | 'idle'
  | 'loading'
  | 'data'
  | 'empty'
  | 'error'
  | 'denial'
  | 'conflict'

export type SearchBarProps = {
  /** Serverseitige Suche; wird vom Writer mit einer Server-Action um searchTenant verdrahtet. */
  search: (query: string) => Promise<SearchTenantResult>
  /** Auswahl eines Treffers (Enter oder Klick). Navigation entscheidet der Einbettende. */
  onSelectHit?: (hit: SearchHit) => void
  placeholder?: string
  /** Entprellung der Eingabe in ms. */
  debounceMs?: number
}

const HIT_TYPE_LABEL: Record<SearchHit['type'], string> = {
  ORDER: 'Auftrag',
  CUSTOMER: 'Kunde',
}

function stateForResult(result: SearchTenantResult): {
  state: SearchBarState
  hits: SearchHit[]
  message: string
} {
  switch (result.code) {
    case 'OK':
      return result.hits.length > 0
        ? { state: 'data', hits: result.hits, message: '' }
        : { state: 'empty', hits: [], message: '' }
    case 'NOT_FOUND':
      return { state: 'empty', hits: [], message: '' }
    case 'UNAUTHENTICATED':
    case 'FORBIDDEN':
      return { state: 'denial', hits: [], message: result.message }
    case 'CONFLICT':
      return { state: 'conflict', hits: [], message: result.message }
    case 'VALIDATION_ERROR':
    case 'UNAVAILABLE':
      return { state: 'error', hits: [], message: result.message }
  }
}

export function SearchBar({
  search,
  onSelectHit,
  placeholder = 'Aufträge und Kunden durchsuchen …',
  debounceMs = 250,
}: SearchBarProps) {
  const listboxId = useId()
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchBarState>('idle')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [message, setMessage] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const requestSeq = useRef(0)
  const debounceHandle = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reset = useCallback(() => {
    requestSeq.current += 1
    setState('idle')
    setHits([])
    setMessage('')
    setActiveIndex(-1)
  }, [])

  const runSearch = useCallback(
    async (term: string) => {
      const seq = ++requestSeq.current
      setState('loading')
      setHits([])
      setMessage('')
      setActiveIndex(-1)
      try {
        const result = await search(term)
        if (seq !== requestSeq.current) return
        const next = stateForResult(result)
        setState(next.state)
        setHits(next.hits)
        setMessage(next.message)
        setActiveIndex(next.hits.length > 0 ? 0 : -1)
      } catch {
        if (seq !== requestSeq.current) return
        setState('error')
        setHits([])
        setMessage('Suche ist derzeit nicht verfügbar.')
        setActiveIndex(-1)
      }
    },
    [search],
  )

  const onQueryChange = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceHandle.current) clearTimeout(debounceHandle.current)
      if (value.trim().length === 0) {
        reset()
        return
      }
      debounceHandle.current = setTimeout(() => {
        void runSearch(value.trim())
      }, debounceMs)
    },
    [debounceMs, reset, runSearch],
  )

  useEffect(() => {
    return () => {
      if (debounceHandle.current) clearTimeout(debounceHandle.current)
    }
  }, [])

  const selectHit = useCallback(
    (hit: SearchHit) => {
      onSelectHit?.(hit)
    },
    [onSelectHit],
  )

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setQuery('')
        if (debounceHandle.current) clearTimeout(debounceHandle.current)
        reset()
        return
      }
      if (state !== 'data' || hits.length === 0) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((index) => (index + 1) % hits.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((index) => (index - 1 + hits.length) % hits.length)
        return
      }
      if (event.key === 'Enter' && activeIndex >= 0 && activeIndex < hits.length) {
        event.preventDefault()
        const hit = hits[activeIndex]
        if (hit) selectHit(hit)
      }
    },
    [activeIndex, hits, reset, selectHit, state],
  )

  const expanded = state === 'data'
  const activeHitId =
    expanded && activeIndex >= 0 ? `${listboxId}-hit-${activeIndex}` : undefined

  return (
    <div className="w-full max-w-xl" data-state={state} data-testid="search-bar">
      <input
        aria-activedescendant={activeHitId}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={expanded}
        aria-label="Suche"
        autoComplete="off"
        className="w-full rounded-xl border border-neutral-gray-100 bg-white px-4 py-2 text-sm text-navy-900 placeholder:text-navy-900/40 focus:outline-none focus:ring-2 focus:ring-navy-900/20"
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        role="combobox"
        type="search"
        value={query}
      />

      {state === 'loading' ? (
        <p aria-live="polite" className="mt-2 px-1 text-sm text-navy-900/60" role="status">
          Suche läuft …
        </p>
      ) : null}

      {state === 'empty' ? (
        <p aria-live="polite" className="mt-2 px-1 text-sm text-navy-900/60" role="status">
          Keine Treffer.
        </p>
      ) : null}

      {state === 'denial' ? (
        <div
          className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          <p className="font-semibold">Kein Zugriff</p>
          <p className="mt-1">{message || 'Suche erfordert eine gültige Anmeldung.'}</p>
        </div>
      ) : null}

      {state === 'conflict' ? (
        <div
          className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          <p className="font-semibold">Datenkonflikt</p>
          <p className="mt-1">{message || 'Bitte Suche erneut ausführen.'}</p>
        </div>
      ) : null}

      {state === 'error' ? (
        <div
          className="mt-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950"
          role="alert"
        >
          <p className="font-semibold">Suche nicht möglich</p>
          <p className="mt-1">{message || 'Suche ist derzeit nicht verfügbar.'}</p>
        </div>
      ) : null}

      <ul
        aria-label="Suchtreffer"
        className={
          expanded
            ? 'mt-2 max-h-80 divide-y divide-neutral-gray-100 overflow-y-auto rounded-xl border border-neutral-gray-100 bg-white shadow-lg'
            : 'hidden'
        }
        id={listboxId}
        role="listbox"
      >
        {expanded
          ? hits.map((hit, index) => (
              <li
                aria-selected={index === activeIndex}
                className={`cursor-pointer px-4 py-2 text-sm ${
                  index === activeIndex ? 'bg-navy-900/5' : 'bg-white'
                }`}
                id={`${listboxId}-hit-${index}`}
                key={`${hit.type}-${hit.id}`}
                onMouseDown={(event) => {
                  event.preventDefault()
                  selectHit(hit)
                }}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-medium text-navy-900">{hit.title}</span>
                  <span className="shrink-0 text-xs uppercase tracking-wide text-navy-900/50">
                    {HIT_TYPE_LABEL[hit.type]}
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-navy-900/60">
                  <span className="truncate">{hit.subtitle}</span>
                  <span className="shrink-0">{hit.status}</span>
                </div>
              </li>
            ))
          : null}
      </ul>
    </div>
  )
}
