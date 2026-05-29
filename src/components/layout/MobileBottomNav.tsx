"use client";

import { Home, PackageCheck, Scan, Search, Menu, Users, ClipboardList, TrendingUp, Settings, MessageSquare, ShieldCheck, Factory } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { trackUiEvent } from "@/lib/tracking/tracking";

export function MobileBottomNav({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");

  return (
    <>
      <nav className={`bg-white border-t border-neutral-gray-100 flex items-center justify-around h-[64px] shrink-0 pb-[var(--safe-area-bottom)] ${className}`}>
        
        <Link href="/" className={`flex flex-col items-center justify-center flex-1 h-full gap-1 ${isActive("/") ? "text-navy-900" : "text-text-muted"}`}>
          <Home className="w-6 h-6" strokeWidth={isActive("/") ? 2 : 1.5} />
          <span className="text-[10px] font-bold">Heute</span>
        </Link>
        
        <Link href="/warendurchlauf" className={`flex flex-col items-center justify-center flex-1 h-full gap-1 ${isActive("/warendurchlauf") ? "text-navy-900" : "text-text-muted"}`}>
          <PackageCheck className="w-6 h-6" strokeWidth={isActive("/warendurchlauf") ? 2 : 1.5} />
          <span className="text-[10px] font-bold">Durchlauf</span>
        </Link>

        {/* Scan Button Prominent */}
        <div className="flex-1 flex justify-center -mt-6">
          <Link href="/scan" className="w-14 h-14 rounded-full bg-navy-900 text-white shadow-elevated flex items-center justify-center hover:scale-105 transition-transform active:scale-95">
            <Scan className="w-6 h-6" />
          </Link>
        </div>

        <button 
          onClick={() => window.dispatchEvent(new Event('kreile-open-search'))}
          className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-text-muted hover:text-navy-900"
        >
          <Search className="w-6 h-6" strokeWidth={1.5} />
          <span className="text-[10px] font-bold">Suche</span>
        </button>

        <button 
          onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-1 ${moreOpen ? "text-navy-900" : "text-text-muted"}`}
        >
          <Menu className="w-6 h-6" strokeWidth={moreOpen ? 2 : 1.5} />
          <span className="text-[10px] font-bold">Mehr</span>
        </button>
      </nav>

      {/* More Menu Bottom Sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-navy-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setMoreOpen(false)}>
          <div className="bg-white w-full rounded-t-3xl p-6 pb-[calc(1.5rem+var(--safe-area-bottom))] animate-in slide-in-from-bottom-full duration-300 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-neutral-gray-200 rounded-full mx-auto mb-6" />
            
            <div className="grid grid-cols-4 gap-y-6 gap-x-2">
              <SheetLink href="/quotes" icon={<MessageSquare />} label="Anfragen" onClick={() => setMoreOpen(false)} />
              <SheetLink href="/orders" icon={<ClipboardList />} label="Aufträge" onClick={() => setMoreOpen(false)} />
              <SheetLink href="/customers" icon={<Users />} label="Kunden" onClick={() => setMoreOpen(false)} />
              <SheetLink href="/station" icon={<Factory />} label="Stationen" onClick={() => setMoreOpen(false)} />
              <SheetLink href="/kontrolle" icon={<ShieldCheck />} label="Kontrolle" onClick={() => setMoreOpen(false)} />
              <SheetLink href="/performance" icon={<TrendingUp />} label="Metriken" onClick={() => setMoreOpen(false)} />
              <SheetLink href="/settings" icon={<Settings />} label="Setup" onClick={() => setMoreOpen(false)} />
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
