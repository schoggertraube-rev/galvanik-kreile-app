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
  const { role, status } = usePermissions();
  const [busy, setBusy] = useState(false);
  const supportedProfile = status === "authenticated" && (role === "meister" || role === "buero" || role === "werkstatt");

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
          <button type="button" className={styles.moreTile} onClick={() => { onClose(); requestGlobalCreate("DIRECT_INTAKE"); }}>
            <Inbox aria-hidden="true" /><strong>Infos rein</strong>
          </button>
          <Link className={styles.moreTile} href="/warendurchlauf" prefetch={false} onNavigate={onClose}>
            <PackageCheck aria-hidden="true" /><strong>Werkstatt</strong>
          </Link>
          <Link className={styles.moreTile} href="/settings" prefetch={false} onNavigate={onClose}>
            <Settings aria-hidden="true" /><strong>Einstellungen</strong>
          </Link>
          <button type="button" className={styles.moreTile} onClick={() => void signOut()} disabled={busy}>
            <LogOut aria-hidden="true" /><strong>Abmelden</strong>
          </button>
        </div>
      </section>
    </div>
  );
}
