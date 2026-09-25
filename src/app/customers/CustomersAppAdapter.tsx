"use client";

import { useEffect, useState } from "react";
import { getCustomersDb } from "@/app/actions/customers.actions";
import { requestGlobalCreate } from "@/components/layout/GlobalCreateFlow";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { useOverlayStore } from "@/lib/overlayStore";
import type { CustomerListItem, CustomersViewState } from "@/modules/customers/public";

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("de");
}

function matchesFilter(customer: CustomerListItem, query: string) {
  return normalize([customer.customerNumber, customer.name, customer.type, customer.city ?? ""].join(" ")).includes(normalize(query));
}

function customerNumberLabel(customerNumber: string) {
  const value = customerNumber.trim();
  return /^(?:[0-9a-f]{8}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i.test(value) ? null : value || null;
}

function customerTypeLabel(type: string) {
  const labels: Record<string, string> = {
    private: "Privatkunde",
    business: "Gewerbekunde",
    institution: "Institution",
    Privatkunde: "Privatkunde",
    Geschäftskunde: "Gewerbekunde",
    Institution: "Institution",
  };
  return labels[type] ?? null;
}

export function CustomersAppAdapter() {
  const openCustomer = useOverlayStore((state) => state.openCustomer);
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const [state, setState] = useState<CustomersViewState>({ kind: "loading" });
  const [filterDraft, setFilterDraft] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setState({ kind: "loading" });
      try {
        const result = await getCustomersDb();
        if (!active) return;
        if (!result.ok) {
          setState(
            result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN"
              ? { kind: "denied", message: "Kundenstamm ist für diese Sitzung nicht freigegeben." }
              : result.error === "CONFLICT"
                ? { kind: "conflict", message: "Kundenstand hat sich geändert. Bitte neu laden." }
                : { kind: "error", message: "Kundenstamm konnte nicht sicher geladen werden." },
          );
          return;
        }
        setState({
          kind: "data",
          customers: result.data.map((customer) => ({
            id: customer.id,
            customerNumber: customer.customerNumber,
            name: customer.name,
            type: customer.type,
            city: customer.city ?? null,
          })),
        });
      } catch {
        if (active) setState({ kind: "error", message: "Kundenstamm konnte nicht sicher geladen werden." });
      }
    };
    void load();
    window.addEventListener("kreile-sync-customers", load);
    return () => {
      active = false;
      window.removeEventListener("kreile-sync-customers", load);
    };
  }, []);

  const canCreateOrder = !permissionsLoading && hasPermission("perm_data_orders");
  const customers = state.kind === "data" && filter.trim() ? state.customers.filter((customer) => matchesFilter(customer, filter)) : state.kind === "data" ? state.customers : [];
  const status = state.kind === "loading"
    ? { role: "status" as const, busy: true, message: "Kunden werden geladen." }
    : state.kind === "data" && state.customers.length === 0
      ? { role: "status" as const, busy: false, message: "Keine Kunden." }
      : state.kind === "data" && customers.length === 0
        ? { role: "status" as const, busy: false, message: "Keine Kunden passen zum Filter." }
        : state.kind !== "data"
          ? { role: state.kind === "error" ? "alert" as const : "status" as const, busy: false, message: state.message }
          : null;

  return (
    <div className="app-page">
      <div className="app-head">
        <div>
          <h1 style={{ margin: 0 }}>Kunden & Kontakt</h1>
          <p>Kontakte, Eigenheiten, Aufträge und Dokumente bleiben in derselben Kundenkarte V2.</p>
        </div>
        {canCreateOrder ? (
          <button className="app-btn primary" type="button" onClick={() => requestGlobalCreate("DIRECT_INTAKE")}>
            Neuer Auftrag
          </button>
        ) : null}
      </div>
      {state.kind === "data" ? (
        <div className="app-toolbar">
          <label className="app-search">
            ⌕
            <input
              data-list-filter=""
              placeholder="Name, Ort, Auftrag oder Stichwort"
              value={filterDraft}
              onChange={(event) => setFilterDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setFilter(filterDraft);
              }}
            />
          </label>
          <button className="app-btn" type="button" onClick={() => setFilter(filterDraft)}>
            Filter
          </button>
        </div>
      ) : null}
      <div className="app-list">
        {state.kind === "data" && customers.length > 0 ? (
          <>
            <div className="app-list-head">
              <span>Kunde</span>
              <span>Aufträge</span>
              <span>Letzter Kontext</span>
              <span></span>
            </div>
            {customers.map((customer) => (
              <div
                key={customer.id}
                className="app-row"
                data-filter-value={[customer.customerNumber, customer.name, customer.type, customer.city ?? ""].join(" ")}
              >
                <div className="app-main">
                  <b>{customer.name}</b>
                  <span>{[customerNumberLabel(customer.customerNumber), customerTypeLabel(customer.type), customer.city].filter(Boolean).join(" · ")}</span>
                </div>
                <div className="app-meta"></div>
                <div className="app-meta">Kundenakte mit Aufträgen, Notizen und Dokumenten</div>
                <button className="app-btn" type="button" onClick={() => openCustomer(customer.id)}>
                  Karte öffnen →
                </button>
              </div>
            ))}
          </>
        ) : status ? (
          <div className="app-row" role={status.role} aria-busy={status.busy || undefined}>
            <div className="app-main">{status.message}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
