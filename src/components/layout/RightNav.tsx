"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { RightNavItem } from "./RightNavItem";
import { Home, PackageCheck, Archive, Users, Settings, BarChart3 } from "lucide-react";
import { trackUiEvent } from "@/lib/tracking/tracking";
import Link from "next/link";
import { usePermissions } from "@/lib/auth/PermissionsContext";

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
  const { hasPermission } = usePermissions();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");

  return (
    <aside className="w-[100px] bg-transparent flex flex-col items-center py-4 gap-3 h-full overflow-y-auto overflow-x-visible scrollbar-hide">
      
      {/* Glass background overlay spanning the height but subtle */}
      <div className="absolute inset-y-0 left-0 w-[60px] bg-white/40 backdrop-blur-md border-r border-white/60 -z-10" />
      <div className="flex flex-col items-center w-full">
        <RightNavItem label="Home" href="/" icon={<Home className="w-6 h-6" strokeWidth={1.5} />} variant="primary" isActive={isActive("/")} onClick={() => trackUiEvent("nav_click", { target: "/" })} />
      </div>

      <div className="flex flex-col items-center w-full border-t border-neutral-gray-100 pt-4">
        <RightNavItem label="Warendurchlauf" href="/warendurchlauf" icon={<PackageCheck className="w-6 h-6" strokeWidth={1.5} />} variant="primary" isActive={isActive("/station") || isActive("/warendurchlauf")} onClick={() => trackUiEvent("nav_click", { target: "/warendurchlauf" })} />
      </div>

      <div className="flex flex-col items-center w-full mt-2 relative">
        <RightNavItem label="Kunden/Aufträge" href="/orders" icon={<Users className="w-6 h-6" strokeWidth={1.5} />} variant="normal" isActive={isActive("/orders") || isActive("/customers") || isActive("/quotes")} onClick={() => setExpandedGroup(expandedGroup === "kunden" ? null : "kunden")} />
        {(expandedGroup === "kunden" || isActive("/orders") || isActive("/customers") || isActive("/quotes")) && (
          <div className="flex flex-col w-full mt-2 space-y-1">
            <SubMenuLink label="Kunden" href="/customers" isAvailable={true} />
            <SubMenuLink label="Aufträge" href="/orders" isAvailable={true} />
            <SubMenuLink label="Anfragen" href="/quotes" isAvailable={true} />
          </div>
        )}
      </div>

      <div className="flex flex-col items-center w-full mt-2 border-t border-neutral-gray-100 pt-4">
        <RightNavItem label="Betrieb" href="/betrieb" icon={<Archive className="w-5 h-5" strokeWidth={1.5} />} variant="normal" isActive={isActive("/betrieb") || isActive("/items") || isActive("/baeder") || isActive("/buchhaltung")} onClick={() => trackUiEvent("nav_click", { target: "/betrieb" })} />
      </div>

      <div className="flex flex-col items-center w-full mt-2 border-t border-neutral-gray-100 pt-4">
        <RightNavItem label="Analyse" href="/performance" icon={<BarChart3 className="w-5 h-5" strokeWidth={1.5} />} variant="normal" isActive={isActive("/performance")} onClick={() => trackUiEvent("nav_click", { target: "/performance" })} />
      </div>

      <div className="flex flex-col items-center w-full mt-2 border-t border-neutral-gray-100 pt-4">
        <RightNavItem label="Kommunikation" href="/kommunikation" icon={<Users className="w-5 h-5" strokeWidth={1.5} />} variant="normal" isActive={isActive("/kommunikation")} onClick={() => trackUiEvent("nav_click", { target: "/kommunikation" })} />
      </div>

      {hasPermission("perm_sys_users") && (
        <div className="flex flex-col items-center w-full mt-2 border-t border-neutral-gray-100 pt-4 mb-8">
          <RightNavItem label="Verwaltung" href="/settings" icon={<Settings className="w-5 h-5" strokeWidth={1.5} />} variant="normal" isActive={isActive("/settings") || isActive("/admin/") || isActive("/kvp")} onClick={() => trackUiEvent("nav_click", { target: "/settings" })} />
        </div>
      )}
      
    </aside>
  );
}
