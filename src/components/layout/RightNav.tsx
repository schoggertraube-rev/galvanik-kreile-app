"use client";

import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { RightNavItem } from "./RightNavItem";
import { Home, PackageCheck, Archive, Users, Settings, BarChart3, Menu } from "lucide-react";
import { trackUiEvent } from "@/lib/tracking/tracking";
import Link from "next/link";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { cn } from "@/lib/utils";

function SubMenuLink({ label, href, isAvailable, expanded }: { label: string, href: string, isAvailable: boolean, expanded: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  if (!isAvailable) {
    return (
      <div className={`text-[12px] font-bold py-2 px-3 rounded-xl text-left mx-2 mb-1 flex items-center gap-2 opacity-40 cursor-not-allowed text-neutral-gray-500 grayscale select-none ${expanded ? "block" : "hidden"}`}>
        <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-neutral-gray-300" />
        {expanded && <span>{label}</span>}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`text-[12px] font-bold py-2 px-3 rounded-xl text-left transition-colors mx-2 mb-1 flex items-center gap-2 ${isActive ? "text-navy-900 bg-neutral-gray-100" : "text-text-muted hover:text-navy-900 hover:bg-bg-app"
        } ${expanded ? "block" : "hidden"}`}
      onClick={() => trackUiEvent("nav_click", { target: href, type: "sub_menu" })}
    >
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-navy-900' : 'bg-neutral-gray-300'}`} />
      {expanded && <span>{label}</span>}
    </Link>
  );
}

function subscribeToPointerMode(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const mediaQuery = window.matchMedia("(pointer: coarse)");
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getTouchSnapshot(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

export function RightNav() {
  const pathname = usePathname();
  const { hasPermission, role } = usePermissions();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const isTouch = useSyncExternalStore(subscribeToPointerMode, getTouchSnapshot, () => false);

  const expanded = pinned || isHovered || isTouch;

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");

  const showKundenSub = expanded && (expandedGroup === "kunden" || isActive("/orders") || isActive("/customers") || isActive("/quotes"));

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: expanded ? 200 : 72,
      }}
      className="absolute left-0 top-0 h-full bg-bg-app border-r border-[#d8d0c4] flex flex-col items-center py-4 gap-2 overflow-y-auto overflow-x-hidden scrollbar-hide z-40 transition-[width] duration-200 ease-in-out motion-reduce:transition-none shadow-md"
    >
      <div className="flex flex-col items-center w-full px-2">
        <button
          onClick={() => setPinned(prev => !prev)}
          className={cn(
            "flex items-center transition-all duration-300 motion-reduce:transition-none rounded-xl cursor-pointer hover:bg-white hover:text-navy-900 border border-transparent hover:border-neutral-gray-200 text-navy-500",
            expanded ? "w-[184px] px-3 justify-start h-[56px]" : "w-[56px] justify-center h-[56px]"
          )}
          aria-label="Navigation fixieren"
        >
          <Menu className="w-5 h-5 shrink-0" strokeWidth={2} />
          {expanded && (
            <span className="text-[14px] font-bold ml-3 leading-tight whitespace-nowrap overflow-hidden transition-opacity duration-150">
              {pinned ? "Fixiert" : "Fixieren"}
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-col items-center w-full px-2 mt-2">
        <RightNavItem label="Home" href="/" icon={<Home className="w-5 h-5" strokeWidth={2} />} isActive={isActive("/")} isExpanded={expanded} onClick={() => trackUiEvent("nav_click", { target: "/" })} />
      </div>

      {["inhaber", "admin", "developer"].includes(role?.toLowerCase() || "") && (
        <div className="flex flex-col items-center w-full px-2 mt-2">
          <RightNavItem label="Cockpit" href="/cockpit" icon={<BarChart3 className="w-5 h-5" strokeWidth={2} />} isActive={isActive("/cockpit")} isExpanded={expanded} onClick={() => trackUiEvent("nav_click", { target: "/cockpit" })} />
        </div>
      )}

      <div className="flex flex-col items-center w-full px-2 mt-2">
        <RightNavItem label="Warendurchlauf" href="/warendurchlauf" icon={<PackageCheck className="w-5 h-5" strokeWidth={2} />} isActive={isActive("/station") || isActive("/warendurchlauf")} isExpanded={expanded} onClick={() => trackUiEvent("nav_click", { target: "/warendurchlauf" })} />
      </div>

      <div className="flex flex-col items-center w-full px-2 mt-2">
        <RightNavItem label="Kunden/Aufträge" href="/orders" icon={<Users className="w-5 h-5" strokeWidth={2} />} isActive={isActive("/orders") || isActive("/customers") || isActive("/quotes")} isExpanded={expanded} onClick={() => setExpandedGroup(expandedGroup === "kunden" ? null : "kunden")} />
        {/* Sub-menu without height animation */}
        <div
          className={cn(
            "flex flex-col w-full mt-1 space-y-1 transition-opacity duration-150 motion-reduce:transition-none",
            showKundenSub ? "opacity-100 visible h-auto" : "opacity-0 invisible h-0 overflow-hidden"
          )}
        >
          <SubMenuLink label="Kunden" href="/customers" isAvailable={true} expanded={expanded} />
          <SubMenuLink label="Aufträge" href="/orders" isAvailable={true} expanded={expanded} />
          <SubMenuLink label="Anfragen" href="/quotes" isAvailable={true} expanded={expanded} />
        </div>
      </div>

      <div className="flex flex-col items-center w-full px-2 mt-2">
        <RightNavItem label="Betrieb" href="/betrieb" icon={<Archive className="w-5 h-5" strokeWidth={2} />} isActive={isActive("/betrieb") || isActive("/items") || isActive("/baeder") || isActive("/buchhaltung")} isExpanded={expanded} onClick={() => trackUiEvent("nav_click", { target: "/betrieb" })} />
      </div>

      <div className="flex flex-col items-center w-full px-2 mt-2">
        <RightNavItem label="Analyse" href="/performance" icon={<BarChart3 className="w-5 h-5" strokeWidth={2} />} isActive={isActive("/performance")} isExpanded={expanded} onClick={() => trackUiEvent("nav_click", { target: "/performance" })} />
      </div>

      <div className="flex flex-col items-center w-full px-2 mt-2">
        <RightNavItem label="Kommunikation" href="/kommunikation" icon={<Users className="w-5 h-5" strokeWidth={2} />} isActive={isActive("/kommunikation")} isExpanded={expanded} onClick={() => trackUiEvent("nav_click", { target: "/kommunikation" })} />
      </div>

      {hasPermission("perm_sys_users") && (
        <div className="flex flex-col items-center w-full px-2 mt-auto mb-8">
          <RightNavItem label="Verwaltung" href="/settings" icon={<Settings className="w-5 h-5" strokeWidth={2} />} isActive={isActive("/settings") || isActive("/admin/") || isActive("/kvp")} isExpanded={expanded} onClick={() => trackUiEvent("nav_click", { target: "/settings" })} />
        </div>
      )}
    </aside>
  );
}
