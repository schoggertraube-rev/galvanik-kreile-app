"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, PackageCheck, ReceiptText, Settings, Users } from "lucide-react";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import styles from "./TargetShell.module.css";

const CORE = [
  { href: "/", label: "Der Tag", icon: Home },
  { href: "/warendurchlauf", label: "Werkstatt", icon: PackageCheck },
  { href: "/orders", label: "Aufträge", icon: ClipboardList },
  { href: "/customers", label: "Kunden & Kontakt", icon: Users },
] as const;

function current(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function TargetNavigation() {
  const pathname = usePathname();
  const { role } = usePermissions();
  const invoices = role === "buero" || role === "meister" || role === "admin";
  const settings = role === "admin" || role === "developer";
  return (
    <aside className={styles.sidebar}>
      <nav aria-label="Hauptnavigation">
        {CORE.map(({ href, label, icon: Icon }) => <Link key={href} href={href} prefetch={false} aria-current={current(pathname, href) ? "page" : undefined}><Icon aria-hidden="true" /><span>{label}</span></Link>)}
        {invoices ? <Link href="/buchhaltung/rechnungen" prefetch={false} aria-current={pathname.startsWith("/buchhaltung/rechnungen") ? "page" : undefined}><ReceiptText aria-hidden="true" /><span>Geld &amp; Rechnungen</span></Link> : null}
        {settings ? <Link href="/settings" prefetch={false} aria-current={pathname.startsWith("/settings") ? "page" : undefined}><Settings aria-hidden="true" /><span>Einstellungen</span></Link> : null}
      </nav>
    </aside>
  );
}
