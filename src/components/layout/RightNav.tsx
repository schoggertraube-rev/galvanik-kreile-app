"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { RightNavItem } from "./RightNavItem";
import { inquiriesRepository } from "@/lib/repositories/inquiriesRepository";
import { bathsRepository } from "@/lib/repositories/bathsRepository";
import { Home, PackageCheck, Warehouse, Archive, Users, MessageSquare, Banknote, HeartHandshake, Beaker, Database, MonitorSmartphone, BarChart3 } from "lucide-react";
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
        <RightNavItem
          label="Home"
          href="/"
          icon={<Home className="w-6 h-6" strokeWidth={1.5} />}
          variant="primary"
          isActive={isActive("/")}
          onClick={() => trackUiEvent("nav_click", { target: "/" })}
        />
      </div>

      <div className="flex flex-col items-center w-full border-t border-neutral-gray-100 pt-4">
        <RightNavItem
          label="Warendurchlauf"
          href="/warendurchlauf"
          icon={<PackageCheck className="w-6 h-6" strokeWidth={1.5} />}
          variant="primary"
          isActive={isActive("/station") || isActive("/warendurchlauf")}
          onClick={() => trackUiEvent("nav_click", { target: "/warendurchlauf" })}
        />
      </div>

      <div className="flex flex-col items-center w-full">
        <RightNavItem
          label="Anfragen"
          href="/quotes"
          icon={<MessageSquare className="w-5 h-5" strokeWidth={1.5} />}
          variant="normal"
          badge={openQuotes}
          isActive={isActive("/quotes")}
          onClick={() => trackUiEvent("nav_click", { target: "/quotes" })}
        />
      </div>

      <div className="flex flex-col items-center w-full border-t border-neutral-gray-100 pt-4">
        <RightNavItem
          label="Kunden & Aufträge"
          href="/kunden-auftraege"
          icon={<Users className="w-5 h-5" strokeWidth={1.5} />}
          variant="normal"
          isActive={isActive("/kunden-auftraege") || isActive("/orders") || isActive("/customers")}
          onClick={() => trackUiEvent("nav_click", { target: "/kunden-auftraege" })}
        />
      </div>

      <div className="flex flex-col items-center w-full">
        <RightNavItem
          label="Lager & Chemie"
          href="/items"
          icon={<Warehouse className="w-5 h-5" strokeWidth={1.5} />}
          variant="normal"
          isActive={isActive("/items")}
          onClick={() => trackUiEvent("nav_click", { target: "/items" })}
        />
        <div className="mt-4 w-full">
          <RightNavItem
            label="Bäder"
            href="/baeder"
            icon={<Beaker className="w-5 h-5" strokeWidth={1.5} />}
            variant="normal"
            isActive={isActive("/baeder")}
            status={hasCriticalBaths ? "critical" : undefined}
            onClick={() => trackUiEvent("nav_click", { target: "/baeder" })}
          />
        </div>
      </div>

      <div className="flex flex-col items-center w-full border-t border-neutral-gray-100 pt-4 mb-4">
        <RightNavItem
          label="Kontrolle"
          href="/kontrolle"
          icon={<Archive className="w-5 h-5" strokeWidth={1.5} />}
          variant="normal"
          isActive={isActive("/kontrolle") || isActive("/archive") || isActive("/performance")}
          onClick={() => trackUiEvent("nav_click", { target: "/kontrolle" })}
        />
        
        <div className="mt-4 w-full">
          <RightNavItem
            label="Kundenservice"
            href="/kundenservice"
            icon={<HeartHandshake className="w-5 h-5" strokeWidth={1.5} />}
            variant="normal"
            isActive={isActive("/kundenservice")}
            onClick={() => trackUiEvent("nav_click", { target: "/kundenservice" })}
          />
        </div>

        <div className="mt-4 w-full">
          <RightNavItem
            label="Buchhaltung"
            href="/finanzen"
            icon={<Banknote className="w-5 h-5" strokeWidth={1.5} />}
            variant="normal"
            isActive={isActive("/finanzen")}
            onClick={() => trackUiEvent("nav_click", { target: "/finanzen" })}
          />
        </div>

        {isAdminOrDev && (
          <div className="mt-4 w-full">
            <RightNavItem
              label="Datenimport"
              href="/admin/import"
              icon={<Database className="w-5 h-5" strokeWidth={1.5} />}
              variant="normal"
              isActive={isActive("/admin/import")}
              onClick={() => trackUiEvent("nav_click", { target: "/admin/import" })}
            />
          </div>
        )}

        {isAdminOrDev && (
          <div className="mt-4 w-full">
            <RightNavItem
              label="Analytics"
              href="/admin/analytics"
              icon={<BarChart3 className="w-5 h-5" strokeWidth={1.5} />}
              variant="normal"
              isActive={isActive("/admin/analytics")}
              onClick={() => trackUiEvent("nav_click", { target: "/admin/analytics" })}
            />
          </div>
        )}

        {isAdminOrDev && (
          <div className="mt-4 w-full">
            <RightNavItem
              label="Geräte"
              href="/admin/devices"
              icon={<MonitorSmartphone className="w-5 h-5" strokeWidth={1.5} />}
              variant="normal"
              isActive={isActive("/admin/devices")}
              onClick={() => trackUiEvent("nav_click", { target: "/admin/devices" })}
            />
          </div>
        )}
      </div>
      
    </aside>
  );
}
