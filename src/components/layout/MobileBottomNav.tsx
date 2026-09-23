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
  const { role } = permissions;
  const status = permissions.status ?? (role ? "authenticated" : "unauthenticated");
  const loading = permissions.loading ?? false;
  const hasPermission = typeof permissions.hasPermission === "function"
    ? permissions.hasPermission
    : (permission: string) => {
        if (permission === "perm_sys_diag") return role === "admin" || role === "developer";
        if (permission === "perm_view_customers") return role === "buero" || role === "meister" || role === "readonly";
        return permission === "perm_view_leitstand" && role !== null;
      };
  const [open, setOpen] = useState(false);
  if (loading || status !== "authenticated" || !role) return null;

  const operationalProfile = role === "buero" || role === "meister" || role === "readonly";
  const day = operationalProfile && hasPermission("perm_view_leitstand");
  const customers = operationalProfile && hasPermission("perm_view_customers");
  const invoices = (role === "buero" || role === "meister") && hasPermission("perm_view_leitstand");
  const workshop = day;
  const settings = (role === "admin" || role === "developer") && hasPermission("perm_sys_diag");
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
