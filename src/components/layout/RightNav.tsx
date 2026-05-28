"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { RightNavItem } from "./RightNavItem";
import { inquiriesRepository } from "@/lib/repositories/inquiriesRepository";
import { bathsRepository } from "@/lib/repositories/bathsRepository";
import { Home, PackageCheck, Warehouse, Archive, Users } from "lucide-react";
import { trackUiEvent } from "@/lib/tracking/tracking";
import Link from "next/link";
import { useFeatureFlag } from "@/lib/license/useFeatureFlag";

function SubMenuLink({ label, href, isAvailable }: { label: string, href: string, isAvailable: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === href;
  
  return (
    <Link 
      href={isAvailable ? href : "#"}
      className={`text-[9px] font-bold py-1.5 px-2 rounded-lg text-left transition-colors mx-2 mb-1 flex items-center gap-1.5 ${
        !isAvailable ? "opacity-50 cursor-not-allowed text-neutral-gray-400" :
        isActive ? "text-navy-900 bg-neutral-gray-100" : "text-text-muted hover:text-navy-900 hover:bg-bg-app"
      }`}
      onClick={(e) => {
        if (!isAvailable) {
          e.preventDefault();
        } else {
          trackUiEvent("nav_click", { target: href, type: "sub_menu" });
        }
      }}
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
  
  const engpassFeature = useFeatureFlag("engpass_heatmap");
  const performanceFeature = useFeatureFlag("performance_score");

  useEffect(() => {
    const fetchStats = async () => {
      setOpenQuotes(await inquiriesRepository.getOpenCount());
      setHasCriticalBaths(await bathsRepository.hasCriticalBath());
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

      <div className="flex flex-col gap-1 w-full border-t border-neutral-gray-100 pt-4">
        <div className="flex flex-col items-center w-full">
          <RightNavItem
            label="Warendurchlauf"
            href="/warendurchlauf"
            icon={<PackageCheck className="w-6 h-6" strokeWidth={1.5} />}
            variant="primary"
            highlight="green"
            isActive={isActive("/station") || isActive("/warendurchlauf")}
            onClick={() => trackUiEvent("nav_click", { target: "/warendurchlauf" })}
          />
        </div>
        <SubMenuLink label="Verzug" href="/status" isAvailable={engpassFeature.available} />
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
          status={hasCriticalBaths ? "critical" : undefined}
          onClick={() => trackUiEvent("nav_click", { target: "/items" })}
        />
      </div>

      <div className="flex flex-col gap-1 w-full border-t border-neutral-gray-100 pt-4 mb-4">
        <div className="flex flex-col items-center w-full">
          <RightNavItem
            label="Kontrolle & Archiv"
            href="/archive"
            icon={<Archive className="w-5 h-5" strokeWidth={1.5} />}
            variant="normal"
            isActive={isActive("/archive")}
            onClick={() => trackUiEvent("nav_click", { target: "/archive" })}
          />
        </div>
        <SubMenuLink label="Performance" href="/performance" isAvailable={performanceFeature.available} />
      </div>
      
    </aside>
  );
}
