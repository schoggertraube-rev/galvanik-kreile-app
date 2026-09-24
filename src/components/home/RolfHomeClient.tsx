"use client";

// Rolf-Startseite "Der Tag" 1:1 aus der Owner-Mock-Bauvorlage (mock_extract/kreile/rolf_home, rolf_home_tablet).
// Markup/Klassen aus Vorlage.jsx, Optik nur aus mock-kreile-rolf-home.css. Daten: echte OrdersHomeProjection.
// Owner G7: Elemente ohne echte Datenquelle/Aktion (Kuemmern, an Phillip, Spaeter, Erledigt-Bedingungen,
// Zaehler-Chips) sind weggelassen.

import { useRouter } from "next/navigation";
import { requestGlobalCreate } from "@/components/layout/GlobalCreateFlow";
import { useMockFrameMode } from "@/components/layout/MockFrameMode";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { useOverlayStore } from "@/lib/overlayStore";
import type { OrdersHomeProjection, OrdersHomeSource } from "@/modules/orders/public";

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

function DayLineView({ line }: { line: DayLine }) {
  const { salutation, urgent, other } = line;
  const otherText = other === 1 ? "weiterer braucht dich." : "weitere brauchen dich.";
  if (urgent === 0 && other === 0) return <div className="day-line">{salutation} Heute ist nichts offen.</div>;
  if (urgent === 0) return <div className="day-line">{salutation} <b>{other}</b> {other === 1 ? "braucht dich." : "brauchen dich."}</div>;
  return (
    <div className="day-line">
      {salutation}{" "}
      <span className="rp"><b>{urgent}</b> dringend</span>
      {other > 0 ? <>{" "}·{" "}<b>{other}</b> {otherText}</> : "."}
    </div>
  );
}

function Icon({ id }: { id: string }) {
  return (
    <svg className="i" aria-hidden="true">
      <use href={`#${id}`}></use>
    </svg>
  );
}

function priorityClass(order: OrdersHomeSource, index: number): string {
  if (order.risk === "red" || order.risk === "blocked") return index === 0 ? "pi crit hero" : "pi crit";
  if (order.risk === "orange" || order.risk === "yellow") return "pi soon";
  return "pi";
}

function OrderRows({ orders, onOpen }: { orders: readonly OrdersHomeSource[]; onOpen: (id: string) => void }) {
  return (
    <>
      {orders.slice(0, 3).map((order) => (
        <button key={order.id} className="row" type="button" aria-label={`Auftrag ${order.orderNumber} öffnen`} onClick={() => onOpen(order.id)}>
          <span className={`row-dot ${order.station === "fertig" ? "g" : "i"}`}></span>
          <div className="row-main">
            <div className="row-t">
              <span className="id">{order.orderNumber}</span>{" "}{order.customerName ?? "Kunde nicht hinterlegt"} · {order.detail ?? order.title}
            </div>
            <div className="row-s">{statusLabel(order)} · {order.dueLabel}: {order.dueValue}</div>
          </div>
        </button>
      ))}
    </>
  );
}

export function RolfHomeClient({ model, now }: { model: RolfHomeModel; now?: Date }) {
  const openOrder = useOverlayStore((state) => state.openOrder);
  const { hasPermission, loading: permissionsLoading, name } = usePermissions();
  const router = useRouter();
  const mode = useMockFrameMode();
  const titleClass = mode === "tablet" ? "day-title sm" : "day-title";

  if (model.kind === "denied" || model.kind === "error") {
    return (
      <section data-testid="rolf-v5-home" role={model.kind === "error" ? "alert" : "status"}>
        <h1 className={titleClass} style={{ margin: 0 }}>Der Tag</h1>
        <div className="day-line">
          {model.kind === "denied" ? "Du kannst den Tagesbestand nicht öffnen." : "Der Tagesbestand ist gerade nicht verfügbar."}
        </div>
      </section>
    );
  }

  const orders = model.projection.orders;
  const priority = model.projection.priority;
  const finished = orders.filter((order) => order.station === "fertig");
  const recent = model.projection.recent;
  const canWrite = model.role !== "readonly";
  const canStartOrder = canWrite && model.canCreateOrder && !permissionsLoading && hasPermission("perm_data_orders");
  const goodsOut = () => router.push("/orders?station=fertig");

  return (
    <section aria-labelledby="rolf-title" data-testid="rolf-v5-home">
      <h1 id="rolf-title" className={titleClass} style={{ margin: 0 }}>Der Tag</h1>
      <DayLineView line={dayLineParts(orders, name, now)} />

      {mode === "tablet" && (canStartOrder || canWrite) ? (
        <div className="qbar">
          {canStartOrder ? (
            <button className="qa primary" type="button" onClick={() => requestGlobalCreate("DIRECT_INTAKE")}>
              <Icon id="i-inbox" />
              Neuer Eingang
            </button>
          ) : null}
          {canWrite ? (
            <button className="qa" type="button" onClick={goodsOut}>
              <Icon id="i-truck" />
              Ware raus
              {finished.length > 0 ? <span className="qn">{finished.length}</span> : null}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="pri-h">
        <div className="pri-t">
          <span className="pri-ic"><Icon id="i-alert" /></span>
          Das braucht dich
        </div>
      </div>
      <div className="pri">
        {priority.length === 0 ? (
          <div className="pi" role="status">
            <span className="pi-dot"></span>
            <div className="pi-main"><div className="pi-s">Heute keine offenen Aufträge.</div></div>
          </div>
        ) : (
          priority.slice(0, 4).map((order, index) => (
            <div key={order.id} className={priorityClass(order, index)} data-risk={order.risk}>
              <span className="pi-dot"></span>
              <div className="pi-main">
                <button className="pi-t" type="button" aria-label={`Auftrag ${order.orderNumber} öffnen`} onClick={() => openOrder(order.id)}>
                  <span className="id">{order.orderNumber}</span>{" "}
                  {order.customerName ?? "Kunde nicht hinterlegt"} — {order.detail ?? order.title}
                </button>
                <div className="pi-s">{statusLabel(order)} · {order.dueLabel}: {order.dueValue}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="grid-2">
        <div className="field out">
          <div className="field-h">
            <div className="field-t">
              <span className="field-ic"><Icon id="i-truck" /></span>
              Heute raus
            </div>
            <div className="field-n">{finished.length}</div>
          </div>
          <div className="field-b">
            {finished.length === 0 ? <div className="row"><div className="row-main"><div className="row-s">Heute keine fertigen Aufträge.</div></div></div> : <OrderRows orders={finished} onOpen={openOrder} />}
          </div>
          {canWrite ? (
            <button className="field-foot" type="button" onClick={goodsOut}>
              Warenausgang öffnen{" "}
              <Icon id="i-arrow" />
            </button>
          ) : null}
        </div>
        <div className="field">
          <div className="field-h">
            <div className="field-t">
              <span className="field-ic" style={{ background: "var(--info-bg)", color: "var(--info-fg)" }}><Icon id="i-inbox" /></span>
              Neu seit gestern 18:30
            </div>
            <div className="field-n">{recent.length}</div>
          </div>
          <div className="field-b">
            {recent.length === 0 ? <div className="row"><div className="row-main"><div className="row-s">Seit gestern keine neuen Aufträge.</div></div></div> : <OrderRows orders={recent} onOpen={openOrder} />}
          </div>
        </div>
      </div>
    </section>
  );
}
