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
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-kreile-border z-50 px-2 py-2">
      <div className="flex items-center justify-between w-full gap-1 overflow-x-auto scrollbar-none">

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
                  ? "bg-kreile-navy text-white shadow-sm"
                  : "text-kreile-muted hover:text-kreile-navy hover:bg-kreile-bg"
              }`}
            >
              <item.icon 
                className={`w-5 h-5 shrink-0 ${
                  isWarendurchlauf && !isActive ? "text-[#F28A0C]" : ""
                }`} 
                strokeWidth={isActive ? 2.5 : 1.8} 
              />
              <span className={`text-[11px] font-bold tracking-tight leading-none ${isActive ? "text-white" : "text-kreile-text"}`}>
                {item.name}
              </span>

              {/* Badge für Anfragen */}
              {item.hasBadge && openQuotes > 0 && (
                <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-status-red text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white">
                  {openQuotes}
                </span>
              )}
            </Link>
          );
        })}

        {/* Mehr-Button direkt in der Reihe (wie auf dem Foto) */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-[16px] text-kreile-muted hover:text-kreile-navy hover:bg-kreile-bg transition-all duration-200 outline-none shrink-0 cursor-pointer">
            <MoreHorizontal className="w-5 h-5 shrink-0 text-kreile-text" strokeWidth={1.8} />
            <span className="text-[11px] font-bold tracking-tight leading-none text-kreile-text">Mehr</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            className="w-52 mb-2 rounded-2xl border-kreile-border shadow-lg p-1.5 bg-white"
          >
            <div className="text-[10px] font-bold text-kreile-muted uppercase tracking-wider px-2 py-1.5">
              Ergänzend
            </div>
            {MORE_NAV_ITEMS.map((item) => (
              <DropdownMenuItem
                key={item.name}
                onClick={() => router.push(item.path)}
                className="rounded-xl cursor-pointer py-2.5 font-bold text-kreile-navy focus:bg-kreile-bg"
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
