"use client";

import Link from "next/link";
import { Inbox, LogOut, PackageCheck, Settings, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { requestGlobalCreate } from "./GlobalCreateFlow";
import styles from "./TargetShell.module.css";

export function MoreMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { status, hasPermission } = usePermissions();
  const [busy, setBusy] = useState(false);
  const settingsVisible = hasPermission("perm_sys_toggles") || hasPermission("perm_sys_users") || hasPermission("perm_sys_diag");
  const supportedProfile = status === "authenticated";

  if (!open || !supportedProfile) return null;

  const signOut = async () => {
    setBusy(true);
    try {
      await logout();
    } finally {
      router.replace("/start");
      router.refresh();
    }
  };

  return (
    <div className={styles.moreBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={styles.moreSheet} role="dialog" aria-modal="true" aria-labelledby="more-title">
        <header className={styles.moreHeader}>
          <h2 id="more-title">Mehr</h2>
          <button type="button" className={styles.moreClose} onClick={onClose} aria-label="Schließen"><X aria-hidden="true" /></button>
        </header>
        <div className={styles.moreGrid}>
          {hasPermission("perm_data_orders") ? <button type="button" className={styles.moreTile} onClick={() => { onClose(); requestGlobalCreate("DIRECT_INTAKE"); }}>
            <Inbox aria-hidden="true" /><strong>Neu erfassen</strong>
          </button> : null}
          {hasPermission("perm_view_leitstand") ? <Link className={styles.moreTile} href="/warendurchlauf" prefetch={false} onNavigate={onClose}>
            <PackageCheck aria-hidden="true" /><strong>Werkstatt</strong>
          </Link> : null}
          {settingsVisible ? (
            <Link className={styles.moreTile} href="/settings" prefetch={false} onNavigate={onClose}>
              <Settings aria-hidden="true" /><strong>Einstellungen</strong>
            </Link>
          ) : null}
          <button type="button" className={styles.moreTile} onClick={() => void signOut()} disabled={busy}>
            <LogOut aria-hidden="true" /><strong>Abmelden</strong>
          </button>
        </div>
      </section>
    </div>
  );
}
