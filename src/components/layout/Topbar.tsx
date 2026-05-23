"use client";

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, User, Package, Calendar } from 'lucide-react'
import { GlobalSearch } from './GlobalSearch'
import { useState, useEffect } from 'react'
import { inventoryRepository } from '@/lib/repositories/inventoryRepository'
import { bathsRepository } from '@/lib/repositories/bathsRepository'
import { OfflineManager } from '@/lib/offline/OfflineManager'
import { StationStatusButton } from '@/components/ui/StationStatusButton'

const STATIONS = [
  { name: 'Wareneingang', path: '/station/wareneingang' }, // Pfad zum Station-Queue
  { name: 'Entmetallisierung', path: '/station/entmetallisierung' },
  { name: 'Schleiferei', path: '/station/schleiferei' },
  { name: 'Beschichtung', path: '/station/beschichtung' },
  { name: 'Warenausgang', path: '/station/warenausgang' },
]

export function Topbar() {
  const pathname = usePathname()
  const [searchOpen, setSearchOpen] = useState(false)
  const [criticalStock, setCriticalStock] = useState(false)
  const [criticalBath, setCriticalBath] = useState(false)
  const [searchParams, setSearchParams] = useState<URLSearchParams | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSearchParams(new URLSearchParams(window.location.search))
    }
  }, [pathname])

  // Offline / PWA States
  const [isOffline, setIsOffline] = useState(false)
  const [syncQueueCount, setSyncQueueCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncSuccessToast, setSyncSuccessToast] = useState<string | null>(null)

  // Datum formatieren für "Heute" Button
  const today = new Date()
  const dateString = today.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })

  useEffect(() => {
    const checkStatus = async () => {
      const hasCritStock = await inventoryRepository.hasCriticalStock();
      const hasCritBath = await bathsRepository.hasCriticalBath();
      setCriticalStock(hasCritStock);
      setCriticalBath(hasCritBath);
    };
    checkStatus();

    // Offline / PWA reactive listener
    const updateOfflineState = async () => {
      setIsOffline(OfflineManager.isOffline());
      const count = await OfflineManager.getPendingCount();
      setSyncQueueCount(count);
    };
    updateOfflineState();

    const handleSyncSuccess = (event: Event) => {
      const customEvent = event as CustomEvent;
      const count = customEvent.detail?.count || 0;
      setSyncSuccessToast(`Erfolgreich synchronisiert! ${count} Aktion(en) synchron.`);
      setTimeout(() => setSyncSuccessToast(null), 4000);
    };

    window.addEventListener("storage", checkStatus);
    window.addEventListener("storage", updateOfflineState);
    window.addEventListener("kreile-network-change", updateOfflineState);
    window.addEventListener("kreile-sync-queue-updated", updateOfflineState);
    window.addEventListener("online", updateOfflineState);
    window.addEventListener("offline", updateOfflineState);
    window.addEventListener("kreile-sync-success", handleSyncSuccess);

    return () => {
      window.removeEventListener("storage", checkStatus);
      window.removeEventListener("storage", updateOfflineState);
      window.removeEventListener("kreile-network-change", updateOfflineState);
      window.removeEventListener("kreile-sync-queue-updated", updateOfflineState);
      window.removeEventListener("online", updateOfflineState);
      window.removeEventListener("offline", updateOfflineState);
      window.removeEventListener("kreile-sync-success", handleSyncSuccess);
    };
  }, []);

  // Click outside to close simulated network dropdown
  useEffect(() => {
    if (!showDropdown) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".offline-widget-container")) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showDropdown]);

  return (
    <header className="h-16 shrink-0 border-b border-slate-200 bg-white px-4 md:px-6 flex items-center justify-between z-10 shadow-sm relative">
      
      {/* Left: Logo */}
      <div className="flex items-center w-48 md:w-64 shrink-0">
        <Link href="/" className="font-bold text-2xl tracking-tight text-blue-900">
          KREILE
        </Link>
      </div>

      {/* Center: Workshop Flow */}
        <nav className="hidden lg:flex flex-1 items-center justify-center px-4">
          <div className="flex items-center bg-slate-900/80 p-2 rounded-2xl border border-slate-700/80 shadow-inner">
            {STATIONS.map((station, i) => {
              const isWareneingangActive = station.name === 'Wareneingang' && (
                pathname === '/orders/new' || 
                (searchParams?.get('station') === 'wareneingang')
              );
              const isActive = pathname === station.path || 
                               (station.path !== '/' && pathname.startsWith(station.path)) ||
                               isWareneingangActive;
              const isBeschichtung = station.name === 'Beschichtung';
              const hasAlert = isBeschichtung && criticalBath;

              return (
                <div key={station.path} className="flex items-center">
                  <StationStatusButton
                    name={station.name}
                    path={station.path}
                    index={i}
                    isActive={isActive}
                    hasAlert={hasAlert}
                    title={station.name === 'Beschichtung' ? 'Beschichtung (Galvanik)' : undefined}
                  />
                  {i < STATIONS.length - 1 && (
                    <div className="px-2 text-slate-600">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m9 18 6-6-6-6"/>
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        <Link 
          href="/items" 
          className={`hidden lg:flex items-center gap-2 text-sm font-medium hover:bg-slate-100 px-3 py-2 rounded-md transition-colors border ${
            criticalStock 
              ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 animate-pulse' 
              : 'text-slate-600 border-transparent font-medium'
          }`}
        >
          <Package className="w-4.5 h-4.5" />
          <span className="hidden xl:inline">Lager</span>
          <span className={`flex h-2 w-2 rounded-full ${criticalStock ? 'bg-red-650 animate-pulse' : 'bg-green-500'}`}></span>
        </Link>

        <Link href="/" className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-2 rounded-md transition-colors border border-slate-200">
          <Calendar className="w-4 h-4" />
          <span>Heute · {dateString}</span>
          <span className="flex h-2 w-2 rounded-full bg-orange-500"></span>
        </Link>

        {/* Offline & Sync Widget Dropdown Container */}
        <div className="relative offline-widget-container">
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            className={`flex items-center gap-2 text-xs font-black px-3.5 py-2.5 rounded-xl transition-all border cursor-pointer active:scale-95 ${
              isOffline 
                ? "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100" 
                : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isOffline ? "bg-amber-500 animate-pulse" : "bg-emerald-550 animate-pulse"}`}></span>
            <span className="hidden sm:inline">{isOffline ? "Offline" : "Online"}</span>
            {syncQueueCount > 0 && (
              <span className="flex items-center gap-0.5 bg-amber-500 text-white text-[9px] font-black py-0.5 px-1.5 rounded-full animate-bounce shrink-0">
                🔄 {syncQueueCount}
              </span>
            )}
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-12 mt-2 w-72 bg-white border-2 border-slate-200 rounded-2xl shadow-xl z-50 p-4 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Verbindungsstatus</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${isOffline ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-850"}`}>
                    {isOffline ? "Offline (Simuliert)" : "Online"}
                  </span>
                </div>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  Schalte das Netzwerk ab, um Offline-Materialbuchungen und Statusänderungen zu erproben.
                </p>
                <button
                  onClick={() => {
                    OfflineManager.toggleSimulatedOffline();
                    setShowDropdown(false);
                  }}
                  className={`w-full py-2.5 rounded-xl font-extrabold text-xs transition-all active:scale-95 cursor-pointer ${
                    isOffline 
                      ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-250 shadow-[0_4px_12px]"
                      : "bg-amber-600 text-white hover:bg-amber-700 shadow-amber-250 shadow-[0_4px_12px]"
                  }`}
                >
                  {isOffline ? "Verbindung herstellen" : "Verbindung trennen"}
                </button>
              </div>

              {syncQueueCount > 0 && (
                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between items-center text-xs font-black">
                    <span className="text-slate-500">Warteschlange:</span>
                    <span className="text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-100">{syncQueueCount} Aktionen</span>
                  </div>
                  <p className="text-slate-400 text-[10px] leading-relaxed">
                    Daten werden in IndexedDB gepuffert und bei Verbindungswiederkehr automatisch übertragen.
                  </p>
                  <button
                    onClick={async () => {
                      if (isOffline) return;
                      setIsSyncing(true);
                      await OfflineManager.syncQueue();
                      setIsSyncing(false);
                      setShowDropdown(false);
                    }}
                    disabled={isOffline || isSyncing}
                    className={`w-full py-2.5 bg-slate-900 text-white rounded-xl font-black text-xs hover:bg-slate-800 transition-all active:scale-95 cursor-pointer shadow-slate-200 shadow-[0_4px_12px] flex items-center justify-center gap-2 ${
                      (isOffline || isSyncing) ? "opacity-40 cursor-not-allowed" : ""
                    }`}
                  >
                    <span>{isSyncing ? "Synchronisiere..." : "Jetzt synchronisieren"}</span>
                    <span className={`text-xs ${isSyncing ? "animate-spin" : ""}`}>🔄</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button 
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-md transition-colors"
        >
          <Search className="w-4 h-4" />
          <span className="hidden md:inline">Suche...</span>
          <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border border-slate-300 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-500">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>

        <button className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-300 transition-colors">
          <User className="w-4 h-4" />
        </button>
      </div>

      {/* Sync Success Toast Banner */}
      {syncSuccessToast && (
        <div className="absolute top-18 right-6 bg-emerald-50 text-emerald-800 border-2 border-emerald-200 py-3 px-5 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-lg animate-in slide-in-from-top-4 duration-300 z-50">
          <span className="h-2 w-2 rounded-full bg-emerald-550 animate-ping"></span>
          {syncSuccessToast}
        </div>
      )}

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  )
}

