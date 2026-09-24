"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, Menu, PackageCheck, ReceiptText, Users } from "lucide-react";
import { useState } from "react";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { MoreMenu } from "./TargetHeader";
import styles from "./TargetShell.module.css";

export function MobileBottomNav() {
  const pathname = usePathname();
  const permissions = usePermissions();
  const [open, setOpen] = useState(false);
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
      aria-current={href === "/" ? (pathname === "/" ? "page" : undefined) : (pathname.startsWith(href) ? "page" : undefined)}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );

  return (
    <>
      <nav className={styles.mobileDock} aria-label="Mobile Hauptnavigation">
        {link("/", "Der Tag", Home)}
        {link("/orders", "Aufträge", ClipboardList)}
        {link("/customers", "Kunden", Users)}
        {canViewFinance
          ? link("/buchhaltung/rechnungen", "Geld", ReceiptText)
          : link("/warendurchlauf", "Werkstatt", PackageCheck)}
        <button type="button" onClick={() => setOpen(true)} aria-expanded={open}>
          <Menu aria-hidden="true" />
          <span>Mehr</span>
        </button>
      </nav>
      <MoreMenu open={open} onClose={() => setOpen(false)} />
    </>
  );
}
