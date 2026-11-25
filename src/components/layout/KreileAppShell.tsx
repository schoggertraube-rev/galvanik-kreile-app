"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AppShell,
  GlobalesPlus,
  KrApp,
  SuchKopf,
  type Bereich,
  type Geraet,
} from "@/ui/kr";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { SessionWarningBanner } from "./SessionWarningBanner";
import { EntityOverlayStack } from "./EntityOverlayStack";
import { GlobalSearch } from "./GlobalSearch";
import { MoreMenu } from "./MoreMenu";
import { requestGlobalCreate } from "./GlobalCreateFlow";
import styles from "./TargetShell.module.css";
import {WasIstNeu} from './WasIstNeu';
import {DeviceStandStatus} from '@/lib/offline/DeviceStandStatus';
import {NAVIGATION} from '@/ui/navigation/register';
import {ORDER_WEEK_ROUTE} from '@/ui/navigation/orders';

function readDevice(): Geraet {
  if (window.innerWidth < 768) return "handy";
  if (window.innerWidth < 1280) return "tablet";
  return "desktop";
}

function subscribeDevice(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
  };
}

const readServerDevice = (): Geraet => "desktop";
const readNavigationRail = () => window.innerWidth >= 1024;
const readServerNavigationRail = () => true;

function areaForPath(pathname: string): Bereich {
  return NAVIGATION.find(entry=>entry.pfad!==null&&pathname.startsWith(entry.pfad))?.id
    ?? NAVIGATION.find(entry=>entry.pfad===null)!.id;
}

const ROUTES: Record<Bereich,string> = Object.fromEntries(NAVIGATION.map(entry=>[entry.id,entry.route])) as Record<Bereich,string>;

function berlinDate() {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date());
}

export function KreileAppShell({ children, globalCreate,loginHandle,vorfinalStyle=false }: { children: React.ReactNode; globalCreate?: React.ReactNode;loginHandle?:string;vorfinalStyle?:boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const permissions = usePermissions();
  const device = useSyncExternalStore(subscribeDevice, readDevice, readServerDevice);
  const navigationRail = useSyncExternalStore(subscribeDevice, readNavigationRail, readServerNavigationRail);
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const loginOnly = pathname === "/start" || pathname === "/login";
  const sessionInvalid = !permissions.loading && permissions.status !== "authenticated";

  if (loginOnly) return <div className={styles.loginRoot}>{children}</div>;

  const financial=(['preise','zahlungen','buchhaltung'] as const).some(area=>permissions.hasArea(area));
  const workshop = permissions.hasArea("auftraege")
    && !financial
    && !permissions.hasArea("einstellungen");
  const canUseShell = permissions.status === "authenticated";
  const canCreate = permissions.hasArea("eingang");
  const hidden: Bereich[] = [];
  if (!permissions.hasArea("mails")) hidden.push("nachrichten");
  if (!permissions.hasPermission("perm_view_leitstand")) hidden.push("werkstatt", "auftraege");
  if (!permissions.hasPermission("perm_view_customers")) hidden.push("kunden");
  // This existing destination is the price-protected outgoing invoice list.
  if (!permissions.hasPermission("perm_view_prices")) hidden.push("geld");
  if (!permissions.hasPermission("perm_sys_toggles") && !permissions.hasPermission("perm_sys_users") && !permissions.hasPermission("perm_sys_diag")) hidden.push("einstellungen");

  const go = (target: Bereich | "mehr") => {
    if (target === "mehr") {
      setMoreOpen(true);
      return;
    }
    // Enter messages/settings as a complete document. WebKit can receive Flight
    // response without committing the client transition after repeated visits.
    if (target === "einstellungen" || target === "nachrichten") {
      window.location.assign(ROUTES[target]);
      return;
    }
    router.push(ROUTES[target]);
  };

  const news = canUseShell && loginHandle ? <WasIstNeu key={loginHandle} loginHandle={loginHandle} geraet={device} onNavigate={path=>{
    if(path==='rein'){requestGlobalCreate();return true;}
    if(path==='/nachrichten'){const event=new CustomEvent('kreile:oeffne',{cancelable:true,detail:{ziel:'nachrichten'}});return !window.dispatchEvent(event);}
    router.push(path);return true;
  }}/> : null;
  const menuTargets = NAVIGATION.filter(entry => !hidden.includes(entry.id)
    && !['tag', 'werkstatt', 'nachrichten', 'einstellungen'].includes(entry.id));
  const schliesseUndOeffne = (aktion: () => void) => () => {
    setMoreOpen(false);
    aktion();
  };
  const overlay = (werkstattWerkzeuge: ReactNode) => (
    <>
      <MoreMenu open={moreOpen} onClose={() => setMoreOpen(false)} ziele={menuTargets}
        werkzeuge={device === 'handy' ? (workshop ? werkstattWerkzeuge : news) : null} />
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );

  return (
    <>
      <SessionWarningBanner show={sessionInvalid} />
      <div style={{ height: "100dvh" }}>
        <KrApp geraet={device} vorfinal={vorfinalStyle}>
          <AppShell
          geraet={device}
          zustand={permissions.offline24h?<DeviceStandStatus/>:null}
          variante={workshop ? "werkstatt" : "buero"}
          navigationsleiste={navigationRail}
          aktiv={areaForPath(pathname)}
          kuerzel={permissions.initials || "K"}
          datum={berlinDate()}
          ausgeblendet={hidden}
          suche={canUseShell ? <SuchKopf onOeffnen={() => setSearchOpen(true)} /> : <span />}
          neuigkeiten={news}
          plus={canUseShell && canCreate ? (
            <GlobalesPlus
              onOeffnen={() => requestGlobalCreate()}
            />
          ) : <span />}
          onNav={go}
          onStart={() => router.push("/")}
          onKonto={() => setMoreOpen(true)}
          onNeuerEingang={permissions.hasArea("eingang") ? () => requestGlobalCreate() : undefined}
          onWareRaus={permissions.hasPermission("perm_op_status") ? schliesseUndOeffne(() => router.push("/orders?station=fertig")) : undefined}
          onAuftragOeffnen={permissions.hasPermission("perm_view_leitstand") ? () => router.push("/orders") : undefined}
          onPlanung={permissions.hasPermission("perm_view_leitstand") ? () => router.push(ORDER_WEEK_ROUTE) : undefined}
          onMehrarbeit={permissions.hasPermission("perm_op_status") ? schliesseUndOeffne(() => router.push("/warendurchlauf")) : undefined}
          onFertigMelden={permissions.hasPermission("perm_op_status") ? schliesseUndOeffne(() => router.push("/warendurchlauf")) : undefined}
          ebene={overlay}
          >
            {children}
          </AppShell>
          <EntityOverlayStack />
          {globalCreate}
        </KrApp>
      </div>
    </>
  );
}
