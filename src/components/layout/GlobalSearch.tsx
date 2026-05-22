'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, Package, ChevronRight, X, Sparkles, LayoutGrid, Droplets, Activity } from 'lucide-react'
import { INITIAL_ORDERS, INITIAL_CUSTOMERS, MockOrder, MockCustomer } from '@/lib/mockData'

export function GlobalSearch({ open, onOpenChange }: { open: boolean, onOpenChange: (v: boolean) => void }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [orders, setOrders] = useState<MockOrder[]>(INITIAL_ORDERS)
  const [customers, setCustomers] = useState<MockCustomer[]>([])
  const [prevOpen, setPrevOpen] = useState(open)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (!open) {
      setSearchTerm('')
    }
  }

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

  // Load from localStorage on mount & when open triggers
  useEffect(() => {
    if (open && typeof window !== "undefined") {
      const savedOrders = localStorage.getItem("kreile_orders")
      const savedCustomers = localStorage.getItem("kreile_customers")
      
      // Delaying state update to next tick prevents synchronous cascading render warning
      setTimeout(() => {
        if (savedOrders) {
          try {
            setOrders(JSON.parse(savedOrders))
          } catch (e) {
            console.error("GlobalSearch: Error parsing orders", e)
          }
        }
        if (savedCustomers) {
          try {
            setCustomers(JSON.parse(savedCustomers))
          } catch (e) {
            console.error("GlobalSearch: Error parsing customers", e)
          }
        } else {
          setCustomers(INITIAL_CUSTOMERS as unknown as MockCustomer[])
        }
      }, 0)
    }
  }, [open])

  if (!open) return null

  const cleanTerm = searchTerm.trim().toLowerCase()

  // Filter logic
  const filteredOrders = cleanTerm
    ? orders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(cleanTerm) ||
          o.task.toLowerCase().includes(cleanTerm) ||
          o.customerName.toLowerCase().includes(cleanTerm)
      ).slice(0, 5)
    : []

  const filteredCustomers = cleanTerm
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(cleanTerm) ||
          (c.email && c.email.toLowerCase().includes(cleanTerm)) ||
          (c.phone && c.phone.toLowerCase().includes(cleanTerm))
      ).slice(0, 5)
    : []

  const hasResults = filteredOrders.length > 0 || filteredCustomers.length > 0

  const handleClose = () => onOpenChange(false)

  // Color mapping for customer initials avatar
  const getAvatarColor = (name: string) => {
    const sum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const colors = [
      "bg-blue-100 text-blue-800 border-blue-200",
      "bg-emerald-100 text-emerald-800 border-emerald-200",
      "bg-orange-100 text-orange-850 border-orange-200",
      "bg-purple-100 text-purple-800 border-purple-200",
      "bg-slate-100 text-slate-800 border-slate-200"
    ]
    return colors[sum % colors.length]
  }

  // Get initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  // Station Display formatting
  const getStationLabel = (key: string) => {
    const mapping: Record<string, string> = {
      wareneingang: "Wareneingang",
      entmetallisierung: "Entmetallisierung",
      schleiferei: "Schleiferei",
      beschichtung: "Beschichtung",
      warenausgang: "Warenausgang"
    }
    return mapping[key] || key
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-start justify-center pt-[15vh] px-4 font-sans text-slate-900"
      onClick={handleClose}
    >
      <div 
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[70vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Area */}
        <div className="flex items-center border-b border-slate-100 px-4 py-4 gap-3 bg-slate-50/50">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input 
            autoFocus
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent outline-none placeholder:text-slate-400 text-base font-medium" 
            placeholder="Nach Auftragsnummer, Kundenname, Telefon oder Aufgabe suchen..." 
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-650 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border border-slate-200 bg-white px-1.5 font-mono text-[9px] font-bold text-slate-400 shadow-xs">
            ESC
          </kbd>
        </div>

        {/* Scrollable Results & Recommendations Container */}
        <div className="overflow-y-auto flex-1 p-3 space-y-4">
          
          {/* Empty Search Term State: Display Quick Actions / Suggestions */}
          {!searchTerm && (
            <div className="space-y-4 py-2">
              <div className="px-2">
                <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-900" />
                  Schnellzugriff & Verknüpfungen
                </span>
                <p className="text-xs text-slate-500 mt-0.5">Navigiere direkt zu den wichtigsten Stationen und Bereichen.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-1">
                <Link 
                  href="/orders?station=wareneingang" 
                  onClick={handleClose}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 text-slate-700 hover:text-blue-900 font-semibold text-xs transition-all shadow-xs"
                >
                  <LayoutGrid className="w-4 h-4 text-blue-900 shrink-0" />
                  <div>
                    <span className="block">1. Wareneingang</span>
                    <span className="text-[10px] text-slate-450 font-normal">Aufträge erfassen & drucken</span>
                  </div>
                </Link>

                <Link 
                  href="/orders?station=beschichtung" 
                  onClick={handleClose}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 text-slate-700 hover:text-blue-900 font-semibold text-xs transition-all shadow-xs"
                >
                  <Droplets className="w-4 h-4 text-blue-950 shrink-0" />
                  <div>
                    <span className="block">4. Galvanik / Bäder</span>
                    <span className="text-[10px] text-slate-450 font-normal">Beschichtung & Badwerte</span>
                  </div>
                </Link>

                <Link 
                  href="/items" 
                  onClick={handleClose}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 text-slate-700 hover:text-blue-900 font-semibold text-xs transition-all shadow-xs"
                >
                  <Package className="w-4 h-4 text-slate-600 shrink-0" />
                  <div>
                    <span className="block">Lager & Badregelkarte</span>
                    <span className="text-[10px] text-slate-450 font-normal">Säuren, Kupfer & Anoden</span>
                  </div>
                </Link>

                <Link 
                  href="/performance" 
                  onClick={handleClose}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 text-slate-700 hover:text-blue-900 font-semibold text-xs transition-all shadow-xs"
                >
                  <Activity className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="block">Performance Cockpit</span>
                    <span className="text-[10px] text-slate-450 font-normal">Durchlaufzeit & Fehlerquoten</span>
                  </div>
                </Link>
              </div>

              <div className="text-center py-6 text-slate-400 text-xs font-semibold border-t border-slate-50 mt-4">
                Tippe ein Suchwort ein, um die Werkstatt live zu durchsuchen.
              </div>
            </div>
          )}

          {/* Search Term Inputted - Show Grouped Results */}
          {searchTerm && (
            <div className="space-y-4">
              
              {/* Group 1: Customers */}
              {filteredCustomers.length > 0 && (
                <div className="space-y-1.5">
                  <div className="px-2">
                    <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider">Kundenkartei ({filteredCustomers.length})</span>
                  </div>
                  <div className="space-y-1">
                    {filteredCustomers.map(c => (
                      <Link 
                        key={c.id} 
                        href={`/customers/${c.id}`}
                        onClick={handleClose}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 shadow-inner ${getAvatarColor(c.name)}`}>
                            {getInitials(c.name)}
                          </div>
                          <div>
                            <span className="font-extrabold text-sm text-slate-900 group-hover:text-blue-900 transition-colors block leading-tight">{c.name}</span>
                            <span className="text-xs text-slate-500 font-medium block mt-0.5">{c.city} • {c.email || c.phone || "Keine Kontaktdaten"}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Group 2: Orders */}
              {filteredOrders.length > 0 && (
                <div className="space-y-1.5">
                  <div className="px-2">
                    <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider">Auftragsbuch ({filteredOrders.length})</span>
                  </div>
                  <div className="space-y-1">
                    {filteredOrders.map(o => {
                      let riskBadgeColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
                      if (o.risk === "red" || o.risk === "orange") riskBadgeColor = "bg-red-100 text-red-800 border-red-200";
                      else if (o.risk === "yellow") riskBadgeColor = "bg-amber-100 text-amber-800 border-amber-200";
                      else if (o.risk === "blocked") riskBadgeColor = "bg-blue-100 text-blue-800 border-blue-200";

                      return (
                        <Link 
                          key={o.id} 
                          href={`/orders?station=${o.station}&order=${o.id}`}
                          onClick={handleClose}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-linear-to-br from-blue-50 to-blue-100 border border-blue-200/50 flex items-center justify-center text-blue-900 shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-xs text-blue-950 font-mono">{o.orderNumber}</span>
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border ${riskBadgeColor}`}>
                                  {getStationLabel(o.station)}
                                </span>
                              </div>
                              <span className="font-bold text-xs text-slate-800 group-hover:text-blue-900 transition-colors block mt-1 leading-tight max-w-[340px] truncate">
                                {o.task}
                              </span>
                              <span className="text-[10px] text-slate-500 font-semibold mt-0.5 block">{o.customerName}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* No results */}
              {!hasResults && (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <Package className="w-12 h-12 text-slate-200 mx-auto" />
                  <p className="font-extrabold text-sm text-slate-700">Keine Suchergebnisse gefunden</p>
                  <p className="text-xs text-slate-500 max-w-[280px] mx-auto">
                    Es gibt keine Kunden oder Aufträge, die mit dem Suchbegriff &bdquo;<span className="font-bold text-slate-700">{searchTerm}</span>&ldquo; übereinstimmen.
                  </p>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  )
}
