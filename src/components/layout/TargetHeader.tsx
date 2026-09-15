"use client";

import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import styles from "./TargetShell.module.css";

export function TargetHeader({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { role, name, initials } = usePermissions();
  const responsibility = role === "meister"
    ? "Meister"
    : role === "werkstatt"
      ? "Werkstatt"
      : role === "admin" || role === "developer"
        ? "Systemadministrator"
        : "Sitzung";
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try { await logout(); } finally { router.replace("/start"); router.refresh(); }
  };

  return (
    <header className={`${styles.header} ${compact ? styles.compactHeader : ""}`}>
      <Link href="/" className={styles.brand} aria-label="Kreile Startseite">
        <Image src="/assets/logo/kreile-wordmark-skyline.svg" alt="Galvanik Kreile" width={190} height={68} priority unoptimized />
      </Link>
      <div className={styles.identity}>
        <span className={styles.identityCopy}><strong>{name || "Angemeldet"}</strong><small>{responsibility}</small></span>
        <span className={styles.initials} aria-hidden="true">{initials || "K"}</span>
        <button type="button" onClick={() => void signOut()} disabled={busy} aria-label="Abmelden"><LogOut aria-hidden="true" /></button>
      </div>
    </header>
  );
}
