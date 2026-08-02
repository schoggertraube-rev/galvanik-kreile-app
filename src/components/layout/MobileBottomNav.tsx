"use client";

import { Home, PackageCheck, Scan, Search, Menu, Users, ClipboardList, TrendingUp, Settings, MessageSquare, ShieldCheck, Lightbulb, HeartHandshake, Beaker, Warehouse, Database } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { usePermissions } from "@/lib/auth/PermissionsContext";

export function MobileBottomNav({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { hasPermission } = usePermissions();
  const canManageUsers = hasPermission("perm_sys_users");

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");

  return (
    <>
      <nav className={`bg-white border-t border-neutral-gray-100 flex items-center justify-around h-[64px] shrink-0 pb-(--safe-area-bottom) ${className}`}>
        
        <Link href="/" className={`flex flex-col items-center justify-center flex-1 h-full gap-1 ${isActive("/") ? "text-navy-900" : "text-text-muted"}`}>
          <div className="relative h-12 w-12 shrink-0 flex items-center justify-center">
            <Home className="w-6 h-6" strokeWidth={isActive("/") ? 2 : 1.5} />
          </div>
          <span className="text-[10px] font-bold">Heute</span>
        </Link>
        
        <Link href="/warendurchlauf" className={`flex flex-col items-center justify-center flex-1 h-full gap-1 ${isActive("/warendurchlauf") ? "text-navy-900" : "text-text-muted"}`}>
          <div className="relative h-12 w-12 shrink-0 flex items-center justify-center">
            <PackageCheck className="w-6 h-6" strokeWidth={isActive("/warendurchlauf") ? 2 : 1.5} />
          </div>
          <span className="text-[10px] font-bold">Durchlauf</span>
        </Link>

        {/* Kommunikation Prominent */}
        <div className="flex-1 flex justify-center -mt-6">
          <Link href="/kommunikation" className="w-14 h-14 rounded-full bg-navy-900 text-white shadow-elevated flex items-center justify-center hover:scale-105 transition-transform active:scale-95">
            <MessageSquare className="w-6 h-6" />
          </Link>
        </div>

        <Link href="/orders" className={`flex flex-col items-center justify-center flex-1 h-full gap-1 ${isActive("/orders") ? "text-navy-900" : "text-text-muted"}`}>
          <div className="relative h-12 w-12 shrink-0 flex items-center justify-center">
            <ClipboardList className="w-6 h-6" strokeWidth={isActive("/orders") ? 2 : 1.5} />
          </div>
          <span className="text-[10px] font-bold">Aufträge</span>
        </Link>

        <button 
          onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-1 ${moreOpen ? "text-navy-900" : "text-text-muted"}`}
        >
          <div className="relative h-12 w-12 shrink-0 flex items-center justify-center">
            <Menu className="w-6 h-6" strokeWidth={moreOpen ? 2 : 1.5} />
          </div>
          <span className="text-[10px] font-bold">Mehr</span>
        </button>
      </nav>

      {/* More Menu Bottom Sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-navy-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setMoreOpen(false)}>
          <div className="bg-white w-full rounded-t-3xl p-6 pb-[calc(1.5rem+var(--safe-area-bottom))] animate-in slide-in-from-bottom-full duration-300 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-neutral-gray-200 rounded-full mx-auto mb-6" />
            
            <div className="flex flex-col gap-6 overflow-y-auto max-h-[70vh] pb-8 scrollbar-hide">
              
              <div>
                <h3 className="text-xs font-bold text-neutral-gray-400 mb-3 px-2 uppercase tracking-wider">Kunden und Aufträge</h3>
                <div className="grid grid-cols-4 gap-y-4 gap-x-2">
                  <SheetLink href="/orders" icon={<ClipboardList />} label="Aufträge" onClick={() => setMoreOpen(false)} />
                  <SheetLink href="/customers" icon={<Users />} label="Kunden" onClick={() => setMoreOpen(false)} />
                  <SheetLink href="/quotes" icon={<MessageSquare />} label="Angebote" onClick={() => setMoreOpen(false)} />
                  <button onClick={() => { window.dispatchEvent(new Event('kreile-open-search')); setMoreOpen(false); }} className="flex flex-col items-center gap-2 group">
                    <div className="w-12 h-12 rounded-2xl bg-bg-app-soft flex items-center justify-center text-navy-700 group-hover:bg-neutral-gray-100 transition-colors">
                      <Search />
                    </div>
                    <span className="text-[10px] font-bold text-navy-900 text-center">Suche</span>
                  </button>
                </div>
              </div>
              
              <div>
                <h3 className="text-xs font-bold text-neutral-gray-400 mb-3 px-2 uppercase tracking-wider">Betrieb</h3>
                <div className="grid grid-cols-4 gap-y-4 gap-x-2">
                  <SheetLink href="/kontrolle" icon={<ShieldCheck />} label="Kontrolle" onClick={() => setMoreOpen(false)} />
                  <SheetLink href="/kommunikation" icon={<MessageSquare />} label="Messenger" onClick={() => setMoreOpen(false)} />
                  <SheetLink href="/kundenservice" icon={<HeartHandshake />} label="Service" onClick={() => setMoreOpen(false)} />
                  <SheetLink href="/betrieb-kvp" icon={<Lightbulb />} label="KVP" onClick={() => setMoreOpen(false)} />
                  <SheetLink href="/baeder" icon={<Beaker />} label="Bäder" onClick={() => setMoreOpen(false)} />
                  <SheetLink href="/items" icon={<Warehouse />} label="Lager" onClick={() => setMoreOpen(false)} />
                  <SheetLink href="/scan" icon={<Scan />} label="Scan" onClick={() => setMoreOpen(false)} />
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-neutral-gray-400 mb-3 px-2 uppercase tracking-wider">Analyse</h3>
                <div className="grid grid-cols-4 gap-y-4 gap-x-2">
                  <SheetLink href="/performance" icon={<TrendingUp />} label="Metriken" onClick={() => setMoreOpen(false)} />
                </div>
              </div>

              {canManageUsers && (
                <div>
                  <h3 className="text-xs font-bold text-neutral-gray-400 mb-3 px-2 uppercase tracking-wider">Verwaltung</h3>
                  <div className="grid grid-cols-4 gap-y-4 gap-x-2">
                    <SheetLink href="/finanzen" icon={<Settings />} label="Finanzen" onClick={() => setMoreOpen(false)} />
                    <SheetLink href="/admin/import" icon={<Database />} label="Import" onClick={() => setMoreOpen(false)} />
                    <SheetLink href="/admin/devices" icon={<ShieldCheck />} label="Geräte" onClick={() => setMoreOpen(false)} />
                    <SheetLink href="/settings" icon={<Settings />} label="Setup" onClick={() => setMoreOpen(false)} />
                    <SheetLink href="/kvp" icon={<Lightbulb />} label="App-KVP" onClick={() => setMoreOpen(false)} />
                    <SheetLink href="/admin/analytics" icon={<TrendingUp />} label="Dev Data" onClick={() => setMoreOpen(false)} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SheetLink({ href, icon, label, onClick }: { href: string; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex flex-col items-center gap-2 group">
      <div className="w-12 h-12 rounded-2xl bg-bg-app-soft flex items-center justify-center text-navy-700 group-hover:bg-neutral-gray-100 transition-colors">
        {icon}
      </div>
      <span className="text-[10px] font-bold text-navy-900 text-center">{label}</span>
    </Link>
  );
}
