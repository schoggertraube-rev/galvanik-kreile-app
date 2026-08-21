"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, PackageCheck, UserRound } from "lucide-react";
import { getCustomerSummaryAction } from "@/app/actions/customers.actions";
import { AppOverlayPortal } from "@/components/ui/AppOverlayPortal";
import { useCustomerOverlay } from "./useCustomerOverlay";
import { useOverlayStore } from "@/lib/overlayStore";
import type { CustomerSummary } from "@/lib/server/customerSummaryRead";

type State = "loading" | "data" | "empty" | "denied" | "error";

function dateLabel(value: string | null): string {
  if (!value) return "Nicht erfasst";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date)
    : "Nicht verfügbar";
}

export function CustomerOverlay() {
  const { customerId, isOpen, close } = useCustomerOverlay();
  const stack = useOverlayStore((state) => state.stack);
  const openOrder = useOverlayStore((state) => state.openOrder);
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState("Kundenkarte wird geladen.");
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);

  const load = useCallback(async (id: string) => {
    setState("loading");
    setMessage("Kundenkarte wird geladen.");
    setCustomer(null);
    try {
      const result = await getCustomerSummaryAction({ customerId: id });
      if (result.code !== "OK") {
        setMessage(result.message);
        setState(
          result.code === "UNAUTHENTICATED" || result.code === "FORBIDDEN"
            ? "denied" : result.code === "NOT_FOUND" ? "empty" : "error",
        );
        return;
      }
      setCustomer(result.data);
      setState("data");
    } catch {
      setMessage("Kundenkarte konnte nicht sicher geladen werden.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (!customerId) return;
    const timer = window.setTimeout(() => void load(customerId), 0);
    return () => window.clearTimeout(timer);
  }, [customerId, load]);

  if (!isOpen || !customerId) return null;
  const stackIndex = stack.findLastIndex((item) => item.type === "customer" && item.id === customerId);
  const zIndex = 1000 + stackIndex * 10;

  return (
    <AppOverlayPortal>
      <div className="fixed inset-0 z-[1000]">
        <button aria-label="Kundenkarte schließen" className="absolute inset-0 h-full w-full cursor-default bg-black/35 backdrop-blur-sm" data-testid="customer-overlay-backdrop" onClick={close} type="button" />
        <div className="relative flex h-full w-full items-center justify-center p-0 sm:p-3" style={{ zIndex }}>
          <section aria-label="Lebende Kundenkarte" className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:max-w-4xl sm:rounded-2xl" data-testid="live-customer-card" onClick={(event) => event.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-neutral-gray-200 bg-bg-app-soft p-4 md:p-6">
              <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Lebende Kundenkarte</p><h2 className="truncate text-xl font-bold text-navy-900">{customer?.name ?? "Kunde"}</h2></div>
              <button aria-label="Kundenkarte schließen" className="min-h-11 min-w-11 rounded-full border border-neutral-gray-200 bg-white text-xl text-navy-900" onClick={close} type="button">×</button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 pb-8 md:p-6">
              {state === "loading" ? (
                <div className="flex min-h-64 flex-col items-center justify-center text-text-muted" role="status"><Loader2 className="mb-3 h-7 w-7 animate-spin" /><p>{message}</p></div>
              ) : state === "denied" ? (
                <div className="rounded-xl bg-[#fdf0ee] p-5 text-center text-[#c0392b]" role="status"><AlertTriangle className="mx-auto mb-2 h-6 w-6" /><strong>Zugriff nicht erlaubt</strong><p className="mt-1 text-sm">{message}</p></div>
              ) : state === "empty" ? (
                <div className="rounded-xl border border-dashed border-neutral-gray-300 p-6 text-center text-text-muted" role="status"><UserRound className="mx-auto mb-2 h-6 w-6" /><p>Kunde wurde nicht gefunden oder gehört nicht zu diesem Mandanten.</p></div>
              ) : state === "error" || !customer ? (
                <div className="rounded-xl bg-[#fdf0ee] p-5 text-center text-[#c0392b]" role="status"><AlertTriangle className="mx-auto mb-2 h-6 w-6" /><p>{message}</p><button type="button" onClick={() => void load(customerId)} className="mt-3 min-h-10 rounded-lg border border-[#c0392b]/40 bg-white px-4 text-sm font-semibold">Erneut laden</button></div>
              ) : (
                <div className="space-y-6">
                  {customer.wareImHaus ? (
                    <div className="flex items-center gap-3 rounded-xl border border-success-green/30 bg-success-green/10 p-4 text-success-green" role="status"><PackageCheck className="h-5 w-5" /><strong>{customer.wareImHausCount} Auftrag{customer.wareImHausCount === 1 ? "" : "e"}: Ware im Haus</strong></div>
                  ) : null}

                  <section className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-neutral-gray-200 p-4"><p className="text-xs text-text-muted">Kundennummer</p><strong className="text-sm text-navy-900">{customer.customerNumber ?? customer.id}</strong></div>
                    <div className="rounded-xl border border-neutral-gray-200 p-4"><p className="text-xs text-text-muted">Typ / Klasse</p><strong className="text-sm text-navy-900">{customer.type}{customer.classification ? ` · ${customer.classification}` : ""}</strong></div>
                    <div className="rounded-xl border border-neutral-gray-200 p-4"><p className="text-xs text-text-muted">Kontakt</p><strong className="block text-sm text-navy-900">{customer.contactPerson ?? customer.companyName ?? customer.name}</strong><span className="text-xs text-text-muted">{customer.email ?? "E-Mail nicht erfasst"} · {customer.phone ?? "Telefon nicht erfasst"}</span></div>
                    <div className="rounded-xl border border-neutral-gray-200 p-4"><p className="text-xs text-text-muted">Adresse</p><strong className="block text-sm text-navy-900">{customer.street ?? customer.address ?? "Nicht erfasst"}</strong><span className="text-xs text-text-muted">{[customer.zipCode, customer.city, customer.country].filter(Boolean).join(" ") || "Ort nicht erfasst"}</span></div>
                  </section>

                  {customer.internalNotes ? <section className="rounded-xl border border-neutral-gray-200 p-4"><h3 className="text-sm font-semibold text-navy-900">Interne Notiz</h3><p className="mt-1 whitespace-pre-wrap text-sm text-text-muted">{customer.internalNotes}</p></section> : null}

                  <section>
                    <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-bold text-navy-900">Aufträge</h3><span className="text-xs text-text-muted">{customer.orderCount} gesamt</span></div>
                    {customer.orders.length === 0 ? <p className="rounded-xl border border-dashed border-neutral-gray-300 p-4 text-sm text-text-muted">Noch keine Daten erfasst.</p> : (
                      <ul className="space-y-2">
                        {customer.orders.map((order) => (
                          <li key={order.id}><button type="button" data-testid={`customer-order-${order.id}`} onClick={() => openOrder(order.id)} className="grid min-h-14 w-full grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-neutral-gray-200 p-3 text-left hover:border-navy-900"><span><strong className="block text-sm text-navy-900">{order.orderNumber} · {order.title}</strong><span className="text-xs text-text-muted">{order.station} · Termin {dateLabel(order.dueAt)}</span></span><span className="rounded-full bg-bg-app-soft px-3 py-1 text-xs font-semibold text-navy-900">{order.status}</span></button></li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="grid gap-3 md:grid-cols-3">
                    {['Umsatz', 'Deckungsbeitrag', 'Pünktlichkeit'].map((label) => <div key={label} className="rounded-xl border border-dashed border-neutral-gray-300 p-4"><p className="text-xs text-text-muted">Geplanter Kennzahlen-Steckplatz</p><strong className="text-sm text-navy-900">{label}: —</strong></div>)}
                  </section>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppOverlayPortal>
  );
}
