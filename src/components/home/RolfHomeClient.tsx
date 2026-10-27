"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { requestGlobalCreate } from "@/components/layout/GlobalCreateFlow";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { useOverlayStore } from "@/lib/overlayStore";
import type { OrdersHomeProjection, OrdersHomeSource } from "@/modules/orders/public";
import {
  Auftragszeile,
  Button,
  HandlungsListe,
  Kachel,
  Lageleiste,
  SeitenKopf,
  Terminzeile,
  Zeile,
  Zustand,
  type Geraet,
  type HandlungsArt,
  type Terminart,
} from "@/ui/kr";

type RolfIdentity = {
  role: "buero" | "meister" | "readonly";
  canCreateOrder: boolean;
};

export type RolfHomeModel =
  | ({ kind: "data"; projection: OrdersHomeProjection } & RolfIdentity)
  | ({ kind: "empty"; projection: OrdersHomeProjection } & RolfIdentity)
  | { kind: "denied"; message: string }
  | { kind: "error"; message: string };

const STATUS_LABELS: Record<string, string> = {
  angenommen: "Angenommen",
  wareneingang: "Angenommen",
  galvanik: "In Galvanik",
  fertig: "Fertig",
  raus: "Raus / abgeholt",
  abgeholt: "Raus / abgeholt",
  versendet: "Raus / abgeholt",
};

export function statusLabel(order: OrdersHomeSource): string {
  const status = order.statusText?.trim() || order.status;
  return STATUS_LABELS[status.toLowerCase()] ?? STATUS_LABELS[order.station.toLowerCase()] ?? "Status nicht hinterlegt";
}

export function dayGreeting(hour: number): string {
  if (hour < 12) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}

function berlinHour(now: Date): number {
  const hour = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "numeric", hourCycle: "h23" })
    .formatToParts(now).find((part) => part.type === "hour")?.value;
  return Number(hour ?? now.getHours());
}

export type DayLine = { salutation: string; urgent: number; other: number };

export function dayLineParts(orders: readonly OrdersHomeSource[], displayName: string, now = new Date()): DayLine {
  const firstName = displayName.trim().split(/\s+/)[0] || "Rolf";
  const urgent = orders.filter((order) => order.risk === "red" || order.risk === "blocked").length;
  return { salutation: `${dayGreeting(berlinHour(now))}, ${firstName}.`, urgent, other: orders.length - urgent };
}

function readDevice(): Geraet {
  if (window.innerWidth <= 699) return "handy";
  if (window.innerWidth <= 1399 && window.matchMedia?.("(pointer: coarse)").matches) return "tablet";
  return "desktop";
}

function subscribeDevice(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function actionType(order: OrdersHomeSource): HandlungsArt {
  if (order.risk === "red" || order.risk === "blocked") return "konflikt";
  if (order.risk === "yellow" || order.risk === "orange") return "warnung";
  return "entscheidung";
}

function rowTone(order: OrdersHomeSource): "ok" | "warn" | "rot" | "info" {
  if (order.risk === "red" || order.risk === "blocked") return "rot";
  if (order.risk === "yellow" || order.risk === "orange") return "warn";
  return order.station === "fertig" ? "ok" : "info";
}

function appointmentType(order: OrdersHomeSource): Terminart {
  const label = order.dueLabel.toLocaleLowerCase("de-DE");
  if (label.includes("wunsch")) return "Wunsch";
  if (label.includes("verschob")) return "verschoben";
  if (label.includes("abholung")) return "Abholung";
  return "bestätigt";
}

export function RolfHomeClient({ model }: { model: RolfHomeModel; now?: Date }) {
  const openOrder = useOverlayStore((state) => state.openOrder);
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const router = useRouter();
  const device = useSyncExternalStore(subscribeDevice, readDevice, () => "desktop" as const);
  const [filter, setFilter] = useState<HandlungsArt | "alle">("alle");

  if (model.kind === "denied" || model.kind === "error") {
    return <section data-testid="rolf-v11-home">
      <SeitenKopf titel="Der Tag" />
      <Zustand art={model.kind === "error" ? "fehler" : "gesperrt"} text={model.kind === "error" ? "Der Tagesbestand ist gerade nicht verfügbar." : "Du kannst den Tagesbestand nicht öffnen."} />
    </section>;
  }

  const { orders, priority, recent } = model.projection;
  const finished = orders.filter((order) => order.station === "fertig");
  const canWrite = model.role !== "readonly";
  const canStartOrder = canWrite && model.canCreateOrder && !permissionsLoading && hasPermission("perm_data_orders");
  const filteredPriority = filter === "alle" ? priority : priority.filter((order) => actionType(order) === filter);
  const counts = priority.reduce<Record<HandlungsArt, number>>((sum, order) => {
    sum[actionType(order)] += 1;
    return sum;
  }, { konflikt: 0, entscheidung: 0, warnung: 0 });
  const goodsOut = () => router.push("/orders?station=fertig");

  if (model.kind === "empty") {
    return <section data-testid="rolf-v11-home">
      <SeitenKopf titel="Der Tag" />
      {device !== "desktop" && canStartOrder ? <div className="kr-schnellleiste"><Button art="primaer" icon="inbox" text="Neuer Eingang" onClick={() => requestGlobalCreate("DIRECT_INTAKE")} /></div> : null}
      <Zustand art="leer" text="Noch keine Aufträge erfasst." aktion={canStartOrder ? { text: "Neuer Eingang", icon: "inbox", onClick: () => requestGlobalCreate("DIRECT_INTAKE") } : undefined} />
    </section>;
  }

  const actionEntries = filteredPriority.map((order) => ({
    key: order.id,
    art: actionType(order),
    id: order.orderNumber,
    titel: `${order.customerName ?? "Kunde nicht hinterlegt"} — ${order.detail ?? order.title}`,
    meta: `${statusLabel(order)} · ${order.dueLabel}: ${order.dueValue}`,
    aktionen: [{
      text: "Auftrag öffnen",
      kurz: "Öffnen",
      icon: "open" as const,
      art: "primaer" as const,
      onClick: () => openOrder(order.id),
    }],
    onOeffnen: () => openOrder(order.id),
  }));

  return <section data-testid="rolf-v11-home">
    <SeitenKopf titel="Der Tag" />
    {priority.length > 0 ? <Lageleiste zaehler={counts} filter={filter} onFilter={setFilter} gesund={[]} /> : null}
    <div className="kr-stapel">
      <HandlungsListe eintraege={actionEntries} geraet={device} max={device === "desktop" ? undefined : 3} fokus />
      {device !== "desktop" && (canStartOrder || canWrite) ? <div className="kr-schnellleiste">
        {canStartOrder ? <Button art="primaer" icon="inbox" text="Neuer Eingang" onClick={() => requestGlobalCreate("DIRECT_INTAKE")} /> : null}
        {canWrite ? <Button icon="truck" text="Ware raus" onClick={goodsOut} /> : null}
      </div> : null}
      <div className="kr-raster kr-raster--tag">
        <Kachel titel="Termine" icon="calendar" iconTon="info" zustand={orders.length ? "daten" : "leer"} texte={{ leerText: "Keine Termine im Auftragsbestand." }} fuss={{ text: "Woche ansehen", onClick: () => router.push("/orders") }}>
          {orders.slice(0, 4).map((order) => <Terminzeile key={order.id} zeit={order.dueLabel} art={appointmentType(order)} auftragNr={order.orderNumber} kundeKurz={order.customerName ?? "Kunde"} meta={order.dueValue} onOeffnen={() => openOrder(order.id)} />)}
        </Kachel>
        <Kachel titel="Heute raus" icon="truck" iconTon="ok" zahl={finished.length} zustand={finished.length ? "daten" : "leer"} texte={{ leerText: "Heute keine fertigen Aufträge." }} fuss={canWrite ? { text: "Ware raus öffnen", onClick: goodsOut } : undefined}>
          {finished.slice(0, 3).map((order) => <Auftragszeile key={order.id} id={order.orderNumber} kundeKurz={order.customerName ?? "Kunde"} titel={order.detail ?? order.title} meta={statusLabel(order)} ton={rowTone(order)} onOeffnen={() => openOrder(order.id)} />)}
        </Kachel>
        <div className="kr-stapel">
          <Kachel titel="Neu seit gestern" icon="inbox" iconTon="info" zahl={recent.length} zustand={recent.length ? "daten" : "leer"} texte={{ leerText: "Seit gestern keine neuen Aufträge." }}>
            {recent.slice(0, 3).map((order) => <Zeile key={order.id} punkt={rowTone(order)} id={order.orderNumber} titel={`${order.customerName ?? "Kunde"} · ${order.detail ?? order.title}`} meta={statusLabel(order)} seite={<span>{order.dueValue}</span>} onClick={() => openOrder(order.id)} />)}
          </Kachel>
        </div>
      </div>
    </div>
  </section>;
}
