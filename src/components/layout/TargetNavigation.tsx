"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, PackageCheck, Settings, Users } from "lucide-react";
import { usePermissions } from "@/lib/auth/PermissionsContext";

const CORE_LINKS = [
  { href: "/", label: "Der Tag", icon: Home },
  { href: "/warendurchlauf", label: "Werkstatt", icon: PackageCheck },
  { href: "/orders", label: "Aufträge", icon: ClipboardList },
  { href: "/customers", label: "Kunden & Kontakt", icon: Users },
] as const;

export function TargetNavigation() {
  const pathname = usePathname();
  const { role } = usePermissions();
  const canConfigure = role === "admin" || role === "developer";

  return (
    <aside className="target-sidebar">
      <nav aria-label="Hauptnavigation">
        {CORE_LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
        {canConfigure && (
          <Link href="/settings" aria-current={pathname.startsWith("/settings") ? "page" : undefined}>
            <Settings aria-hidden="true" />
            <span>Einstellungen</span>
          </Link>
        )}
      </nav>
    </aside>
  );
}
