'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Search, Package, ChevronRight, X, Sparkles, LayoutGrid, Droplets, Activity, FileText, Receipt, Truck, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { findActions, buildFallbackSuggestion } from '@/lib/search/fuzzy'
import { SEARCH_ACTIONS } from '@/lib/search/actionRegistry'
import { getRecentSearches, addRecentSearch } from '@/lib/search/recent'
import type { SearchSuggestion } from '@/types/search'
import { globalSearchAction } from '@/app/global-search-actions'
import { GlobalSearchAIResult } from './GlobalSearchAIResult'
import { useOrderModal } from "@/components/orders/OrderModalProvider";

export function GlobalSearch({ open, onOpenChange }: { open: boolean, onOpenChange: (v: boolean) => void }) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeAIQuery, setActiveAIQuery] = useState("");
  const { openOrder } = useOrderModal();
  const [globalResults, setGlobalResults] = useState<Record<string, any>[]>([]);
  const [prevOpen, setPrevOpen] = useState(open)
  const inputRef = useRef<HTMLInputElement>(null)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (!open) {
      setSearchTerm('')
    }
  }

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
      if (e.key === 'Escape' && open) {
        onOpenChange(false)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, onOpenChange])

  useEffect(() => {
    if (searchTerm.length > 2) {
      const timer = setTimeout(() => {
        globalSearchAction(searchTerm).then(res => setGlobalResults(res))
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setTimeout(() => setGlobalResults([]), 0)
    }
  }, [searchTerm])

  // Determine if we should show the AI Result component. 
  // We explicitly show AI mode if the user clicks the AI fallback suggestion or if they type a question format.
  const [forceAiMode, setForceAiMode] = useState(false);

  // Reset forceAiMode when searchTerm changes
  useEffect(() => {
    // Only reset if forceAiMode is true and it's not naturally aiMode
    const isNaturallyAiMode = /^(wie|was|wo|warum|welche|zeige|vergleiche|analysiere)/i.test(searchTerm.trim().toLowerCase()) || searchTerm.trim().toLowerCase().endsWith("?");
    if (forceAiMode && !isNaturallyAiMode) setForceAiMode(false);
  }, [searchTerm, forceAiMode]);

  if (!open) return null

  const cleanTerm = searchTerm.trim().toLowerCase()
  const isAiMode = forceAiMode || /^(wie|was|wo|warum|welche|zeige|vergleiche|analysiere)/i.test(cleanTerm) || cleanTerm.endsWith("?");

  const filteredOrders = globalResults.filter(r => r.type === 'order')
  const filteredCustomers = globalResults.filter(r => r.type === 'customer')
  const filteredBelege = globalResults.filter(r => r.type === 'beleg')
  const filteredRechnungen = globalResults.filter(r => r.type === 'rechnung')
  const filteredLieferanten = globalResults.filter(r => r.type === 'lieferant')
  const filteredBaeder = globalResults.filter(r => r.type === 'bad')
  const filteredLager = globalResults.filter(r => r.type === 'lager')
  const filteredKosten = globalResults.filter(r => r.type === 'kostenposten')

  const hasResults = globalResults.length > 0

  // Intent-based action suggestions (shown above entity results)
  const actionSuggestions: SearchSuggestion[] = cleanTerm
    ? findActions(cleanTerm, SEARCH_ACTIONS)
    : []

  const hasAnyResults = hasResults || actionSuggestions.length > 0

  // Fallback
  const fallbackSuggestions: SearchSuggestion[] = cleanTerm && !hasAnyResults
    ? buildFallbackSuggestion(cleanTerm)
    : []

  const handleClose = () => {
    if (searchTerm.trim().length > 1) addRecentSearch(searchTerm.trim())
    onOpenChange(false)
  }
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim().length > 0) {
      router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`)
      handleClose()
    }
  }

  const handleSuggestionClick = (route: string) => {
    if (route.startsWith('?ai_search=')) {
      setForceAiMode(true);
    } else {
      router.push(route);
      handleClose();
    }
  };

  const getAvatarColor = (name: string) => {
    if (!name) return "bg-neutral-gray-100 text-navy-900 border-neutral-gray-100"
    const sum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const colors = [
      "bg-navy-700 text-navy-700 border-navy-700",
      "bg-success-green text-success-green border-success-green",
      "bg-orange-100 text-accent-orange border-accent-orange",
      "bg-purple-100 text-purple-800 border-purple-200",
      "bg-neutral-gray-100 text-navy-900 border-neutral-gray-100"
    ]
    return colors[sum % colors.length]
  }

  const getInitials = (name: string) => {
    if (!name) return "??"
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  }

  return (
    <div 
      className="fixed inset-0 z-200 bg-navy-900/40 backdrop-blur-xs flex items-start justify-center pt-[15vh] px-4 font-sans text-navy-900"
      onClick={handleClose}
    >
      <div 
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-neutral-gray-100 flex flex-col max-h-[70vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-neutral-gray-100 px-4 py-4 gap-3 bg-bg-app-soft/50">
          <Search className="w-5 h-5 text-text-muted shrink-0" />
          <input 
            ref={inputRef}
            autoFocus
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none placeholder:text-text-muted text-base font-medium" 
            placeholder="Nach Aufträgen, Kunden, Belegen, Rechnungen..." 
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="p-1 hover:bg-neutral-gray-100 rounded-lg text-text-muted hover:text-slate-650 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border border-neutral-gray-100 bg-white px-1.5 font-mono text-[9px] font-bold text-text-muted shadow-xs">
            ESC
          </kbd>
        </div>

        <div className="overflow-y-auto flex-1 p-3 space-y-4">
          
          {isAiMode && searchTerm.length > 2 ? (
            <GlobalSearchAIResult query={searchTerm} onClose={handleClose} />
          ) : (
            <>
              {!searchTerm && (
                <div className="space-y-4 py-2">
              <div className="px-2">
                <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-navy-900" />
                  Schnellzugriff und Verknüpfungen
                </span>
                <p className="text-xs text-navy-500 mt-0.5">Navigiere direkt zu den wichtigsten Stationen und Bereichen.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-1">
                <Link 
                  href="/orders?station=wareneingang" 
                  onClick={handleClose}
                  className="flex items-center gap-3 p-3 rounded-xl border border-neutral-gray-100 hover:border-navy-700 hover:bg-gold-100/20 text-navy-900 hover:text-navy-900 font-semibold text-xs transition-all shadow-xs"
                >
                  <LayoutGrid className="w-4 h-4 text-navy-900 shrink-0" />
                  <div>
                    <span className="block">1. Wareneingang</span>
                    <span className="text-[10px] text-slate-450 font-normal">Aufträge erfassen und drucken</span>
                  </div>
                </Link>

                <Link 
                  href="/orders?station=beschichtung" 
                  onClick={handleClose}
                  className="flex items-center gap-3 p-3 rounded-xl border border-neutral-gray-100 hover:border-navy-700 hover:bg-gold-100/20 text-navy-900 hover:text-navy-900 font-semibold text-xs transition-all shadow-xs"
                >
                  <Droplets className="w-4 h-4 text-navy-700 shrink-0" />
                  <div>
                    <span className="block">4. Galvanik / Beschichtung</span>
                    <span className="text-[10px] text-slate-450 font-normal">Beschichtung und Badwerte</span>
                  </div>
                </Link>

                <Link 
                  href="/items" 
                  onClick={handleClose}
                  className="flex items-center gap-3 p-3 rounded-xl border border-neutral-gray-100 hover:border-navy-700 hover:bg-gold-100/20 text-navy-900 hover:text-navy-900 font-semibold text-xs transition-all shadow-xs"
                >
                  <Package className="w-4 h-4 text-text-muted shrink-0" />
                  <div>
                    <span className="block">Lager und Badregelkarte</span>
                    <span className="text-[10px] text-slate-450 font-normal">Säuren, Kupfer und Anoden</span>
                  </div>
                </Link>

                <Link 
                  href="/performance" 
                  onClick={handleClose}
                  className="flex items-center gap-3 p-3 rounded-xl border border-neutral-gray-100 hover:border-navy-700 hover:bg-gold-100/20 text-navy-900 hover:text-navy-900 font-semibold text-xs transition-all shadow-xs"
                >
                  <Activity className="w-4 h-4 text-success-green shrink-0" />
                  <div>
                    <span className="block">Performance Cockpit</span>
                    <span className="text-[10px] text-slate-450 font-normal">Durchlaufzeit und Fehlerquoten</span>
                  </div>
                </Link>
              </div>

              <div className="text-center py-6 text-text-muted text-xs font-semibold border-t border-bg-app-soft mt-4">
                Tippe ein Suchwort ein, um die Werkstatt live zu durchsuchen.
              </div>
            </div>
          )}

          {searchTerm && (
            <div className="space-y-4">

              {actionSuggestions.length > 0 && (
                <div className="space-y-1.5">
                  <div className="px-2">
                    <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider">Aktionen</span>
                  </div>
                  <div className="space-y-1">
                    {actionSuggestions.map((s) => (
                      <button
                        key={s.routeOnSelect}
                        onClick={() => { router.push(s.routeOnSelect); handleClose(); }}
                        className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-gold-100 transition-colors border border-transparent hover:border-navy-700 group text-left"
                      >
                        <div>
                          <span className="font-bold text-sm text-navy-900 block">{s.label}</span>
                          {s.secondary && <span className="text-xs text-navy-500">{s.secondary}</span>}
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted group-hover:translate-x-0.5 transition-transform shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {filteredBelege.length > 0 && (
                <div className="space-y-1.5">
                  <div className="px-2">
                    <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider">📄 Belege ({filteredBelege.length} Treffer)</span>
                  </div>
                  <div className="space-y-1">
                    {filteredBelege.map(b => (
                      <Link 
                        key={b.id} 
                        href={`/buchhaltung/belege/${b.id}`}
                        onClick={handleClose}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-bg-app-soft transition-colors border border-transparent hover:border-neutral-gray-100 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-amber-50 to-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-extrabold text-sm text-navy-900 block leading-tight">{b.title || "Unbekannter Lieferant"}</span>
                            <span className="text-xs text-navy-500 font-medium block mt-0.5 max-w-[340px] truncate">{b.subtitle}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {filteredOrders.length > 0 && (
                <div className="space-y-1.5">
                  <div className="px-2">
                    <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider">📦 Aufträge ({filteredOrders.length} Treffer)</span>
                  </div>
                  <div className="space-y-1">
                    {filteredOrders.map(o => (
                      <button 
                        key={o.id} 
                        onClick={() => { handleClose(); openOrder(o.id); }}
                        className="w-full text-left flex items-center justify-between p-2.5 rounded-xl hover:bg-bg-app-soft transition-colors border border-transparent hover:border-neutral-gray-100 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-blue-50 to-blue-100 border border-navy-700/50 flex items-center justify-center text-navy-900 shrink-0">
                            <Package className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-extrabold text-sm text-navy-900 block mt-1 leading-tight max-w-[340px] truncate">{o.title}</span>
                            <span className="text-[10px] text-navy-500 font-semibold mt-0.5 block">{o.subtitle}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filteredCustomers.length > 0 && (
                <div className="space-y-1.5">
                  <div className="px-2">
                    <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider">👤 Kunden ({filteredCustomers.length} Treffer)</span>
                  </div>
                  <div className="space-y-1">
                    {filteredCustomers.map(c => (
                      <Link 
                        key={c.id} 
                        href={`/customers/${c.id}`}
                        onClick={handleClose}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-bg-app-soft transition-colors border border-transparent hover:border-neutral-gray-100 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 shadow-inner ${getAvatarColor(c.title)}`}>
                            {getInitials(c.title)}
                          </div>
                          <div>
                            <span className="font-extrabold text-sm text-navy-900 block leading-tight">{c.title}</span>
                            <span className="text-xs text-navy-500 font-medium block mt-0.5">{c.subtitle}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {filteredRechnungen.length > 0 && (
                <div className="space-y-1.5">
                  <div className="px-2">
                    <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider">🧾 Rechnungen ({filteredRechnungen.length} Treffer)</span>
                  </div>
                  <div className="space-y-1">
                    {filteredRechnungen.map(r => (
                      <Link 
                        key={r.id} 
                        href={`/buchhaltung/rechnungen/${r.id}`}
                        onClick={handleClose}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-bg-app-soft transition-colors border border-transparent hover:border-neutral-gray-100 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-green-50 to-green-100 border border-green-200 flex items-center justify-center text-green-700 shrink-0">
                            <Receipt className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-extrabold text-sm text-navy-900 block leading-tight">{r.title}</span>
                            <span className="text-xs text-navy-500 font-medium block mt-0.5">{r.subtitle}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {filteredLieferanten.length > 0 && (
                <div className="space-y-1.5">
                  <div className="px-2">
                    <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider">🚚 Lieferanten ({filteredLieferanten.length} Treffer)</span>
                  </div>
                  <div className="space-y-1">
                    {filteredLieferanten.map(l => (
                      <Link 
                        key={l.id} 
                        href={`/lieferanten/${l.id}`}
                        onClick={handleClose}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-bg-app-soft transition-colors border border-transparent hover:border-neutral-gray-100 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-purple-50 to-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
                            <Truck className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-extrabold text-sm text-navy-900 block leading-tight">{l.title}</span>
                            <span className="text-xs text-navy-500 font-medium block mt-0.5">{l.subtitle}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {filteredBaeder.length > 0 && (
                <div className="space-y-1.5">
                  <div className="px-2">
                    <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider">🧪 Bäder ({filteredBaeder.length} Treffer)</span>
                  </div>
                  <div className="space-y-1">
                    {filteredBaeder.map(b => (
                      <Link 
                        key={b.id} 
                        href={`/baths/${b.id}`}
                        onClick={handleClose}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-bg-app-soft transition-colors border border-transparent hover:border-neutral-gray-100 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-cyan-50 to-cyan-100 border border-cyan-200 flex items-center justify-center text-cyan-700 shrink-0">
                            <Droplets className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-extrabold text-sm text-navy-900 block leading-tight">{b.title}</span>
                            <span className="text-xs text-navy-500 font-medium block mt-0.5">{b.subtitle}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {filteredLager.length > 0 && (
                <div className="space-y-1.5">
                  <div className="px-2">
                    <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider">📦 Lager ({filteredLager.length} Treffer)</span>
                  </div>
                  <div className="space-y-1">
                    {filteredLager.map(l => (
                      <Link 
                        key={l.id} 
                        href={`/inventory/${l.id}`}
                        onClick={handleClose}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-bg-app-soft transition-colors border border-transparent hover:border-neutral-gray-100 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-yellow-50 to-yellow-100 border border-yellow-200 flex items-center justify-center text-yellow-700 shrink-0">
                            <Package className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-extrabold text-sm text-navy-900 block leading-tight">{l.title}</span>
                            <span className="text-xs text-navy-500 font-medium block mt-0.5">{l.subtitle}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {filteredKosten.length > 0 && (
                <div className="space-y-1.5">
                  <div className="px-2">
                    <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider">💶 Kostenposten ({filteredKosten.length} Treffer)</span>
                  </div>
                  <div className="space-y-1">
                    {filteredKosten.map(k => (
                      <Link 
                        key={k.id} 
                        href={`/buchhaltung/kosten/${k.id}`}
                        onClick={handleClose}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-bg-app-soft transition-colors border border-transparent hover:border-neutral-gray-100 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-red-50 to-red-100 border border-red-200 flex items-center justify-center text-red-700 shrink-0">
                            <Receipt className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-extrabold text-sm text-navy-900 block leading-tight">{k.title}</span>
                            <span className="text-xs text-navy-500 font-medium block mt-0.5">{k.subtitle}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {!hasAnyResults && fallbackSuggestions.length > 0 && (
                <div className="space-y-1.5">
                  <div className="px-2">
                    <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider">Vorschläge</span>
                  </div>
                  {fallbackSuggestions.map((s) => (
                    <button
                      key={s.routeOnSelect}
                      onClick={() => handleSuggestionClick(s.routeOnSelect)}
                      className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-bg-app-soft transition-colors border border-neutral-gray-100 group text-left"
                    >
                      <div>
                        <span className="font-bold text-sm text-navy-900">{s.label}</span>
                        {s.secondary && <span className="block text-xs text-navy-500 mt-0.5">{s.secondary}</span>}
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                  ))}
                </div>
              )}

            </div>
          )}
          </>
          )}

        </div>
      </div>
    </div>
  )
}
