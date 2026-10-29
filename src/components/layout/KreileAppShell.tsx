"use client";

import { useState, useSyncExternalStore } from "react";
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

function readDevice(): Geraet {
  if (window.innerWidth <= 699) return "handy";
  if (window.innerWidth <= 1399 && window.matchMedia?.("(pointer: coarse)").matches) return "tablet";
  return "desktop";
}

function subscribeDevice(onChange: () => void) {
  const coarse = window.matchMedia?.("(pointer: coarse)");
  window.addEventListener("resize", onChange);
  coarse?.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    coarse?.removeEventListener("change", onChange);
  };
}

const readServerDevice = (): Geraet => "desktop";

function areaForPath(pathname: string): Bereich {
  if (pathname.startsWith("/warendurchlauf")) return "werkstatt";
  if (pathname.startsWith("/orders")) return "auftraege";
  if (pathname.startsWith("/customers")) return "kunden";
  if (pathname.startsWith("/buchhaltung/rechnungen")) return "geld";
  if (pathname.startsWith("/settings")) return "einstellungen";
  return "tag";
}

const ROUTES: Record<Bereich, string> = {
  tag: "/",
  werkstatt: "/warendurchlauf",
  auftraege: "/orders",
  kunden: "/customers",
  geld: "/buchhaltung/rechnungen",
  einstellungen: "/settings",
};

function berlinDate() {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date());
}

export function KreileAppShell({ children, globalCreate }: { children: React.ReactNode; globalCreate?: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const permissions = usePermissions();
  const device = useSyncExternalStore(subscribeDevice, readDevice, readServerDevice);
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const loginOnly = pathname === "/start" || pathname === "/login";
  const sessionInvalid = !permissions.loading && permissions.status !== "authenticated";

  if (loginOnly) return <div className={styles.loginRoot}>{children}</div>;

  const role = permissions.role?.toLowerCase() ?? "";
  const workshop = new Set(["werkstatt"]).has(role);
  const canUseShell = permissions.status === "authenticated";
  const canCreate = permissions.hasPermission("perm_data_customers") || permissions.hasPermission("perm_data_orders");
  const hidden: Bereich[] = [];
  if (!permissions.hasPermission("perm_view_leitstand")) hidden.push("werkstatt", "auftraege");
  if (!permissions.hasPermission("perm_view_customers")) hidden.push("kunden");
  if (!permissions.hasPermission("perm_view_prices")) hidden.push("geld");
  if (!permissions.hasPermission("perm_sys_toggles") && !permissions.hasPermission("perm_sys_users") && !permissions.hasPermission("perm_sys_diag")) hidden.push("einstellungen");

  const go = (target: Bereich | "mehr") => {
    if (target === "mehr") {
      setMoreOpen(true);
      return;
    }
    router.push(ROUTES[target]);
  };

  const overlay = (
    <>
      <MoreMenu open={moreOpen} onClose={() => setMoreOpen(false)} />
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );

  return (
    <>
      <SessionWarningBanner show={sessionInvalid} />
      <div style={{ height: "100dvh" }}>
        <KrApp geraet={device}>
          <AppShell
          geraet={device}
          variante={workshop ? "werkstatt" : "buero"}
          aktiv={areaForPath(pathname)}
          kuerzel={permissions.initials || "K"}
          datum={berlinDate()}
          ausgeblendet={hidden}
          suche={canUseShell ? <SuchKopf onOeffnen={() => setSearchOpen(true)} /> : <span />}
          plus={canUseShell && canCreate ? (
            <GlobalesPlus
              onKundeAnlegen={() => requestGlobalCreate("CUSTOMER")}
              onAuftragKv={() => requestGlobalCreate("DIRECT_INTAKE")}
            />
          ) : <span />}
          onNav={go}
          onStart={() => router.push("/")}
          onKonto={() => setMoreOpen(true)}
          onNeuerEingang={permissions.hasPermission("perm_data_orders") ? () => requestGlobalCreate("DIRECT_INTAKE") : undefined}
          onWareRaus={permissions.hasPermission("perm_op_status") ? () => router.push("/orders?station=fertig") : undefined}
          onAuftragOeffnen={permissions.hasPermission("perm_view_leitstand") ? () => router.push("/orders") : undefined}
          onMehrarbeit={permissions.hasPermission("perm_op_status") ? () => router.push("/warendurchlauf") : undefined}
          onFertigMelden={permissions.hasPermission("perm_op_status") ? () => router.push("/warendurchlauf") : undefined}
          ebene={overlay}
          >
            {children}
          </AppShell>
          <EntityOverlayStack />
        </KrApp>
      </div>
      {globalCreate}
    </>
  );
}
