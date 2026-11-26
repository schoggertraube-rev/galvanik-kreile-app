"use client";

import Link from "next/link";
import { Inbox, LogOut } from "lucide-react";
import { useEffect,useRef,useState,type MouseEvent,type ReactNode } from "react";
import { usePathname,useRouter } from "next/navigation";
import { logoutWithReadCleanup } from "@/lib/offline/logoutWithReadCleanup";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { requestGlobalCreate } from "./GlobalCreateFlow";
import { Dialog, Icon } from '@/ui/kr';
import { GlasNavigationsSymbol } from '@/ui/kr/design-final/Glasnavigation';
import type { NavigationsEintrag } from '@/ui/navigation/register';
import styles from "./TargetShell.module.css";

export function MoreMenu({ open, oeffner, onClose, ziele, werkzeuge, amDock }: {
  open: boolean; oeffner?: HTMLButtonElement; onClose: () => void; ziele?: readonly NavigationsEintrag[]; werkzeuge?: ReactNode; amDock?: boolean;
}) {
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
  const closeIfCurrentRoute = (href: string, cancel: () => void) => {
    if (new URL(href, window.location.href).href !== window.location.href) return false;
    cancel();
    onClose();
    return true;
  };
  const nativeLink = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const {href} = event.currentTarget;
    if (!closeIfCurrentRoute(href, () => event.preventDefault()) && amDock) {
      // Die Seite tritt an die Stelle des geöffneten Blatts im Browserverlauf.
      event.preventDefault();
      window.location.replace(href);
    }
  };

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

  const zielStil = amDock ? styles.moreDockTile : styles.moreTile;
  const erfassen = hasPermission("perm_data_orders") && (!amDock || !hasArea("eingang")) && (
    <button type="button" className={styles.moreTile} onClick={() => { onClose(); requestGlobalCreate("DIRECT_INTAKE"); }}>
      <Inbox aria-hidden="true" /><strong>Neu erfassen</strong>
    </button>
  );
  const abmelden = <button type="button" className={styles.moreTile} onClick={() => void signOut()} disabled={busy}>
    <LogOut aria-hidden="true" /><strong>Abmelden</strong>
  </button>;

  return (
    <Dialog titel="Mehr" icon="grid" oeffner={oeffner} onSchliessen={onClose} beschaeftigt={busy} amDock={amDock}>
        <div className={amDock ? styles.moreDockGrid : styles.moreGrid}>
          {hasArea("mails") ? <a className={zielStil} data-spec-id="navigation.nachrichten" href="/nachrichten" onClick={nativeLink}>
            <GlasNavigationsSymbol bereich="nachrichten" /><strong>Nachrichten</strong>
          </a> : null}
          {!amDock && erfassen}
          {!amDock && hasPermission("perm_view_leitstand") ? <Link className={zielStil} href="/warendurchlauf" prefetch={false} onNavigate={event=>{closeIfCurrentRoute('/warendurchlauf',event.preventDefault);}}>
            <GlasNavigationsSymbol bereich="werkstatt" /><strong>Werkstatt</strong>
          </Link> : null}
          {ziele?.map(ziel => {
            const props = {className: zielStil, 'data-spec-id': `navigation.${ziel.id}`, href: ziel.route};
            const inhalt = <><GlasNavigationsSymbol bereich={ziel.id} ersatz={<Icon name={ziel.icon}/>} /><strong>{ziel.text}</strong></>;
            return amDock
              ? <a key={ziel.id} {...props} onClick={nativeLink}>{inhalt}</a>
              : <Link key={ziel.id} {...props} prefetch={false} onNavigate={event => {closeIfCurrentRoute(ziel.route,() => event.preventDefault());}}>{inhalt}</Link>;
          })}
          {settingsVisible ? (
            <a className={zielStil} data-spec-id="navigation.einstellungen" href="/settings" onClick={nativeLink}>
              <GlasNavigationsSymbol bereich="einstellungen" /><strong>Einstellungen</strong>
            </a>
          ) : null}
          {!amDock && abmelden}
          {!amDock && werkzeuge}
        </div>
        {amDock && <div className={styles.moreDockAktionen}>
          {werkzeuge}{erfassen}{abmelden}
        </div>}
    </Dialog>
  );
}
