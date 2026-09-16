"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, Menu, PackageCheck, ReceiptText, Settings, Users, X } from "lucide-react";
import { useState } from "react";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import styles from "./TargetShell.module.css";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { role } = usePermissions();
  const [open, setOpen] = useState(false);
  const invoices = role === "buero" || role === "meister";
  const settings = role === "admin" || role === "developer";
  const link = (href: string, label: string, Icon: typeof Home) => <Link href={href} prefetch={false} aria-current={href === "/" ? pathname === "/" ? "page" : undefined : pathname.startsWith(href) ? "page" : undefined}><Icon aria-hidden="true" /><span>{label}</span></Link>;

  return (
    <>
      <nav className={styles.mobileDock} aria-label="Mobile Hauptnavigation">
        {link("/", "Der Tag", Home)}
        {link("/orders", "Aufträge", ClipboardList)}
        {link("/customers", "Kunden", Users)}
        {invoices ? link("/buchhaltung/rechnungen", "Geld", ReceiptText) : null}
        <button type="button" onClick={() => setOpen(true)} aria-expanded={open}><Menu aria-hidden="true" /><span>Mehr</span></button>
      </nav>
      {open ? <div className={styles.moreBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className={styles.moreSheet} role="dialog" aria-modal="true" aria-label="Weitere Kernbereiche"><button type="button" className={styles.moreClose} onClick={() => setOpen(false)} aria-label="Schließen"><X /></button><Link href="/warendurchlauf" prefetch={false} onClick={() => setOpen(false)}><PackageCheck />Werkstatt</Link>{settings ? <Link href="/settings" prefetch={false} onClick={() => setOpen(false)}><Settings />Einstellungen</Link> : null}</section></div> : null}
    </>
  );
}
