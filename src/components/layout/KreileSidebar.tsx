"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ListTodo,
  MessageSquare,
  Box,
  Users,
  PackageCheck,
  ScanLine,
  Warehouse,
} from "lucide-react";
import { useState, useEffect } from "react";
import { inquiriesRepository } from "@/lib/repositories/inquiriesRepository";

export const MAIN_NAV_ITEMS = [
  { name: "Home",           path: "/",               icon: Home },
  { name: "Aufträge",       path: "/orders",          icon: ListTodo },
  { name: "Anfragen",       path: "/quotes",          icon: MessageSquare, hasBadge: true },
  { name: "Kunden",         path: "/customers",       icon: Users },
  { name: "Warendurchlauf", path: "/warendurchlauf",  icon: PackageCheck },
  { name: "Lager & Chemie", path: "/items",           icon: Warehouse },
  { name: "Scan",           path: "/scan",            icon: ScanLine },
];

export const MORE_NAV_ITEMS = [
  { name: "Verzug & Engpässe", path: "/status" },
  { name: "Performance",       path: "/performance" },
  { name: "Einstellungen",     path: "/settings" },
  { name: "Kontrolle & Archiv",path: "/archive" },
];

export function KreileSidebar() {
  const pathname = usePathname();
  const [openQuotes, setOpenQuotes] = useState(0);

  useEffect(() => {
    const fetch = async () => setOpenQuotes(await inquiriesRepository.getOpenCount());
    fetch();
    window.addEventListener("kreile-inquiries-updated", fetch);
    window.addEventListener("storage", fetch);
    return () => {
      window.removeEventListener("kreile-inquiries-updated", fetch);
      window.removeEventListener("storage", fetch);
    };
  }, []);

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");

  return (
    <aside className="hidden lg:flex flex-col w-56 xl:w-64 shrink-0 border-r border-neutral-gray-100 bg-white h-full overflow-y-auto">

      {/* Logo-Block oben (wiederholt das Brand kurz) */}
      <div className="px-4 pt-5 pb-3 border-b border-neutral-gray-100">
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Navigation</p>
      </div>

      {/* Haupt-Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {MAIN_NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.name}
              href={item.path}
              className={[
                "group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150",
                active
                  ? "bg-navy-900 text-white"
                  : "text-text-muted hover:bg-bg-app hover:text-navy-900",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <item.icon
                  className={[
                    "w-[18px] h-[18px] shrink-0 transition-colors",
                    active
                      ? "text-white"
                      : "text-text-muted group-hover:text-navy-900",
                  ].join(" ")}
                  strokeWidth={1.5}
                />
                <span className="truncate">{item.name}</span>
              </div>

              {/* Badge für Anfragen */}
              {item.hasBadge && openQuotes > 0 && (
                <span
                  className={[
                    "text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                    active ? "bg-white text-navy-900" : "bg-danger-red text-white",
                  ].join(" ")}
                >
                  {openQuotes}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Ergänzende Funktionen */}
      <div className="px-3 pb-4 border-t border-neutral-gray-100 pt-3">
        <p className="px-3 mb-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">
          Ergänzend
        </p>
        {MORE_NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.name}
              href={item.path}
              className={[
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                active
                  ? "text-navy-900 font-bold bg-bg-app"
                  : "text-text-muted hover:bg-bg-app hover:text-navy-900",
              ].join(" ")}
            >
              <span className={`w-1 h-1 rounded-full shrink-0 ${active ? "bg-accent-orange" : "bg-neutral-gray-100"}`} />
              {item.name}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
