"use client";

import Link from "next/link";
import { Inbox, LogOut, Mail, PackageCheck, Settings } from "lucide-react";
import { useEffect,useRef,useState,type ReactNode } from "react";
import { usePathname,useRouter } from "next/navigation";
import { logoutWithReadCleanup } from "@/lib/offline/logoutWithReadCleanup";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { requestGlobalCreate } from "./GlobalCreateFlow";
import { Dialog, Icon } from '@/ui/kr';
import type { NavigationsEintrag } from '@/ui/navigation/register';
import styles from "./TargetShell.module.css";

export function MoreMenu({ open, onClose, ziele, werkzeuge }: { open: boolean; onClose: () => void; ziele?: readonly NavigationsEintrag[]; werkzeuge?: ReactNode }) {
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
      await logoutWithReadCleanup();
    } finally {
      router.replace("/start");
      router.refresh();
    }
  };

  return (
    <Dialog titel="Mehr" icon="grid" onSchliessen={onClose} beschaeftigt={busy}>
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
          {ziele?.map(ziel => <Link key={ziel.id} className={styles.moreTile} data-spec-id={`navigation.${ziel.id}`}
            href={ziel.route} prefetch={false} onNavigate={() => closeIfCurrentRoute(ziel.route)}>
            <Icon name={ziel.icon}/><strong>{ziel.text}</strong>
          </Link>)}
          {settingsVisible ? (
            <a className={styles.moreTile} href="/settings" onClick={event=>{if(pathname==='/settings'){event.preventDefault();onClose();}}}>
              <Settings aria-hidden="true" /><strong>Einstellungen</strong>
            </a>
          ) : null}
          <button type="button" className={styles.moreTile} onClick={() => void signOut()} disabled={busy}>
            <LogOut aria-hidden="true" /><strong>Abmelden</strong>
          </button>
          {werkzeuge}
        </div>
    </Dialog>
  );
}
