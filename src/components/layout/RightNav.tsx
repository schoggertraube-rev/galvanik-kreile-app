"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { RightNavItem } from "./RightNavItem";
import { Home, PackageCheck, Archive, Users, Settings, BarChart3, Menu } from "lucide-react";
import { trackUiEvent } from "@/lib/tracking/tracking";
import Link from "next/link";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { motion, AnimatePresence } from "framer-motion";

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

export function RightNav() {
  const pathname = usePathname();
  const { hasPermission, role } = usePermissions();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");

  // Dynamically set CSS variable for content area
  useEffect(() => {
    document.documentElement.style.setProperty('--rail-width', isHovered ? '200px' : '72px');
  }, [isHovered]);

  return (
    <motion.aside
      initial={false}
      animate={{ width: isHovered ? 200 : 72 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="bg-transparent flex flex-col items-center py-4 gap-2 h-full overflow-y-auto overflow-x-hidden scrollbar-hide relative"
    >
      <div className="flex flex-col items-center w-full px-2 mt-2">
        <RightNavItem label="Home" href="/" icon={<Home className="w-5 h-5" strokeWidth={2} />} isActive={isActive("/")} isExpanded={isHovered} onClick={() => trackUiEvent("nav_click", { target: "/" })} />
      </div>

      {["inhaber", "admin", "developer"].includes(role?.toLowerCase() || "") && (
        <div className="flex flex-col items-center w-full px-2 mt-2">
          <RightNavItem label="Cockpit" href="/cockpit" icon={<BarChart3 className="w-5 h-5" strokeWidth={2} />} isActive={isActive("/cockpit")} isExpanded={isHovered} onClick={() => trackUiEvent("nav_click", { target: "/cockpit" })} />
        </div>
      )}

      <div className="flex flex-col items-center w-full px-2 mt-2">
        <RightNavItem label="Warendurchlauf" href="/warendurchlauf" icon={<PackageCheck className="w-5 h-5" strokeWidth={2} />} isActive={isActive("/station") || isActive("/warendurchlauf")} isExpanded={isHovered} onClick={() => trackUiEvent("nav_click", { target: "/warendurchlauf" })} />
      </div>

      <div className="flex flex-col items-center w-full px-2 mt-2">
        <RightNavItem label="Kunden/Aufträge" href="/orders" icon={<Users className="w-5 h-5" strokeWidth={2} />} isActive={isActive("/orders") || isActive("/customers") || isActive("/quotes")} isExpanded={isHovered} onClick={() => setExpandedGroup(expandedGroup === "kunden" ? null : "kunden")} />
        {isHovered && (expandedGroup === "kunden" || isActive("/orders") || isActive("/customers") || isActive("/quotes")) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex flex-col w-full mt-1 space-y-1">
            <SubMenuLink label="Kunden" href="/customers" isAvailable={true} expanded={isHovered} />
            <SubMenuLink label="Aufträge" href="/orders" isAvailable={true} expanded={isHovered} />
            <SubMenuLink label="Anfragen" href="/quotes" isAvailable={true} expanded={isHovered} />
          </motion.div>
        )}
      </div>

      <div className="flex flex-col items-center w-full px-2 mt-2">
        <RightNavItem label="Betrieb" href="/betrieb" icon={<Archive className="w-5 h-5" strokeWidth={2} />} isActive={isActive("/betrieb") || isActive("/items") || isActive("/baeder") || isActive("/buchhaltung")} isExpanded={isHovered} onClick={() => trackUiEvent("nav_click", { target: "/betrieb" })} />
      </div>

      <div className="flex flex-col items-center w-full px-2 mt-2">
        <RightNavItem label="Analyse" href="/performance" icon={<BarChart3 className="w-5 h-5" strokeWidth={2} />} isActive={isActive("/performance")} isExpanded={isHovered} onClick={() => trackUiEvent("nav_click", { target: "/performance" })} />
      </div>

      <div className="flex flex-col items-center w-full px-2 mt-2">
        <RightNavItem label="Kommunikation" href="/kommunikation" icon={<Users className="w-5 h-5" strokeWidth={2} />} isActive={isActive("/kommunikation")} isExpanded={isHovered} onClick={() => trackUiEvent("nav_click", { target: "/kommunikation" })} />
      </div>

      {hasPermission("perm_sys_users") && (
        <div className="flex flex-col items-center w-full px-2 mt-auto mb-8">
          <RightNavItem label="Verwaltung" href="/settings" icon={<Settings className="w-5 h-5" strokeWidth={2} />} isActive={isActive("/settings") || isActive("/admin/") || isActive("/kvp")} isExpanded={isHovered} onClick={() => trackUiEvent("nav_click", { target: "/settings" })} />
        </div>
      )}

    </motion.aside>
  );
}
