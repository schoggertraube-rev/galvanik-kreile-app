"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { RightNavItem } from "./RightNavItem";
import { inquiriesRepository } from "@/lib/repositories/inquiriesRepository";
import { bathsRepository } from "@/lib/repositories/bathsRepository";
import { Home, PackageCheck, Warehouse, Archive, Users, MessageSquare, Banknote, HeartHandshake, Beaker, Database, MonitorSmartphone, BarChart3, Lightbulb, Settings } from "lucide-react";
import { trackUiEvent } from "@/lib/tracking/tracking";
import Link from "next/link";
import { useFeatureFlag } from "@/lib/license/useFeatureFlag";

function SubMenuLink({ label, href, isAvailable }: { label: string, href: string, isAvailable: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === href;
  
  if (!isAvailable) {
    return (
      <div className="text-[9px] font-bold py-1.5 px-2 rounded-lg text-left mx-2 mb-1 flex items-center gap-1.5 opacity-40 cursor-not-allowed text-neutral-gray-500 grayscale select-none">
        <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-neutral-gray-300" />
        {label}
      </div>
    );
  }

  return (
    <Link 
      href={href}
      className={`text-[9px] font-bold py-1.5 px-2 rounded-lg text-left transition-colors mx-2 mb-1 flex items-center gap-1.5 ${
        isActive ? "text-navy-900 bg-neutral-gray-100" : "text-text-muted hover:text-navy-900 hover:bg-bg-app"
      }`}
      onClick={() => trackUiEvent("nav_click", { target: href, type: "sub_menu" })}
    >
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-navy-900' : 'bg-neutral-gray-300'}`} />
      {label}
    </Link>
  );
}

export function RightNav() {
  const pathname = usePathname();
  const [openQuotes, setOpenQuotes] = useState(0);
  const [hasCriticalBaths, setHasCriticalBaths] = useState(false);
  const [isAdminOrDev, setIsAdminOrDev] = useState(false);
  
  const performanceFeature = useFeatureFlag("performance_score");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setOpenQuotes(await inquiriesRepository.getOpenCount());
      setHasCriticalBaths(await bathsRepository.hasCriticalBath());
      
      const role = localStorage.getItem("kreile_user_role");
      if (role === "admin" || role === "developer") setIsAdminOrDev(true);
    };
    
    fetchStats();
    
    window.addEventListener("kreile-inquiries-updated", fetchStats);
    window.addEventListener("storage", fetchStats);
    
    return () => {
      window.removeEventListener("kreile-inquiries-updated", fetchStats);
      window.removeEventListener("storage", fetchStats);
    };
  }, []);

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");

  return (
    <aside className="w-[112px] bg-white border-l border-neutral-gray-100 flex flex-col py-4 gap-4 h-full overflow-y-auto overflow-x-hidden shadow-[-4px_0_24px_rgba(14,26,46,0.02)] scrollbar-hide">
      
      <div className="flex flex-col items-center w-full">
        <RightNavItem label="Home" href="/" icon={<Home className="w-6 h-6" strokeWidth={1.5} />} variant="primary" isActive={isActive("/")} onClick={() => trackUiEvent("nav_click", { target: "/" })} />
      </div>

      <div className="flex flex-col items-center w-full border-t border-neutral-gray-100 pt-4">
        <RightNavItem label="Warendurchlauf" href="/warendurchlauf" icon={<PackageCheck className="w-6 h-6" strokeWidth={1.5} />} variant="primary" isActive={isActive("/station") || isActive("/warendurchlauf")} onClick={() => trackUiEvent("nav_click", { target: "/warendurchlauf" })} />
      </div>

      <div className="flex flex-col items-center w-full mt-2">
        <RightNavItem label="Kunden und Aufträge" href="/orders" icon={<Users className="w-5 h-5" strokeWidth={1.5} />} variant="normal" isActive={isActive("/orders") || isActive("/customers") || isActive("/quotes")} onClick={() => setExpandedGroup(expandedGroup === "kunden" ? null : "kunden")} />
        {(expandedGroup === "kunden" || isActive("/orders") || isActive("/customers") || isActive("/quotes")) && (
          <div className="flex flex-col w-full mt-2 space-y-1">
            <SubMenuLink label="Aufträge" href="/orders" isAvailable={true} />
            <SubMenuLink label="Kunden" href="/customers" isAvailable={true} />
            <SubMenuLink label="Angebote und Freigaben" href="/quotes" isAvailable={true} />
          </div>
        )}
      </div>

      <div className="flex flex-col items-center w-full mt-2 border-t border-neutral-gray-100 pt-4">
        <RightNavItem label="Betrieb" href="/kontrolle" icon={<Archive className="w-5 h-5" strokeWidth={1.5} />} variant="normal" isActive={isActive("/kontrolle") || isActive("/kommunikation") || isActive("/kundenservice") || isActive("/betrieb-kvp") || isActive("/baeder") || isActive("/items")} onClick={() => setExpandedGroup(expandedGroup === "betrieb" ? null : "betrieb")} />
        {(expandedGroup === "betrieb" || isActive("/kontrolle") || isActive("/kommunikation") || isActive("/kundenservice") || isActive("/betrieb-kvp") || isActive("/baeder") || isActive("/items")) && (
          <div className="flex flex-col w-full mt-2 space-y-1">
            <SubMenuLink label="Kontrolle" href="/kontrolle" isAvailable={true} />
            <SubMenuLink label="Kommunikation" href="/kommunikation" isAvailable={true} />
            <SubMenuLink label="Kundenservice" href="/kundenservice" isAvailable={true} />
            <SubMenuLink label="Betriebs-KVP" href="/betrieb-kvp" isAvailable={true} />
            <SubMenuLink label="Bäder" href="/baeder" isAvailable={true} />
            <SubMenuLink label="Lager und Teile" href="/items" isAvailable={true} />
          </div>
        )}
      </div>

      <div className="flex flex-col items-center w-full mt-2 border-t border-neutral-gray-100 pt-4">
        <RightNavItem label="Analyse" href="/performance" icon={<BarChart3 className="w-5 h-5" strokeWidth={1.5} />} variant="normal" isActive={isActive("/performance")} onClick={() => trackUiEvent("nav_click", { target: "/performance" })} />
      </div>

      {isAdminOrDev && (
        <div className="flex flex-col items-center w-full mt-2 border-t border-neutral-gray-100 pt-4 mb-8">
          <RightNavItem label="Verwaltung" href="/finanzen" icon={<Settings className="w-5 h-5" strokeWidth={1.5} />} variant="normal" isActive={isActive("/finanzen") || isActive("/admin/import") || isActive("/admin/devices") || isActive("/settings") || isActive("/kvp") || isActive("/admin/analytics")} onClick={() => setExpandedGroup(expandedGroup === "verwaltung" ? null : "verwaltung")} />
          {(expandedGroup === "verwaltung" || isActive("/finanzen") || isActive("/admin/import") || isActive("/admin/devices") || isActive("/settings") || isActive("/kvp") || isActive("/admin/analytics")) && (
            <div className="flex flex-col w-full mt-2 space-y-1">
              <SubMenuLink label="Buchhaltung und Finanzen" href="/finanzen" isAvailable={true} />
              <SubMenuLink label="Datenimport" href="/admin/import" isAvailable={true} />
              <SubMenuLink label="Geräte und Lizenzen" href="/admin/devices" isAvailable={true} />
              <SubMenuLink label="Einstellungen" href="/settings" isAvailable={true} />
              <SubMenuLink label="App-KVP" href="/kvp" isAvailable={true} />
              <SubMenuLink label="Developer Analytics" href="/admin/analytics" isAvailable={true} />
            </div>
          )}
        </div>
      )}
      
    </aside>
  );
}
