"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Home,
  Inbox,
  PackageCheck,
  ReceiptText,
  Settings,
  Truck,
  Users,
} from "lucide-react";
import { requestGlobalCreate } from "@/components/layout/GlobalCreateFlow";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import styles from "./TargetShell.module.css";

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

  const rolfProfile = permissions.role === "meister" || permissions.role === "buero";
  const supportedProfile = rolfProfile || permissions.role === "werkstatt";
  const hasCapability = (capability: string) =>
    permissions.permissions.includes(capability) && permissions.hasPermission(capability);
  const hasCoreNavigation =
    supportedProfile &&
    hasCapability("perm_view_leitstand") &&
    hasCapability("perm_view_customers");

  if (!hasCoreNavigation) return null;

  const canViewFinance = rolfProfile || hasCapability("perm_view_prices");

  const link = (href: string, label: string, Icon: typeof Home) => (
    <Link
      href={href}
      prefetch={false}
      aria-current={current(pathname, href) ? "page" : undefined}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );

  return (
    <aside className={styles.sidebar}>
      <nav aria-label="Hauptnavigation">
        <span className={styles.navLabel}>Schnellaktionen</span>
        <button type="button" onClick={() => requestGlobalCreate("DIRECT_INTAKE")}>
          <Inbox aria-hidden="true" />
          <span>Neuer Eingang</span>
        </button>
        {link("/orders?station=fertig", "Ware raus", Truck)}
        <span className={styles.navDivider} aria-hidden="true" />
        <span className={styles.navLabel}>Bereiche</span>
        {link("/", "Der Tag", Home)}
        {link("/warendurchlauf", "Werkstatt", PackageCheck)}
        {link("/orders", "Aufträge", ClipboardList)}
        {link("/customers", "Kunden & Kontakt", Users)}
        {canViewFinance ? link("/buchhaltung/rechnungen", "Geld & Rechnungen", ReceiptText) : null}
        <span className={`${styles.navDivider} ${styles.navBottom}`} aria-hidden="true" />
        <span className={styles.navLabel}>Weiteres</span>
        {link("/settings", "Einstellungen", Settings)}
      </nav>
    </aside>
  );
}
