"use client";

import Link from "next/link";
import { Inbox, LogOut, Mail, PackageCheck, Settings, X } from "lucide-react";
import { useEffect,useRef,useState } from "react";
import { usePathname,useRouter } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { requestGlobalCreate } from "./GlobalCreateFlow";
import styles from "./TargetShell.module.css";

export function MoreMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const pathname=usePathname();
  const openedAtPath=useRef(pathname);
  const { status, hasPermission, hasArea } = usePermissions();
  const [busy, setBusy] = useState(false);
  const settingsVisible = hasPermission("perm_sys_toggles") || hasPermission("perm_sys_users") || hasPermission("perm_sys_diag");
  const supportedProfile = status === "authenticated";

  // Keep links mounted until navigation commits. Messages/settings use native
  // document navigation because WebKit can receive Flight without committing it.
  useEffect(()=>{
    if(!open){openedAtPath.current=pathname;return;}
    if(pathname!==openedAtPath.current)onClose();
  },[pathname,open,onClose]);
  const closeIfCurrentRoute=(href:string)=>{if(pathname===href)onClose();};

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
          {hasArea("mails") ? <a className={styles.moreTile} data-spec-id="navigation.nachrichten" href="/nachrichten" onClick={event=>{if(pathname==='/nachrichten'){event.preventDefault();onClose();}}}>
            <Mail aria-hidden="true" /><strong>Nachrichten</strong>
          </a> : null}
          {hasPermission("perm_data_orders") ? <button type="button" className={styles.moreTile} onClick={() => { onClose(); requestGlobalCreate("DIRECT_INTAKE"); }}>
            <Inbox aria-hidden="true" /><strong>Neu erfassen</strong>
          </button> : null}
          {hasPermission("perm_view_leitstand") ? <Link className={styles.moreTile} href="/warendurchlauf" prefetch={false} onNavigate={()=>closeIfCurrentRoute('/warendurchlauf')}>
            <PackageCheck aria-hidden="true" /><strong>Werkstatt</strong>
          </Link> : null}
          {settingsVisible ? (
            <a className={styles.moreTile} href="/settings" onClick={event=>{if(pathname==='/settings'){event.preventDefault();onClose();}}}>
              <Settings aria-hidden="true" /><strong>Einstellungen</strong>
            </a>
          ) : null}
          <button type="button" className={styles.moreTile} onClick={() => void signOut()} disabled={busy}>
            <LogOut aria-hidden="true" /><strong>Abmelden</strong>
          </button>
        </div>
      </section>
    </div>
  );
}
