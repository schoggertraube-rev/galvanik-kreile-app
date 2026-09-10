"use client";

import { ClipboardList, Home, Menu, PackageCheck, Settings, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { usePermissions } from "@/lib/auth/PermissionsContext";

const PRIMARY = [
  { href: "/", label: "Der Tag", icon: Home },
  { href: "/orders", label: "Aufträge", icon: ClipboardList },
  { href: "/customers", label: "Kunden", icon: Users },
] as const;

export function MobileBottomNav({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const { role } = usePermissions();
  const [moreOpen, setMoreOpen] = useState(false);
  const canConfigure = role === "admin" || role === "developer";

  return (
    <>
      <nav className={className} aria-label="Mobile Hauptnavigation">
        {PRIMARY.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={pathname === href || (href !== "/" && pathname.startsWith(href)) ? "page" : undefined}>
            <Icon aria-hidden="true" /><span>{label}</span>
          </Link>
        ))}
        <button type="button" onClick={() => setMoreOpen(true)} aria-expanded={moreOpen}>
          <Menu aria-hidden="true" /><span>Mehr</span>
        </button>
      </nav>
      {moreOpen && (
        <div className="target-more-backdrop" role="presentation" onClick={() => setMoreOpen(false)}>
          <section className="target-more-sheet" role="dialog" aria-modal="true" aria-label="Weitere Kernbereiche" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="target-more-close" onClick={() => setMoreOpen(false)} aria-label="Schließen"><X /></button>
            <Link href="/warendurchlauf" onClick={() => setMoreOpen(false)}><PackageCheck />Werkstatt</Link>
            {canConfigure && <Link href="/settings" onClick={() => setMoreOpen(false)}><Settings />Einstellungen</Link>}
          </section>
        </div>
      )}
    </>
  );
}
