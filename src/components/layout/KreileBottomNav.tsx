"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { inquiriesRepository } from "@/lib/repositories/inquiriesRepository";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MAIN_NAV_ITEMS, MORE_NAV_ITEMS } from "./KreileSidebar";

// Maximal 7 Items direkt sichtbar in der Bottom Nav
const BOTTOM_NAV_ITEMS = MAIN_NAV_ITEMS.slice(0, 7);

export function KreileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [openQuotes, setOpenQuotes] = useState(0);

  useEffect(() => {
    const fetchQuotesCount = async () => {
      const count = await inquiriesRepository.getOpenCount();
      setOpenQuotes(count);
    };
    fetchQuotesCount();

    const handleUpdate = () => fetchQuotesCount();
    window.addEventListener("kreile-inquiries-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("kreile-inquiries-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-gray-100 z-50 h-[80px] flex items-center justify-center shadow-[0_-4px_24px_rgba(14,26,46,0.04)]">
      <div className="flex items-center justify-between w-full max-w-[1400px] gap-2 px-4 md:px-6 overflow-x-auto scrollbar-none">

        {MAIN_NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.path ||
            (item.path !== "/" && pathname.startsWith(item.path));

          // Custom colors and icons for Warendurchlauf
          const isWarendurchlauf = item.path === "/warendurchlauf";
          
          return (
            <Link
              key={item.name}
              href={item.path}
              className={`relative flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-[16px] transition-all duration-200 shrink-0 ${
                isActive
                  ? "bg-navy-700 text-white shadow-sm"
                  : "text-text-muted hover:text-navy-900 hover:bg-bg-app-soft"
              }`}
            >
              <item.icon 
                className={`w-5 h-5 shrink-0 ${
                  isWarendurchlauf && !isActive ? "text-accent-orange" : ""
                }`} 
                strokeWidth={1.5} 
              />
              <span className={`text-[11px] font-bold tracking-tight leading-none ${isActive ? "text-white" : "text-navy-900"}`}>
                {item.name}
              </span>

              {/* Badge für Anfragen */}
              {item.hasBadge && openQuotes > 0 && (
                <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-danger-red text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white">
                  {openQuotes}
                </span>
              )}
            </Link>
          );
        })}

        {/* Mehr-Button direkt in der Reihe (wie auf dem Foto) */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-[16px] text-text-muted hover:text-navy-900 hover:bg-bg-app-soft transition-all duration-200 outline-none shrink-0 cursor-pointer">
            <MoreHorizontal className="w-5 h-5 shrink-0 text-navy-500" strokeWidth={1.8} />
            <span className="text-[11px] font-bold tracking-tight leading-none text-navy-500">Mehr</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            className="w-52 mb-2 rounded-2xl border-neutral-gray-100 shadow-[0_4px_24px_rgba(14,26,46,0.10)] p-1.5 bg-white"
          >
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider px-2 py-1.5">
              Ergänzend
            </div>
            {MORE_NAV_ITEMS.map((item) => (
              <DropdownMenuItem
                key={item.name}
                onClick={() => router.push(item.path)}
                className="rounded-xl cursor-pointer py-2.5 font-bold text-navy-900 focus:bg-bg-app-soft"
              >
                {item.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </nav>
  );
}
