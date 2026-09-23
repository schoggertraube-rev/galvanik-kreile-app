"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, Menu, PackageCheck, ReceiptText, Settings, Users, X } from "lucide-react";
import { useState } from "react";
import { usePermissions } from "@/lib/auth/PermissionsContext";
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

  const { role } = permissions;
  const hasCapability = (capability: string) =>
    permissions.permissions.includes(capability) && permissions.hasPermission(capability);

  const operationalProfile = role === "buero" || role === "meister" || role === "readonly" || role === "werkstatt";
  const day = operationalProfile && hasCapability("perm_view_leitstand");
  const customers = operationalProfile && hasCapability("perm_view_customers");
  const invoices = (role === "buero" || role === "meister") && hasCapability("perm_view_leitstand");
  const workshop = day;
  const settings = (role === "admin" || role === "developer") && hasCapability("perm_sys_diag");
  const link = (href: string, label: string, Icon: typeof Home) => <Link href={href} prefetch={false} aria-current={href === "/" ? pathname === "/" ? "page" : undefined : pathname.startsWith(href) ? "page" : undefined}><Icon aria-hidden="true" /><span>{label}</span></Link>;

  if (!day && !customers && !invoices && !workshop && !settings) return null;

  return (
    <>
      <nav className={styles.mobileDock} aria-label="Mobile Hauptnavigation">
        {day ? link("/", "Der Tag", Home) : null}
        {day ? link("/orders", "Aufträge", ClipboardList) : null}
        {customers ? link("/customers", "Kunden", Users) : null}
        {invoices ? link("/buchhaltung/rechnungen", "Geld", ReceiptText) : null}
        <button type="button" onClick={() => setOpen(true)} aria-expanded={open}><Menu aria-hidden="true" /><span>Mehr</span></button>
      </nav>
      {open ? <div className={styles.moreBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className={styles.moreSheet} role="dialog" aria-modal="true" aria-label="Weitere Kernbereiche"><button type="button" className={styles.moreClose} onClick={() => setOpen(false)} aria-label="Schließen"><X /></button>{workshop ? <Link href="/warendurchlauf" prefetch={false} onClick={() => setOpen(false)}><PackageCheck />Werkstatt</Link> : null}{settings ? <Link href="/settings" prefetch={false} onClick={() => setOpen(false)}><Settings />Einstellungen</Link> : null}</section></div> : null}
    </>
  );
}
