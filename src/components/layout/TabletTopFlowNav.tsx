"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, PackageCheck, ClipboardList, Users, ShieldCheck, Factory, BarChart3 } from "lucide-react";
import { usePermissions } from "@/lib/auth/PermissionsContext";

export function TabletTopFlowNav({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const { role } = usePermissions();

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");

  return (
    <nav className={`bg-white border-b border-neutral-gray-100 px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-hide ${className}`}>
      <FlowTab href="/" icon={<Home className="w-5 h-5" />} label="Home" active={isActive("/")} />
      {["inhaber", "admin", "developer"].includes(role?.toLowerCase() || "") && (
        <FlowTab href="/cockpit" icon={<BarChart3 className="w-5 h-5" />} label="Cockpit" active={isActive("/cockpit")} />
      )}
      
      {/* Warendurchlauf is prominent */}
      <FlowTab 
        href="/warendurchlauf" 
        icon={<PackageCheck className="w-5 h-5" />} 
        label="Warendurchlauf" 
        active={isActive("/warendurchlauf") || isActive("/station")} 
        prominent
      />

      <div className="w-px h-8 bg-neutral-gray-100 mx-1 shrink-0" />

      <FlowTab href="/orders" icon={<ClipboardList className="w-4 h-4" />} label="Aufträge" active={isActive("/orders")} />
      <FlowTab href="/customers" icon={<Users className="w-4 h-4" />} label="Kunden" active={isActive("/customers")} />
      <FlowTab href="/station" icon={<Factory className="w-4 h-4" />} label="Stationen" active={isActive("/station") && !isActive("/warendurchlauf")} />
      <FlowTab href="/kontrolle" icon={<ShieldCheck className="w-4 h-4" />} label="Kontrolle" active={isActive("/kontrolle")} />
    </nav>
  );
}

function FlowTab({ href, icon, label, active, prominent = false }: { href: string; icon: React.ReactNode; label: string; active: boolean; prominent?: boolean }) {
  if (prominent) {
    return (
      <Link
        href={href}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-full whitespace-nowrap transition-all font-bold ${
          active 
            ? "bg-navy-900 text-white shadow-md" 
            : "bg-gold-100 text-navy-900 hover:bg-gold-500/20 border border-gold-600/20"
        }`}
      >
        {icon}
        <span className="text-sm">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-colors font-bold text-sm ${
        active
          ? "bg-neutral-gray-100 text-navy-900"
          : "text-text-muted hover:text-navy-900 hover:bg-bg-app"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
