"use client";

// Phillip-Startseite "Werkstatt" 1:1 aus der Owner-Bauvorlage
// (mock_extract/kreile/phillip_home). Markup/Klassen stammen aus Vorlage.jsx;
// die Daten kommen ausschliesslich aus dem tenantgebundenen Werkstatt-Read-Model.
// Owner G7: Nicht angebundene Vorlagen-Aktionen und -Aussagen werden nicht gerendert.

import { useEffect, useRef, useState } from "react";
import type {
  PhillipOrderCard,
  PhillipWerkstattViewModel,
  WerkstattHeldCard,
  WerkstattViewPorts,
} from "../server/types";

const PICKER_TITLE_ID = "werkstatt-order-picker-title";
const PICKER_DIALOG_ID = "werkstatt-order-picker";

type PickerKind = "order" | "goods-out";

function Icon({ id }: { id: string }) {
  return (
    <svg className="i" aria-hidden="true">
      <use href={`#${id}`}></use>
    </svg>
  );
}

function priorityClass(order: WerkstattHeldCard): string {
  if (order.risk === "red" || order.risk === "blocked") return "pi crit";
  if (order.risk === "orange" || order.risk === "yellow") return "pi soon";
  return "pi";
}

function statusClass(order: PhillipOrderCard): string {
  const status = `${order.status} ${order.statusText}`.toLowerCase();
  if (status.includes("fertig")) return "zust fertig";
  if (status.includes("angenommen") || status.includes("eingang")) return "zust neu";
  return "zust arb";
}

function displayName(name: string | null): string | null {
  const firstName = name?.trim().split(/\s+/)[0];
  return firstName || null;
}

function DayLine({ view }: { view: Extract<PhillipWerkstattViewModel, { kind: "data" }> }) {
  const name = displayName(view.greetingName);
  if (view.dringendCount === 0 && view.weitereCount === 0) {
    return <div className="day-line" data-testid="werkstatt-status">Heute keine Termine.</div>;
  }

  return (
    <div className="day-line" data-testid="werkstatt-status">
      {name ? `Servus ${name}. ` : null}
      {view.dringendCount > 0 ? (
        <span className="rp"><b>{view.dringendCount}</b> dringend</span>
      ) : null}
      {view.dringendCount > 0 && view.weitereCount > 0 ? " · " : null}
      {view.weitereCount > 0 ? <><b>{view.weitereCount}</b> weitere</> : null}
    </div>
  );
}

function HeldOrders({ orders, onOpenOrder }: { orders: readonly WerkstattHeldCard[]; onOpenOrder: (orderId: string) => void }) {
  if (orders.length === 0) {
    return (
      <div className="pi" role="status">
        <span className="pi-dot"></span>
        <div className="pi-main"><div className="pi-s">Heute keine dringenden Aufträge.</div></div>
      </div>
    );
  }

  return (
    <div className="pri" data-testid="werkstatt-held-list">
      {orders.map((order) => (
        <div key={order.id} className={priorityClass(order)} data-testid={`werkstatt-held-${order.id}`}>
          <span className="pi-dot"></span>
          <div className="pi-main">
            <div className="pi-top">
              <button className="pi-t" type="button" aria-label={`Auftrag ${order.orderNumber} öffnen`} onClick={() => onOpenOrder(order.id)}>
                <span className="id">{order.orderNumber}</span>{" "}
                {order.customerName ?? "Kunde nicht hinterlegt"} · {order.title}
              </button>
              <span className={statusClass(order)}>{order.statusText || order.status}</span>
            </div>
            {order.itemDescription ? <div className="pi-s">{order.itemDescription}</div> : null}
            {order.dueLabel && order.dueValue ? <span className="pchip pc-red">{order.dueLabel}: {order.dueValue}</span> : null}
            <div className="pi-a">
              <button className="btn-do" type="button" onClick={() => onOpenOrder(order.id)}>
                <Icon id="i-open" />
                Auftrag öffnen
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Picker({
  kind,
  orders,
  onClose,
  onSelect,
  onScan,
  dialogRef,
  closeRef,
}: {
  kind: PickerKind;
  orders: readonly PhillipOrderCard[];
  onClose: () => void;
  onSelect: (orderId: string) => void;
  onScan: () => void;
  dialogRef: React.RefObject<HTMLElement | null>;
  closeRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const title = kind === "goods-out" ? "Ware raus" : "Auftrag öffnen";
  const emptyText = kind === "goods-out" ? "Keine fertig gemeldete Ware zur Ausgabe vorhanden." : "Keine Aufträge vorhanden.";

  return (
    <div className="ovl open">
      <section ref={dialogRef} id={PICKER_DIALOG_ID} className="oc" role="dialog" aria-modal="true" aria-labelledby={PICKER_TITLE_ID}>
        <div className="oc-h">
          <span className="oc-ic"><Icon id={kind === "goods-out" ? "i-truck" : "i-open"} /></span>
          <div><div id={PICKER_TITLE_ID} className="oc-tt">{title}</div></div>
          <button ref={closeRef} className="oc-x2" type="button" aria-label="Schließen" onClick={onClose}><Icon id="i-x" /></button>
        </div>
        <div className="oc-b">
          {kind === "order" ? (
            <button className="pick-s" type="button" aria-label="Nummer, Kunde oder Scan …" onClick={onScan}>
              <Icon id="i-search" />Nummer, Kunde oder Scan …
            </button>
          ) : null}
          {orders.length === 0 ? (
            <div className="pi-s" role="status" data-testid="goods-out-picker-empty">{emptyText}</div>
          ) : (
            orders.map((order) => (
              <button
                key={order.id}
                className="pick-row"
                type="button"
                data-testid={`${kind === "goods-out" ? "goods-out" : "order"}-picker-order-${order.id}`}
                aria-label={`Auftrag ${order.orderNumber} ${kind === "goods-out" ? "für Warenausgang öffnen" : "öffnen"}`}
                onClick={() => onSelect(order.id)}
              >
                <span className="id">{order.orderNumber}</span>
                <span className="nm">{order.customerName ?? "Kunde nicht hinterlegt"} · {order.title}</span>
                <span className={statusClass(order)}>{order.statusText || order.status}</span>
                <span className="go"><Icon id="i-arrow" /></span>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
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
  const [activePicker, setActivePicker] = useState<PickerKind | null>(null);
  const [bundleFilterActive, setBundleFilterActive] = useState(false);
  const pickerTriggerRef = useRef<HTMLElement | null>(null);
  const pickerDialogRef = useRef<HTMLElement | null>(null);
  const pickerCloseRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef(false);

  const isData = view.kind === "data";
  const isEmpty = view.kind === "empty";
  const authorized = isData || isEmpty;
  const isPickerOpen = activePicker !== null;
  const pickerOrders: readonly PhillipOrderCard[] = isData
    ? activePicker === "goods-out" ? view.goodsOutCandidates : view.pickerOrders
    : [];
  const heldOrders = isData && bundleFilterActive && view.bundleSuggestion
    ? view.bundleSuggestion.orders
    : isData ? view.held : [];

  useEffect(() => {
    if (!isPickerOpen) {
      if (restoreFocusRef.current) {
        restoreFocusRef.current = false;
        pickerTriggerRef.current?.focus();
      }
      return;
    }

    pickerCloseRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        restoreFocusRef.current = true;
        setActivePicker(null);
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = pickerDialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable.item(0);
      const last = focusable.item(focusable.length - 1);
      const active = document.activeElement;
      if (!dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isPickerOpen]);

  const openPicker = (event: { currentTarget: HTMLElement }, kind: PickerKind) => {
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
    if (activePicker === "goods-out") {
      ports.onOpenGoodsOut(orderId);
      return;
    }
    ports.onOpenOrder(orderId);
  };

  const scanOrder = () => {
    restoreFocusRef.current = false;
    setActivePicker(null);
    ports.onScanOrder();
  };

  if (!authorized) {
    const isError = view.kind === "error" || view.kind === "conflict";
    return (
      <div className="mock-kreile-phillip-home">
        <div className="body scroll" role={isError ? "alert" : "status"}>
          <h1 className="day-title" style={{ margin: 0 }}>Werkstatt</h1>
          <div className="mock-state">{view.message}</div>
          {isError ? <button className="btn-later" type="button" onClick={onRetry}>Erneut laden</button> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mock-kreile-phillip-home">
      <div className="body scroll">
        <h1 id="werkstatt-title" className="day-title" style={{ margin: 0 }}>Werkstatt</h1>
        {isData ? <DayLine view={view} /> : <div className="day-line" role="status" data-testid="werkstatt-status">Heute keine Termine.</div>}

        {isData ? (
          <div className="cols">
            <div>
              <div className="sec-t">
                <span className="sec-ic"><Icon id="i-clock" /></span>
                Heute sichern
                <span className="hint">nach Dringlichkeit · was heute raus/fertig muss</span>
              </div>
              <HeldOrders orders={heldOrders} onOpenOrder={ports.onOpenOrder} />
            </div>

            <div className="rail">
              {view.bundleSuggestion ? (
                <div className="bundle" data-testid="werkstatt-bundle">
                  <div className="bundle-h"><Icon id="i-layers" />Bündeln heute</div>
                  <div className="bundle-t">{view.bundleSuggestion.orders.length} Aufträge mit <b>{view.bundleSuggestion.surfaceRequested}</b></div>
                  <div className="bundle-s">{view.bundleSuggestion.orders.map((order) => order.customerName).filter((name): name is string => Boolean(name)).join(" · ")}</div>
                  <div className="bundle-a">
                    <button className="b-soft" type="button" aria-pressed={bundleFilterActive} onClick={() => setBundleFilterActive((active) => !active)}>
                      <Icon id="i-layers" />
                      {bundleFilterActive ? "Alle Aufträge zeigen" : "Diese Aufträge zeigen"}
                    </button>
                  </div>
                </div>
              ) : null}

              <button className="wip" type="button" data-testid="werkstatt-wip-tile" onClick={ports.onOpenWip}>
                <div className="wip-l"><Icon id="i-flask" />In Arbeit (Galvanik)</div>
                <div className="wip-n">{view.wipCount}<small>Aufträge</small></div>
                <div className="wip-go">{view.dringendCount} werden knapp · antippen <Icon id="i-arrow" /></div>
              </button>

              <button className="tile" type="button" onClick={(event) => openPicker(event, "goods-out")}>
                <div className="tile-r">
                  <div className="tile-l"><span className="tile-ic"><Icon id="i-truck" /></span><span className="tile-tx">Heute raus</span></div>
                  <span className="tile-n">{view.goodsOutCandidates.length}</span>
                </div>
              </button>

              <div className="tile" data-testid="werkstatt-due-week-tile">
                <div className="tile-r">
                  <div className="tile-l"><span className="tile-ic in"><Icon id="i-clock" /></span><span className="tile-tx">Fällig diese Woche</span></div>
                  <span className="tile-n">{view.dueThisWeekCount}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="actionbar" role="group" aria-label="Werkstattaktionen">
        {isData ? (
          <button className="ab primary" type="button" aria-haspopup="dialog" aria-expanded={activePicker === "order"} aria-controls={PICKER_DIALOG_ID} onClick={(event) => openPicker(event, "order")}>
            <Icon id="i-open" />Auftrag öffnen
          </button>
        ) : null}
        {isData ? (
          <button className="ab mid" type="button" aria-haspopup="dialog" aria-expanded={activePicker === "order"} aria-controls={PICKER_DIALOG_ID} onClick={(event) => openPicker(event, "order")}>
            <Icon id="i-layers" />Mehrarbeit
          </button>
        ) : null}
        {isData ? (
          <button className="ab mid" type="button" aria-haspopup="dialog" aria-expanded={activePicker === "order"} aria-controls={PICKER_DIALOG_ID} onClick={(event) => openPicker(event, "order")}>
            <Icon id="i-check" />Fertig melden
          </button>
        ) : null}
        {view.canCreateOrder ? (
          <button className={isData ? "ab norm" : "ab primary"} type="button" onClick={ports.onCreateOrder}>
            <Icon id="i-inbox" />Neuer Eingang
          </button>
        ) : null}
        {isData ? (
          <button className="ab norm" type="button" aria-haspopup="dialog" aria-expanded={activePicker === "goods-out"} aria-controls={PICKER_DIALOG_ID} onClick={(event) => openPicker(event, "goods-out")}>
            <Icon id="i-truck" />Ware raus
          </button>
        ) : null}
      </div>

      {isPickerOpen && activePicker ? (
        <Picker kind={activePicker} orders={pickerOrders} onClose={closePicker} onSelect={selectOrder} onScan={scanOrder} dialogRef={pickerDialogRef} closeRef={pickerCloseRef} />
      ) : null}
    </div>
  );
}
