"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Auftragszeile,
  BuendelVorschlag,
  Button,
  Dialog,
  HandlungsEintrag,
  Kachel,
  Lageleiste,
  SeitenKopf,
  WipMenge,
  Zeile,
  Zustand,
  type Geraet,
  type HandlungsArt,
} from "@/ui/kr";
import type {
  PhillipOrderCard,
  PhillipWerkstattViewModel,
  WerkstattHeldCard,
  WerkstattViewPorts,
} from "../server/types";

const PICKER_DIALOG_ID = "werkstatt-order-picker";
type PickerKind = "order" | "goods-out";

function readDevice(): Geraet {
  if (window.innerWidth <= 699) return "handy";
  if (
    window.innerWidth <= 1399 &&
    window.matchMedia?.("(pointer: coarse)").matches
  )
    return "tablet";
  return "desktop";
}

function subscribeDevice(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function actionType(order: WerkstattHeldCard): HandlungsArt {
  return order.heldGroup === "crit" ? "konflikt" : "warnung";
}

function rowTone(order: PhillipOrderCard): "ok" | "warn" | "rot" | "info" {
  if (order.risk === "red" || order.risk === "blocked") return "rot";
  if (order.risk === "orange" || order.risk === "yellow") return "warn";
  return order.station === "fertig" ? "ok" : "info";
}

function customerTitle(order: PhillipOrderCard): string {
  const customer = order.customerName?.trim() || "Kunde nicht hinterlegt";
  return customer.localeCompare(order.title.trim(), "de", {
    sensitivity: "base",
  }) === 0
    ? customer
    : `${customer} — ${order.title}`;
}

function shortOrderTitle(order: PhillipOrderCard): string {
  const customer = order.customerName?.trim();
  return customer &&
    customer.localeCompare(order.title.trim(), "de", {
      sensitivity: "base",
    }) === 0
    ? order.itemDescription?.trim() || "Auftrag"
    : order.title;
}

function displayName(name: string | null): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}

function weekday(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Termin";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "short",
  }).format(date);
}

function startOfBerlinWeek(value: string): number | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const utc = Date.UTC(year, month - 1, day);
  const weekdayIndex = new Date(utc).getUTCDay() || 7;
  return utc - (weekdayIndex - 1) * 86_400_000;
}

function isDueThisWeek(order: PhillipOrderCard, loadedAt: string): boolean {
  const currentWeek = startOfBerlinWeek(loadedAt);
  const dueWeek = startOfBerlinWeek(order.dueDate);
  return currentWeek !== null && dueWeek === currentWeek;
}

function DayStatus({
  view,
}: {
  view: Extract<PhillipWerkstattViewModel, { kind: "data" }>;
}) {
  const name = displayName(view.greetingName);
  return (
    <span className="kr-sr" data-testid="werkstatt-status">
      {name ? `Servus ${name}. ` : ""}
      {view.dringendCount > 0 ? `${view.dringendCount} dringend` : ""}
      {view.dringendCount > 0 && view.weitereCount > 0 ? " · " : ""}
      {view.weitereCount > 0 ? `${view.weitereCount} weitere` : ""}
      {view.dringendCount === 0 && view.weitereCount === 0
        ? "Heute keine Termine."
        : ""}
    </span>
  );
}

function Picker({
  kind,
  orders,
  onClose,
  onSelect,
  onScan,
}: {
  kind: PickerKind;
  orders: readonly PhillipOrderCard[];
  onClose: () => void;
  onSelect: (orderId: string) => void;
  onScan: () => void;
}) {
  const title = kind === "goods-out" ? "Ware raus" : "Auftrag öffnen";
  const emptyText =
    kind === "goods-out"
      ? "Keine fertig gemeldete Ware zur Ausgabe vorhanden."
      : "Keine Aufträge vorhanden.";

  return (
    <Dialog
      titel={title}
      icon={kind === "goods-out" ? "truck" : "open"}
      onSchliessen={onClose}
    >
      <div className="kr-stapel" id={PICKER_DIALOG_ID}>
        {kind === "order" ? (
          <Button
            art="sekundaer"
            icon="scan"
            text="Nummer, Kunde oder Scan …"
            block
            onClick={onScan}
          />
        ) : null}
        {orders.length === 0 ? (
          <div data-testid={kind === "goods-out" ? "goods-out-picker-empty" : "order-picker-empty"}>
            <Zustand art="leer" text={emptyText} />
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              data-testid={`${kind === "goods-out" ? "goods-out" : "order"}-picker-order-${order.id}`}
            >
              <Auftragszeile
                id={order.orderNumber}
                kundeKurz={order.customerName ?? "Kunde nicht hinterlegt"}
                titel={shortOrderTitle(order)}
                meta={
                  (order.itemDescription ?? order.statusText) || order.status
                }
                ton={rowTone(order)}
                status={{
                  text: order.statusText || order.status,
                  ton: rowTone(order),
                }}
                onOeffnen={() => onSelect(order.id)}
              />
            </div>
          ))
        )}
      </div>
    </Dialog>
  );
}

export function WerkstattView({
  view,
  ports,
  onRetry,
}: {
  view: PhillipWerkstattViewModel;
  ports: WerkstattViewPorts;
  onRetry: () => void;
}) {
  const device = useSyncExternalStore(
    subscribeDevice,
    readDevice,
    () => "desktop" as const,
  );
  const [activePicker, setActivePicker] = useState<PickerKind | null>(null);
  const [bundleFilterActive, setBundleFilterActive] = useState(false);
  const [filter, setFilter] = useState<HandlungsArt | "alle">("alle");
  const pickerTriggerRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(false);

  const isData = view.kind === "data";
  const isEmpty = view.kind === "empty";
  const authorized = isData || isEmpty;
  const pickerOrders: readonly PhillipOrderCard[] = isData
    ? activePicker === "goods-out"
      ? view.goodsOutCandidates
      : view.pickerOrders
    : [];

  useEffect(() => {
    if (activePicker === null && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      pickerTriggerRef.current?.focus();
      return;
    }
    if (activePicker === null) return;

    const title = activePicker === "goods-out" ? "Ware raus" : "Auftrag öffnen";
    const dialog = document.querySelector<HTMLElement>(`[role="dialog"][aria-label="${title}"]`);
    const focusable = () => dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable()?.item(0)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = focusable();
      if (!controls?.length) return;
      const first = controls.item(0);
      const last = controls.item(controls.length - 1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activePicker]);

  const openPicker = (
    event: { currentTarget: HTMLElement },
    kind: PickerKind,
  ) => {
    pickerTriggerRef.current = event.currentTarget;
    restoreFocusRef.current = false;
    setActivePicker(kind);
  };
  const closePicker = () => {
    restoreFocusRef.current = true;
    setActivePicker(null);
  };
  const selectOrder = (orderId: string) => {
    restoreFocusRef.current = false;
    setActivePicker(null);
    if (activePicker === "goods-out") ports.onOpenGoodsOut(orderId);
    else ports.onOpenOrder(orderId);
  };
  const scanOrder = () => {
    restoreFocusRef.current = false;
    setActivePicker(null);
    ports.onScanOrder();
  };

  if (!authorized) {
    return (
      <section data-testid="werkstatt-v11">
        <SeitenKopf titel="Werkstatt" />
        <Zustand
          art={
            view.kind === "error" || view.kind === "conflict"
              ? "fehler"
              : "gesperrt"
          }
          text={view.message}
          aktion={
            view.kind === "error" || view.kind === "conflict"
              ? { text: "Erneut laden", onClick: onRetry }
              : undefined
          }
        />
      </section>
    );
  }

  if (isEmpty) {
    return (
      <section data-testid="werkstatt-v11">
        <SeitenKopf titel="Werkstatt" />
        <span className="kr-sr" data-testid="werkstatt-status">
          Heute keine Termine.
        </span>
        <Zustand
          art="leer"
          text="Keine laufenden Aufträge."
          aktion={
            view.canCreateOrder
              ? {
                  text: "Neuer Eingang",
                  icon: "inbox",
                  onClick: ports.onCreateOrder,
                }
              : undefined
          }
        />
        <div className="kr-sr" role="group" aria-label="Werkstattaktionen" />
      </section>
    );
  }

  const baseHeld =
    bundleFilterActive && view.bundleSuggestion
      ? view.bundleSuggestion.orders
      : view.held;
  const held =
    filter === "alle"
      ? baseHeld
      : baseHeld.filter((order) => actionType(order) === filter);
  const counts = view.held.reduce<Record<HandlungsArt, number>>(
    (sum, order) => {
      sum[actionType(order)] += 1;
      return sum;
    },
    { konflikt: 0, entscheidung: 0, warnung: 0 },
  );
  const dueOrders = view.pickerOrders
    .filter((order) => isDueThisWeek(order, view.loadedAt))
    .slice(0, 3);
  const tightWip = view.pickerOrders.filter(
    (order) =>
      order.station === "galvanik" &&
      ["red", "orange", "yellow", "blocked"].includes(order.risk),
  ).length;

  const heldList = (
    <section className="kr-hb" aria-label="Handlungsbedarf">
      <h2 className="kr-hb-label">Heute sichern</h2>
      <div data-testid="werkstatt-held-list">
        {held.length === 0 ? (
          <Zustand art="leer" text="Heute keine dringenden Aufträge." />
        ) : (
          held.map((order, index) => (
            <div
              key={order.id}
              data-testid={`werkstatt-held-${order.id}`}
              style={{ display: "contents" }}
            >
              <HandlungsEintrag
                art={actionType(order)}
                id={order.orderNumber}
                titel={customerTitle(order)}
                titelKurz={shortOrderTitle(order)}
                meta={`${order.statusText || order.status} · ${order.dueLabel}: ${order.dueValue}`}
                aktionen={[
                  {
                    text: "Auftrag öffnen",
                    kurz: "Öffnen",
                    icon: "open",
                    art: "primaer",
                    onClick: () => ports.onOpenOrder(order.id),
                  },
                ]}
                geraet={device}
                fokus={index === 0}
                onOeffnen={() => ports.onOpenOrder(order.id)}
              />
            </div>
          ))
        )}
      </div>
    </section>
  );

  return (
    <section data-testid="werkstatt-v11">
      <SeitenKopf titel="Werkstatt" />
      <DayStatus view={view} />
      <Lageleiste
        zaehler={counts}
        filter={filter}
        onFilter={setFilter}
        gesund={[
          {
            key: "termintreue",
            titel: "Termintreue",
            icon: "clock",
            status:
              view.dringendCount > 0
                ? "kritisch"
                : view.weitereCount > 0
                  ? "warn"
                  : "ok",
            zustand:
              view.dringendCount > 0
                ? "unter Druck"
                : view.weitereCount > 0
                  ? "beobachten"
                  : "im Plan",
          },
        ]}
      />
      <div className="kr-spalten">
        {heldList}
        <div className="kr-stapel">
          <Kachel
            titel="Heute raus"
            icon="truck"
            iconTon="ok"
            zahl={view.goodsOutCandidates.length}
            zustand={view.goodsOutCandidates.length ? "daten" : "leer"}
            texte={{ leerText: "Heute ist keine Ware ausgabebereit." }}
          >
            {view.goodsOutCandidates.slice(0, 3).map((order) => (
              <Auftragszeile
                key={order.id}
                id={order.orderNumber}
                kundeKurz={order.customerName ?? "Kunde"}
                titel={shortOrderTitle(order)}
                meta={order.itemDescription ?? "Ausgabebereit"}
                ton="ok"
                status={{ text: "bereit", ton: "ok" }}
                onOeffnen={() => ports.onOpenGoodsOut(order.id)}
              />
            ))}
          </Kachel>
          <Kachel
            titel="Fällig diese Woche"
            icon="clock"
            iconTon="info"
            zahl={view.dueThisWeekCount}
            zustand={view.dueThisWeekCount ? "daten" : "leer"}
            texte={{ leerText: "Diese Woche sind keine Aufträge fällig." }}
          >
            {dueOrders.map((order) => (
              <Zeile
                key={order.id}
                vorne={
                  <span className="kr-zeit">{weekday(order.dueDate)}</span>
                }
                id={order.orderNumber}
                titel={order.customerName ?? shortOrderTitle(order)}
                meta={shortOrderTitle(order)}
                seite={<span>{order.dueValue}</span>}
                onClick={() => ports.onOpenOrder(order.id)}
              />
            ))}
          </Kachel>
          {view.bundleSuggestion ? (
            <div data-testid="werkstatt-bundle">
              <BuendelVorschlag
                titel={
                  <>
                    {view.bundleSuggestion.orders.length} Aufträge mit{" "}
                    <b>{view.bundleSuggestion.surfaceRequested}</b> — heute
                    zusammen fahren?
                  </>
                }
                meta={view.bundleSuggestion.orders
                  .map((order) => order.orderNumber)
                  .join(" · ")}
                aktion={{
                  text: bundleFilterActive
                    ? "Alle Aufträge zeigen"
                    : device === "handy"
                      ? "Bündeln"
                      : "Diese Aufträge zeigen",
                  onClick: () => setBundleFilterActive((active) => !active),
                }}
              />
            </div>
          ) : null}
          <div data-testid="werkstatt-wip-tile">
            <WipMenge
              anzahl={view.wipCount}
              meta={`${tightWip} werden knapp`}
              onOeffnen={ports.onOpenWip}
            />
          </div>
        </div>
      </div>

      <div className="kr-sr" role="group" aria-label="Werkstattaktionen">
        <button
          type="button"
          aria-controls={PICKER_DIALOG_ID}
          aria-expanded={activePicker === "order"}
          onClick={(event) => openPicker(event, "order")}
        >
          Auftrag öffnen
        </button>
        <button type="button" onClick={(event) => openPicker(event, "order")}>
          Mehrarbeit
        </button>
        <button type="button" onClick={(event) => openPicker(event, "order")}>
          Fertig melden
        </button>
        {view.canCreateOrder ? (
          <button type="button" onClick={ports.onCreateOrder}>
            Neuer Eingang
          </button>
        ) : null}
        <button
          type="button"
          aria-controls={PICKER_DIALOG_ID}
          aria-expanded={activePicker === "goods-out"}
          onClick={(event) => openPicker(event, "goods-out")}
        >
          Ware raus
        </button>
      </div>

      {activePicker ? (
        <Picker
          kind={activePicker}
          orders={pickerOrders}
          onClose={closePicker}
          onSelect={selectOrder}
          onScan={scanOrder}
        />
      ) : null}
    </section>
  );
}
