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
  const permissions = usePermissions();
  const completeSnapshot =
    permissions.loading === false &&
    permissions.status === "authenticated" &&
    permissions.error === null &&
    typeof permissions.role === "string" &&
    permissions.role.length > 0 &&
    Array.isArray(permissions.permissions) &&
    permissions.permissions.every((permission) => typeof permission === "string") &&
    typeof permissions.name === "string" &&
    typeof permissions.initials === "string" &&
    typeof permissions.hasPermission === "function" &&
    typeof permissions.refreshPermissions === "function";

  if (!completeSnapshot) return null;

  const { role } = permissions;
  const hasCapability = (capability: string) =>
    permissions.permissions.includes(capability) && permissions.hasPermission(capability);

  const operationalProfile = role === "buero" || role === "meister" || role === "readonly" || role === "werkstatt";
  const day = operationalProfile && hasCapability("perm_view_leitstand");
  const customers = operationalProfile && hasCapability("perm_view_customers");
  const invoices = (role === "buero" || role === "meister") && hasCapability("perm_view_leitstand");
  const settings = (role === "admin" || role === "developer") && hasCapability("perm_sys_diag");
  const links = CORE.filter(({ href }) => {
    if (href === "/customers") return customers;
    return day;
  });

  if (links.length === 0 && !invoices && !settings) return null;
  return (
    <aside className={styles.sidebar}>
      <nav aria-label="Hauptnavigation">
        {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} prefetch={false} aria-current={current(pathname, href) ? "page" : undefined}><Icon aria-hidden="true" /><span>{label}</span></Link>)}
        {invoices ? <Link href="/buchhaltung/rechnungen" prefetch={false} aria-current={pathname.startsWith("/buchhaltung/rechnungen") ? "page" : undefined}><ReceiptText aria-hidden="true" /><span>Geld &amp; Rechnungen</span></Link> : null}
        {settings ? <Link href="/settings" prefetch={false} aria-current={pathname.startsWith("/settings") ? "page" : undefined}><Settings aria-hidden="true" /><span>Einstellungen</span></Link> : null}
      </nav>
    </aside>
  );
}
