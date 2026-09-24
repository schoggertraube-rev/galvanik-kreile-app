"use client";

// App-Rahmen 1:1 aus der Owner-Mock-Bauvorlage (00_BIBEL/mock_extract/kreile/rolf_home + rolf_home_tablet).
// Markup und Klassen stammen unveraendert aus Vorlage.jsx; die Optik kommt ausschliesslich aus
// src/styles/mock/mock-kreile-rolf-home.css (Original-CSS, gescoped). Eigene Styles: keine.
// Navigation richtet sich nach dem Geraet (Owner G3), nicht nach der Rolle.

import { useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { requestGlobalCreate } from "@/components/layout/GlobalCreateFlow";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { MockIcons } from "./MockIcons";
import { MoreMenu } from "./MoreMenu";
import { FrameModeContext, type MockFrameMode } from "./MockFrameMode";


function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}
const readWidth = () => window.innerWidth;
const serverWidth = () => 1914;

/** Rahmen-Klassen wie im Mock (chooseReferenceFrame/mountOnlyReferenceFrame). */
export function frameClassForWidth(width: number): { mode: MockFrameMode; className: string } {
  if (width >= 1300) return { mode: "desktop", className: "frame desktop" };
  if (width < 600) return { mode: "tablet", className: "frame tablet touch phone mock-mobile" };
  if (width < 900) return { mode: "tablet", className: "frame tablet touch mock-portrait" };
  return { mode: "tablet", className: "frame tablet touch" };
}

function isCurrent(pathname: string, href: string): boolean {
  const path = href.split("?")[0];
  return path === "/" ? pathname === "/" : pathname.startsWith(path);
}

function Icon({ id }: { id: string }) {
  return (
    <svg className="i" aria-hidden="true">
      <use href={`#${id}`}></use>
    </svg>
  );
}

function useNavigationAccess() {
  const permissions = usePermissions();
  const complete =
    permissions.loading === false &&
    permissions.status === "authenticated" &&
    permissions.error === null &&
    typeof permissions.role === "string" &&
    Array.isArray(permissions.permissions) &&
    typeof permissions.hasPermission === "function";
  if (!complete) return { visible: false, finance: false, initials: "" };
  const rolfProfile = permissions.role === "meister" || permissions.role === "buero";
  const supported = rolfProfile || permissions.role === "werkstatt";
  const has = (capability: string) =>
    permissions.permissions.includes(capability) && permissions.hasPermission(capability);
  const visible = supported && has("perm_view_leitstand") && has("perm_view_customers");
  return { visible, finance: rolfProfile || has("perm_view_prices"), initials: permissions.initials || "" };
}

function subscribeClock(onChange: () => void) {
  const timer = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(timer);
}
const readMinute = () => Math.floor(Date.now() / 60_000);
const serverMinute = () => null;

function useBerlinClock() {
  const minute = useSyncExternalStore(subscribeClock, readMinute, serverMinute);
  if (minute === null) return null;
  const now = new Date(minute * 60_000);
  const day = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit" })
    .format(now).replace(".,", ",");
  const time = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(now);
  return { day, time };
}

const AREAS = [
  { href: "/", label: "Der Tag", icon: "i-sun", home: true },
  { href: "/warendurchlauf", label: "Werkstatt", icon: "i-flask" },
  { href: "/orders", label: "Aufträge", icon: "i-list" },
  { href: "/customers", label: "Kunden & Kontakt", icon: "i-users" },
  { href: "/buchhaltung/rechnungen", label: "Geld & Rechnungen", icon: "i-euro", finance: true },
] as const;

const DOCK = [
  { href: "/", label: "Der Tag", icon: "i-sun" },
  { href: "/orders", label: "Aufträge", icon: "i-list" },
  { href: "/customers", label: "Kunden", icon: "i-users" },
  { href: "/buchhaltung/rechnungen", label: "Geld", icon: "i-euro" },
] as const;

export function MockAppFrame({ children }: { children: React.ReactNode }) {
  const width = useSyncExternalStore(subscribe, readWidth, serverWidth);
  const { mode, className } = frameClassForWidth(width);
  const pathname = usePathname();
  const router = useRouter();
  const access = useNavigationAccess();
  const clock = useBerlinClock();
  const [moreOpen, setMoreOpen] = useState(false);
  const go = (href: string) => router.push(href);

  const avatar = (
    <button className="avatar" type="button" aria-label="Mehr öffnen" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}
      style={mode === "tablet" ? { width: "36px", height: "36px" } : undefined}>
      {access.initials || "K"}
      {mode === "desktop" ? (
        <span className="cv">
          <Icon id="i-chev" />
        </span>
      ) : null}
    </button>
  );

  return (
    <FrameModeContext.Provider value={mode}>
      <div style={{ height: "100dvh" }}>
        <div className="mock-kreile-rolf-home" style={{ "--serif": "var(--font-fraunces), Georgia, serif", "--sans": "var(--font-inter), system-ui, -apple-system, \"Segoe UI\", sans-serif" } as React.CSSProperties}>
          <MockIcons />
          {mode === "desktop" ? (
            <div className={className}>
              <div className="stripe"></div>
              <div className="shell">
                <div className="topbar">
                  <button className="brand" title="Der Tag — Start" type="button" aria-label="Kreile Startseite" onClick={() => go("/")}>
                    <div className="logo">GK</div>
                    <div>
                      <div className="brand-name">KREILE</div>
                      <div className="brand-home">▸ Der Tag</div>
                    </div>
                  </button>
                  {/* Suchfeld bewusst weggelassen: Suche nicht angebunden (Owner G7). */}
                  <div className="tb-date" style={{ marginLeft: "auto" }}>
                    {clock ? (
                      <>
                        <b>{clock.day}</b>
                        <br />
                        {clock.time} Uhr
                      </>
                    ) : null}
                  </div>
                  {avatar}
                </div>
                <nav className="side scroll" aria-label="Hauptnavigation">
                  {access.visible ? (
                    <>
                      <div className="nav-label">Schnellaktionen</div>
                      <button className="nav primary" type="button" onClick={() => requestGlobalCreate("DIRECT_INTAKE")}>
                        <Icon id="i-inbox" />
                        <span className="lbl">Neuer Eingang</span>
                      </button>
                      <button className="nav" type="button" data-href="/orders?station=fertig" onClick={() => go("/orders?station=fertig")}>
                        <Icon id="i-truck" />
                        <span className="lbl">Ware raus</span>
                      </button>
                      <div className="nav-div"></div>
                      <div className="nav-label">Bereiche</div>
                      {AREAS.filter((area) => !("finance" in area) || access.finance).map((area) => {
                        const active = isCurrent(pathname, area.href);
                        return (
                          <button key={area.href} type="button" data-href={area.href} aria-current={active ? "page" : undefined}
                            className={`nav${"home" in area ? " home" : ""}${active ? " active" : ""}`} onClick={() => go(area.href)}>
                            <Icon id={area.icon} />
                            <span className="lbl">{area.label}</span>
                            {"home" in area ? <span className="pin" aria-hidden="true">⌂</span> : null}
                          </button>
                        );
                      })}
                      <div className="nav-bottom nav-div"></div>
                      <div className="nav-label">Weiteres</div>
                      <button type="button" data-href="/settings" aria-current={isCurrent(pathname, "/settings") ? "page" : undefined}
                        className={`nav${isCurrent(pathname, "/settings") ? " active" : ""}`} onClick={() => go("/settings")}>
                        <Icon id="i-settings" />
                        <span className="lbl">Einstellungen</span>
                      </button>
                    </>
                  ) : null}
                </nav>
                <main className="content scroll">{children}</main>
              </div>
            </div>
          ) : (
            <div className={className}>
              <div className="stripe"></div>
              <div className="tshell">
                <div className="ttop">
                  <button className="logo" type="button" aria-label="Kreile Startseite" onClick={() => go("/")}>GK</button>
                  {/* Suchfeld bewusst weggelassen: Suche nicht angebunden (Owner G7). */}
                  <span style={{ marginLeft: "auto" }} />
                  {avatar}
                </div>
                <main className="tcontent scroll">{children}</main>
                {access.visible ? (
                  <nav className="dock" aria-label="Mobile Hauptnavigation">
                    {DOCK.map((item) => {
                      const active = isCurrent(pathname, item.href);
                      return (
                        <button key={item.href} type="button" data-href={item.href} aria-current={active ? "page" : undefined}
                          className={`dk${active ? " active" : ""}`} onClick={() => go(item.href)}>
                          <Icon id={item.icon} />
                          {item.label}
                        </button>
                      );
                    })}
                    <button className="dk" type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}>
                      <Icon id="i-grid" />
                      Mehr
                    </button>
                  </nav>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
      <MoreMenu open={moreOpen} onClose={() => setMoreOpen(false)} />
    </FrameModeContext.Provider>
  );
}
