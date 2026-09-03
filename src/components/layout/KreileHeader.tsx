"use client";

import Link from "next/link";
import Image from "next/image";
import { Search, Camera, Calendar, Menu, Plus } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { useState, useEffect, useRef } from "react";
import { logout } from "@/app/actions/auth";
import { useRealtimeStatus } from "./RealtimeSyncManager";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { useSync } from "@/lib/offline/SyncContext";
import { useErfassung } from "@/components/erfassung/ErfassungProvider";
import { useRouter } from "next/navigation";

interface KreileHeaderProps {
  onMenuToggle: () => void;
}

export function KreileHeader({ onMenuToggle }: KreileHeaderProps) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const logoUrl = "/assets/logo/kreile-wordmark-skyline.svg";

  const { initials, status, name, hasPermission, loading: permissionsLoading } = usePermissions();
  // Fail-closed: ohne bestätigte Berechtigung bleiben die Auftragseinstiege verborgen.
  // Die serverseitigen Prüfungen bleiben unverändert massgeblich.
  const canCreateOrder = !permissionsLoading && hasPermission("perm_data_orders");
  const { status: realtimeStatus } = useRealtimeStatus();
  const { isOnline, outboxItems } = useSync();
  const { openErfassung } = useErfassung();
  const pendingOutboxCount = outboxItems.filter((item) => item.status !== "synced").length;

  // User Dropdown State
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close user dropdown
  useEffect(() => {
    if (!userDropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (userDropdownOpen && userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [userDropdownOpen]);

  const handleLogout = async () => {
    if (isLoggingOut) return; // Doppel-Aufruf verhindern
    setIsLoggingOut(true);
    setUserDropdownOpen(false);
    // Dev-Bypass-Cookie löschen: StartScreenClient.tsx schreibt ihn,
    // proxy.ts und roles.ts lesen ihn – konsistente Bereinigung erforderlich.
    // Sicherheitsauftrag: vollständige Migration auf kreile_app_session ist geplant.
    document.cookie = "bypass-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    await logout();
    router.replace("/start");
  };

  const today = new Date();
  const dateString = today.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

  // Der Dialog der globalen Suche liegt über der StationNav; der Header muss ihn tragen.
  const isAnyDropdownOpen = userDropdownOpen || searchOpen;

  return (
    <header className={`h-[72px] w-full max-w-full min-w-0 shrink-0 bg-transparent flex items-center px-2 sm:px-3 lg:px-5 gap-1 sm:gap-2 lg:gap-3 relative transition-all duration-300 ${isAnyDropdownOpen ? "z-[200]" : "z-[100]"}`}>
      {/* Hamburger Menu Mobile & Tablet (< 1280px) */}
      <button
        aria-label="Navigation öffnen"
        className="flex xl:hidden text-navy-900 hover:bg-neutral-gray-100 rounded-full w-12 h-12 min-w-[48px] min-h-[48px] items-center justify-center shrink-0"
        onClick={onMenuToggle}
        type="button"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* LEFT: GK Monogram + Brand */}
      <Link href="/" className="hidden md:flex items-center shrink-0 min-w-0 group">
        <Image
          src={logoUrl}
          alt="Firmenlogo"
          width={200}
          height={79}
          unoptimized
          className="h-8 lg:h-10 w-auto object-contain max-w-[132px] lg:max-w-[200px]"
        />
      </Link>

      {/* Mobile Logo — nur wenn neben den Aktionen Platz bleibt */}
      <Link href="/" className="hidden sm:flex md:hidden items-center shrink-0">
        <Image
          src={logoUrl}
          alt="Firmenlogo"
          width={140}
          height={55}
          unoptimized
          className="h-6 w-auto object-contain kreile-logo max-w-[104px]"
        />
      </Link>

      {/* CENTER: Suchleiste mit Skyline */}
      <div className="flex-1 min-w-0 max-w-2xl mx-auto hidden md:block relative">
        <div
          onClick={() => setSearchOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') setSearchOpen(true); }}
          className="w-full min-w-0 relative flex items-center bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl h-14 px-3 lg:px-5 gap-2 lg:gap-3 hover:bg-white hover:border-neutral-gray-200 hover:shadow-md transition-all duration-300 group shadow-sm cursor-text"
        >
          <Search className="w-5 h-5 text-navy-500 shrink-0 pointer-events-none" strokeWidth={1.5} />
          <span className="text-sm text-text-muted flex-1 min-w-0 truncate text-left pointer-events-none">
            Bei Auftrag, Kunde, Teilenummer suchen...
          </span>
          {/* Skyline decorative SVG in der Mitte */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 h-10 w-48 overflow-hidden opacity-12 pointer-events-none">
            <svg viewBox="0 0 160 30" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <polyline points="0,30 0,20 10,20 10,12 15,12 15,18 20,18 20,8 25,8 25,18 30,18 30,14 35,14 35,6 40,6 40,14 45,14 45,20 50,20 50,10 55,10 55,20 60,20 60,4 65,4 65,20 70,20 70,16 75,16 75,20 80,20 80,12 85,12 85,20 90,20 90,16 95,16 95,20 100,20 100,8 105,8 105,20 110,20 110,14 115,14 115,20 120,20 120,10 125,10 125,20 130,20 130,16 135,16 135,20 140,20 140,18 145,18 145,22 150,22 150,18 155,18 155,24 160,24 160,30" stroke="#B8923F" strokeWidth="1.5" fill="none"/>
            </svg>
          </div>
          {canCreateOrder && (
            <button
              aria-label="Schnellannahme (Scan)"
              onClick={(e) => {
                e.stopPropagation();
                openErfassung({ mode: "scan" });
              }}
              className="flex items-center justify-center w-12 h-12 min-w-[48px] min-h-[48px] shrink-0 hover:bg-neutral-gray-100 rounded-full transition-colors z-10"
              title="Schnellannahme (Scan)"
              type="button"
            >
              <Camera className="w-5 h-5 text-navy-500 shrink-0 group-hover:text-accent-orange transition-colors" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* RIGHT: Aktionen */}
      <div className="flex items-center gap-1 lg:gap-2 ml-auto shrink-0">

        {/* Mobile Suche */}
        <button
          aria-label="Globale Suche öffnen"
          onClick={() => setSearchOpen(true)}
          className="md:hidden w-12 h-12 min-w-[48px] min-h-[48px] shrink-0 rounded-full bg-white border border-neutral-gray-100 flex items-center justify-center text-navy-900"
          type="button"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Header Plus (Generic Erfassung) — nur mit Auftragsrecht */}
        {canCreateOrder && (
          <button
            aria-label="Neu anlegen"
            onClick={() => openErfassung({ mode: "gate" })}
            className="w-12 h-12 min-w-[48px] min-h-[48px] shrink-0 rounded-full bg-accent-orange text-white flex items-center justify-center hover:bg-accent-orange/90 transition-all shadow-sm"
            title="Neu anlegen"
            type="button"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}

        {/* Datum-Pill */}
        <Link href="/kalender" aria-label="Kalender öffnen" className="hidden xl:flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-white/60 rounded-full px-3 h-12 min-h-[48px] shrink-0 text-sm font-semibold text-navy-900 shadow-sm hover:bg-white hover:border-neutral-gray-200 transition-all duration-300">
          <Calendar className="w-4 h-4 text-text-muted" />
          <span>Heute · {dateString}</span>
          <span className="w-2 h-2 rounded-full bg-accent-orange animate-pulse" />
        </Link>

        {/* Lokales Gerätesignal; kein Nachweis einer Server-Synchronisierung */}
        <div
          aria-label="Netzwerkstatus"
          aria-live="polite"
          role="status"
          className={`hidden 2xl:flex items-center gap-2 rounded-full px-3 h-12 shrink-0 whitespace-nowrap text-sm font-bold border transition-all duration-300 shadow-sm hover:bg-white hover:border-neutral-gray-200 ${
            !isOnline || pendingOutboxCount > 0
              ? "bg-bg-app-soft/50 backdrop-blur-sm border-white/60 text-text-muted"
              : "bg-white/50 backdrop-blur-sm border-white/60 text-navy-900"
          }`}
          title="Gerätesignal: zeigt Netzwerkverfügbarkeit und lokal ausstehende Einträge; kein Server- oder Synchronisierungsnachweis."
        >
          <span className={`w-2 h-2 rounded-full ${!isOnline ? "bg-accent-orange" : (pendingOutboxCount > 0 ? "bg-gold-500 animate-pulse" : "bg-success-green")}`} />
          <span>{!isOnline ? "Offline" : (pendingOutboxCount > 0 ? `${pendingOutboxCount} lokal ausstehend` : "Netzwerk verfügbar")}</span>
        </div>

        {/* Live-Sync Indicator */}
        {realtimeStatus !== "disabled" && (
          <div className="hidden 2xl:flex items-center gap-1.5 px-3 h-12 shrink-0 whitespace-nowrap rounded-full bg-white/50 backdrop-blur-sm border border-white/60 shadow-sm text-xs font-bold text-navy-700 transition-all duration-300 hover:bg-white">
            {realtimeStatus === "active" ? (
              <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /><span>Echtzeit aktiv</span></>
            ) : realtimeStatus === "connecting" ? (
              <><span className="w-1.5 h-1.5 rounded-full bg-accent-orange animate-pulse" /><span>Echtzeit verbindet…</span></>
            ) : (
              <><span className="w-1.5 h-1.5 rounded-full bg-danger-red" /><span>Echtzeit getrennt</span></>
            )}
          </div>
        )}

        {/* Theme Switcher (Desktop & Mobile) */}
        <div className="shrink-0">
          <ThemeToggle />
        </div>

        {/* Profilbild rund (Kreis 48px) */}
        {status === "authenticated" && initials && (
          <div className="relative shrink-0" ref={userDropdownRef}>
            <button
              aria-label="Benutzermenü"
              aria-expanded={userDropdownOpen}
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-navy-700/90 backdrop-blur-sm border border-navy-500 hover:bg-navy-900 transition-all duration-300 text-white flex items-center justify-center text-sm font-black shrink-0 shadow-sm cursor-pointer"
              type="button"
            >
              {initials}
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 top-14 mt-2 w-48 bg-white border-2 border-neutral-gray-100 rounded-2xl shadow-xl z-50 p-2 animate-in slide-in-from-top-2 fade-in duration-200">
                <div className="px-3 py-2 border-b border-neutral-gray-100 mb-1">
                  <p className="text-xs font-bold text-navy-900">Angemeldet als</p>
                  <p className="text-[10px] text-text-muted">{name || initials}</p>
                </div>
              <Link
                href="/settings"
                onClick={() => setUserDropdownOpen(false)}
                className="flex items-center w-full min-h-[48px] text-left px-3 py-2 text-sm font-bold text-navy-900 hover:bg-neutral-gray-100 rounded-xl transition-colors cursor-pointer mb-1"
              >
                Einstellungen
              </Link>
              {/* Settings and other tabs are handled within /settings */}
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center w-full min-h-[48px] text-left px-3 py-2 text-sm font-bold text-danger-red hover:bg-danger-red/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingOut ? "Abmelden..." : "Abmelden"}
              </button>
            </div>
          )}
        </div>
        )}

      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
