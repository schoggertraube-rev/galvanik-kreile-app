"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { X, Home, PackageCheck, Warehouse, Archive, Users, MessageSquare, ChevronDown, ChevronRight, Banknote, HeartHandshake, Beaker, Database, MonitorSmartphone, BarChart3, Lightbulb, Settings, FileText } from "lucide-react";
import { inquiriesRepository } from "@/lib/repositories/inquiriesRepository";
import { bathsRepository } from "@/lib/repositories/bathsRepository";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const [openQuotes, setOpenQuotes] = useState(0);
  const [hasCriticalBaths, setHasCriticalBaths] = useState(false);
  const [isAdminOrDev, setIsAdminOrDev] = useState(false);
  
  // Submenu states
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setOpenQuotes(await inquiriesRepository.getOpenCount());
      setHasCriticalBaths(await bathsRepository.hasCriticalBath());
    };
    if (open) {
      fetchStats();
      const role = localStorage.getItem("kreile_user_role")?.toLowerCase();
      if (role === "admin" || role === "developer" || role === "inhaber") setIsAdminOrDev(true);
    }
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");

  type NavItemProps = {
    label: string;
    href: string;
    icon: React.ElementType;
    badge?: number;
    status?: "critical" | string;
    submenu?: { label: string; href: string; }[];
  };

  const NavItem = ({ label, href, icon: Icon, badge, status, submenu }: NavItemProps) => {
    const active = isActive(href);
    const hasSub = !!submenu;
    const isSubOpen = openSubmenu === href;

    return (
      <div className="flex flex-col border-b border-neutral-gray-100/50 last:border-0">
        <div className="flex items-center w-full">
          <Link
            href={href}
            onClick={onClose}
            className={`flex-1 flex items-center gap-4 py-4 px-6 min-h-[56px] transition-colors ${active ? "text-accent-orange bg-accent-orange/5 font-bold" : "text-navy-900 font-medium"}`}
          >
            <div className="relative flex items-center justify-center shrink-0 w-6 h-6">
              <Icon className="w-6 h-6" strokeWidth={1.5} />
              {status === "critical" && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-danger-red rounded-full border-2 border-white" />
              )}
            </div>
            <span className="text-base font-medium">{label}</span>
            {(badge ?? 0) > 0 && (
              <span className="ml-auto bg-accent-orange text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </Link>
          
          {hasSub && (
            <button
              onClick={() => setOpenSubmenu(isSubOpen ? null : href)}
              className="p-4 px-6 min-h-[56px] flex items-center justify-center text-neutral-gray-400 active:bg-neutral-gray-100"
            >
              {isSubOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          )}
        </div>
        
        {hasSub && isSubOpen && (
          <div className="bg-neutral-gray-50 flex flex-col py-2 px-12">
            {submenu.map((sub: { label: string; href: string; }) => (
              <Link
                key={sub.href}
                href={sub.href}
                onClick={onClose}
                className={`py-3 text-sm min-h-[48px] flex items-center ${pathname === sub.href ? "text-accent-orange font-bold" : "text-text-muted"}`}
              >
                {sub.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={onClose}
        />
      )}
      
      {/* Slide-in Panel */}
      <div 
        className={`fixed left-0 top-0 h-full w-72 bg-white z-50 transform transition-transform duration-300 shadow-2xl flex flex-col ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-4 px-6 border-b border-neutral-gray-100 min-h-[72px]">
          <img src="/assets/logo/kreile-wordmark-skyline.svg" alt="Kreile" className="h-8 w-auto" />
          <button 
            onClick={onClose}
            className="p-2 -mr-2 text-navy-500 hover:bg-neutral-gray-100 rounded-full min-h-[48px] min-w-[48px] flex items-center justify-center"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 pb-24">
          <NavItem label="Home" href="/" icon={Home} />
          <NavItem label="Warendurchlauf" href="/warendurchlauf" icon={PackageCheck} />
          
          <NavItem 
            label="Kunden und Aufträge" 
            href="/orders" 
            icon={Users} 
            submenu={[
              { label: "Aufträge", href: "/orders" }, 
              { label: "Kunden", href: "/customers" }, 
              { label: "Angebote und Freigaben", href: "/quotes" }
            ]} 
          />
          
          <NavItem 
            label="Betrieb" 
            href="/betrieb" 
            icon={Archive} 
            submenu={[
              { label: "Betriebs-Cockpit", href: "/betrieb" }, 
              { label: "Kontrolle", href: "/kontrolle" }, 
              { label: "Kommunikation", href: "/kommunikation" }, 
              { label: "Kundenservice", href: "/kundenservice" }, 
              { label: "Betriebs-KVP", href: "/betrieb-kvp" }, 
              { label: "Bäder", href: "/baeder" }, 
              { label: "Lager und Teile", href: "/items" },
              ...(isAdminOrDev ? [{ label: "Buchhaltung", href: "/buchhaltung" }] : [])
            ]} 
          />
          
          <NavItem label="Analyse" href="/performance" icon={BarChart3} />
          
          {isAdminOrDev && (
            <NavItem 
              label="Verwaltung" 
              href="/admin/import" 
              icon={Settings} 
              submenu={[
                { label: "Datenimport", href: "/admin/import" }, 
                { label: "Geräte und Lizenzen", href: "/admin/devices" }, 
                { label: "Einstellungen", href: "/settings" }, 
                { label: "App-KVP", href: "/kvp" }, 
                { label: "Developer Analytics", href: "/admin/analytics" }
              ]} 
            />
          )}
        </nav>
      </div>
    </>
  );
}
