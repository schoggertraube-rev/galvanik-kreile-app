"use client";

import { useEffect, useMemo, useState } from "react";
import { getCustomersDb } from "@/app/actions/customers.actions";
import { requestGlobalCreate } from "@/components/layout/GlobalCreateFlow";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { useOverlayStore } from "@/lib/overlayStore";
import type { CustomerListItem, CustomersViewState } from "@/modules/customers/public";
import { Kundenzeile, SeitenKopf, SuchFeld, Zustand } from "@/ui/kr";

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("de-DE");
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
    privat: "Privatkunde",
    business: "Gewerbekunde",
    institution: "Institution",
    Privatkunde: "Privatkunde",
    Geschäftskunde: "Gewerbekunde",
    Institution: "Institution",
  };
  return labels[type] ?? null;
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words.at(-1)?.[0] ?? ""}` : words[0]?.slice(0, 2) ?? "K").toLocaleUpperCase("de-DE");
}

export function CustomersAppAdapter() {
  const openCustomer = useOverlayStore((state) => state.openCustomer);
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const [state, setState] = useState<CustomersViewState>({ kind: "loading" });
  const [query, setQuery] = useState("");

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
            activeOrderCount: customer.activeOrderCount,
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

  const canCreate = !permissionsLoading && (hasPermission("perm_data_customers") || hasPermission("perm_data_orders"));
  const customers = useMemo(() => state.kind === "data"
    ? state.customers.filter((customer) => matchesFilter(customer, query))
    : [], [query, state]);
  const createAction = canCreate ? { text: "Kunde anlegen", icon: "plus" as const, onClick: () => requestGlobalCreate("DIRECT_INTAKE") } : undefined;

  if (state.kind === "loading") return <section data-testid="customers-v11">
    <SeitenKopf titel="Kunden & Kontakt" />
    <Zustand art="laedt" text="Kunden werden geladen." />
  </section>;

  if (state.kind !== "data") return <section data-testid="customers-v11">
    <SeitenKopf titel="Kunden & Kontakt" />
    <Zustand art={state.kind === "error" ? "fehler" : "gesperrt"} text={state.message} />
  </section>;

  if (state.customers.length === 0) return <section data-testid="customers-v11">
    <SeitenKopf titel="Kunden & Kontakt" />
    <Zustand art="leer" text="Noch keine Kunden." aktion={createAction} />
  </section>;

  return <section data-testid="customers-v11">
    <SeitenKopf titel="Kunden & Kontakt" />
    <div className="kr-stapel">
      <SuchFeld wert={query} onWert={setQuery} platzhalter="Name, Ort, Auftrag oder Stichwort" />
      {customers.length ? <div className="kr-stapel" style={{ gap: 8 }}>
        {customers.map((customer) => <Kundenzeile
          key={customer.id}
          kuerzel={initials(customer.name)}
          name={customer.name}
          meta={[customer.city ?? customerNumberLabel(customer.customerNumber) ?? customerTypeLabel(customer.type), `${customer.activeOrderCount} ${customer.activeOrderCount === 1 ? "aktiver Auftrag" : "aktive Aufträge"}`].filter(Boolean).join(" · ")}
          karte
          onOeffnen={() => openCustomer(customer.id)}
        />)}
      </div> : <Zustand art="leer" text={`Kein Kunde für „${query}“.`} aktion={createAction} />}
    </div>
  </section>;
}
