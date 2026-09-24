"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Inbox, LogOut, PackageCheck, Search, Settings, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { requestGlobalCreate } from "./GlobalCreateFlow";
import { GlobalSearch } from "./GlobalSearch";
import styles from "./TargetShell.module.css";

export function MoreMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { role, status } = usePermissions();
  const [busy, setBusy] = useState(false);
  const supportedProfile =
    status === "authenticated" &&
    (role === "meister" || role === "buero" || role === "werkstatt");

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
    <div
      className={styles.moreBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className={styles.moreSheet} role="dialog" aria-modal="true" aria-labelledby="more-title">
        <header className={styles.moreHeader}>
          <div>
            <h2 id="more-title">Mehr</h2>
            <p>Seltene Funktionen eine Ebene tiefer.</p>
          </div>
          <button type="button" className={styles.moreClose} onClick={onClose} aria-label="Schließen">
            <X aria-hidden="true" />
          </button>
        </header>
        <div className={styles.moreGrid}>
          <button
            type="button"
            className={styles.moreTile}
            onClick={() => {
              onClose();
              requestGlobalCreate("DIRECT_INTAKE");
            }}
          >
            <Inbox aria-hidden="true" />
            <span><strong>Infos rein</strong><small>Kunde oder Auftrag erfassen</small></span>
          </button>
          <Link className={styles.moreTile} href="/warendurchlauf" prefetch={false} onNavigate={onClose}>
            <PackageCheck aria-hidden="true" />
            <span><strong>Werkstatt</strong><small>Arbeit und Übergaben öffnen</small></span>
          </Link>
          <Link className={styles.moreTile} href="/settings" prefetch={false} onNavigate={onClose}>
            <Settings aria-hidden="true" />
            <span><strong>Einstellungen</strong><small>Profil und Anwendung</small></span>
          </Link>
          <button type="button" className={styles.moreTile} onClick={() => void signOut()} disabled={busy}>
            <LogOut aria-hidden="true" />
            <span><strong>Abmelden</strong><small>Sitzung sicher beenden</small></span>
          </button>
        </div>
      </section>
    </div>
  );
}

export function TargetHeader({ compact = false }: { compact?: boolean }) {
  const { role, name, initials } = usePermissions();
  const responsibility = role === "meister"
    ? "Meister"
    : role === "werkstatt"
      ? "Werkstatt"
      : role === "buero"
        ? "Büro"
        : role === "admin" || role === "developer"
          ? "Systemadministrator"
          : "Sitzung";
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <header className={`${styles.header} ${compact ? styles.compactHeader : ""}`}>
      <Link href="/" prefetch={false} className={styles.brand} aria-label="Kreile Startseite">
        <Image src="/assets/logo/kreile-wordmark-skyline.svg" alt="Galvanik Kreile" width={190} height={68} priority unoptimized />
      </Link>
      <div className={styles.headerActions}>
        <button aria-label="Suche öffnen" className={styles.searchButton} onClick={() => setSearchOpen(true)} type="button">
          <Search aria-hidden="true" />
          <span>Suchen</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div className={styles.identity}>
          <span className={styles.identityCopy}><strong>{name || "Angemeldet"}</strong><small>{responsibility}</small></span>
          <button
            type="button"
            className={styles.avatarButton}
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            aria-label="Mehr öffnen"
          >
            <span className={styles.initials} aria-hidden="true">{initials || "K"}</span>
            <ChevronDown aria-hidden="true" />
          </button>
        </div>
      </div>
      <GlobalSearch onOpenChange={setSearchOpen} open={searchOpen} />
      <MoreMenu open={moreOpen} onClose={() => setMoreOpen(false)} />
    </header>
  );
}
