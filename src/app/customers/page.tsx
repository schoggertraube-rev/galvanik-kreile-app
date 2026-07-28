"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building, ChevronRight, School, User } from "lucide-react";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchToolbar } from "@/components/ui/SearchToolbar";
import { Button } from "@/components/ui/button";
import { getCustomersDb } from "@/app/actions/customers.actions";
import { usePageView } from "@/hooks/usePageView";
import type { Customer } from "@/lib/types/customer";

const safe = (value: unknown) => String(value ?? "").toLowerCase();

function normalizedCustomerType(type: Customer["type"]): "private" | "business" | "institution" | "unknown" {
  if (type === "private" || type === "Privatkunde") return "private";
  if (type === "business" || type === "Geschäftskunde") return "business";
  if (type === "institution" || type === "Institution") return "institution";
  return "unknown";
}

function normalizedCustomerFilter(filter: string): string {
  if (filter === "Privatkunde") return "private";
  if (filter === "Geschäftskunde") return "business";
  if (filter === "Institution") return "institution";
  return filter;
}

function customerTypeLabel(type: Customer["type"]): string {
  const normalized = normalizedCustomerType(type);
  if (normalized === "private") return "Privatkunde";
  if (normalized === "business") return "Geschäftskunde";
  if (normalized === "institution") return "Institution";
  return "Typ nicht hinterlegt";
}

export default function CustomersPage() {
  usePageView();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadCustomers = async () => {
      if (isMounted) {
        setLoadState("loading");
        setLoadError(null);
      }

      try {
        const result = await getCustomersDb();
        if (!result.ok && result.error === "UNAUTHORIZED") {
          router.push("/start?reason=session_expired");
          return;
        }
        if (!result.ok) {
          if (isMounted) {
            setLoadState("error");
            setLoadError(result.message || "Kundendaten konnten nicht bestätigt werden.");
          }
          return;
        }
        if (isMounted) {
          setCustomers(result.data);
          setLoadState("ready");
        }
      } catch (error) {
        console.error("Failed to load customers:", error);
        if (isMounted) {
          setLoadState("error");
          setLoadError("Kundendaten konnten nicht bestätigt werden.");
        }
      }
    };

    void loadCustomers();
    const reloadOnKnownMutation = () => void loadCustomers();
    window.addEventListener("kreile-sync-customers", reloadOnKnownMutation);
    window.addEventListener("kreile-sync-focus", reloadOnKnownMutation);

    return () => {
      isMounted = false;
      window.removeEventListener("kreile-sync-customers", reloadOnKnownMutation);
      window.removeEventListener("kreile-sync-focus", reloadOnKnownMutation);
    };
  }, [reloadKey, router]);

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      safe(customer.name).includes(searchTerm.toLowerCase()) ||
      safe(customer.customerNumber).includes(searchTerm.toLowerCase()) ||
      safe(customer.city).includes(searchTerm.toLowerCase());
    return matchesSearch && (typeFilter === "all" || normalizedCustomerType(customer.type) === normalizedCustomerFilter(typeFilter));
  });

  if (loadState === "loading") {
    return (
      <div className="mx-auto max-w-md space-y-3 p-12 text-center text-text-muted">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-neutral-gray-300 border-t-navy-900" />
        <p className="font-extrabold text-navy-900">Kundenkartei wird geladen</p>
        <p className="text-xs">Es werden noch keine Kunden- oder Auftragsaussagen angezeigt.</p>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="mx-auto max-w-md space-y-4 p-12 text-center text-text-muted">
        <p className="font-extrabold text-navy-900">Kundendaten sind derzeit unbekannt</p>
        <p className="text-sm">{loadError}</p>
        <Button onClick={() => setReloadKey((value) => value + 1)}>Erneut laden</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12 font-sans">
      <div className="mb-6">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Kunden", href: "/customers" }]} />
        <BackButton label="Home" href="/" />
      </div>

      <PageHeader
        title="Kundenkartei"
        subtitle="Neue Kundenanlage und Kundenakte werden nach dem geprüften Erfassungs- und Detailvertrag freigegeben."
      />

      <SearchToolbar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Name, Kundennummer oder Ort suchen..."
        filters={[
          { id: "all", label: "Alle Kundentypen" },
          { id: "private", label: "Privatkunden" },
          { id: "business", label: "Geschäftskunden" },
          { id: "institution", label: "Institutionen" },
        ]}
        activeFilter={typeFilter}
        onFilterChange={setTypeFilter}
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[380px_1fr]">
        <section className="space-y-3" aria-label="Kundenliste">
          <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wider text-navy-500">
            <span>{filteredCustomers.length} Kunden</span>
            <span>Aufträge: tenantgebundene Zählung</span>
          </div>

          {filteredCustomers.length > 0 ? (
            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              {filteredCustomers.map((customer) => {
                const customerType = normalizedCustomerType(customer.type);
                const isSelected = selectedCustomer?.id === customer.id;
                const typeIcon = customerType === "business"
                  ? <Building className="h-3.5 w-3.5" />
                  : customerType === "institution"
                    ? <School className="h-3.5 w-3.5" />
                    : <User className="h-3.5 w-3.5" />;

                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => setSelectedCustomer(customer)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-white p-3 text-left shadow-sm transition-all hover:border-gold-600 hover:shadow md:p-4 ${isSelected ? "border-transparent ring-2 ring-navy-900" : "border-neutral-gray-300"}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-gray-300 bg-bg-app-soft text-sm font-bold text-gold-600">
                        {customer.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <h2 className="truncate font-serif text-sm font-bold tracking-tight text-navy-900 md:text-base">{customer.name}</h2>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                          <span className="rounded bg-bg-app-soft px-1.5 py-0.5 font-mono text-[10px] font-bold">{customer.customerNumber}</span>
                          <span className="flex items-center gap-1 text-[11px] font-semibold">{typeIcon} {customerTypeLabel(customer.type)}</span>
                          <span>{customer.city || "Ort nicht hinterlegt"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-right">
                      <div>
                        <span className="block text-[10px] font-extrabold uppercase tracking-wide text-text-muted">Aufträge</span>
                        <span className="text-sm font-bold text-navy-900">{customer.orderCount ?? 0}</span>
                      </div>
                      <ChevronRight className={`h-5 w-5 transition-transform ${isSelected ? "translate-x-1 text-navy-900" : "text-text-muted"}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2 rounded-xl border border-neutral-gray-300 bg-white p-12 text-center text-text-muted">
              <User className="mx-auto h-8 w-8" />
              <p className="font-bold">Keine Kunden für diese Auswahl</p>
              <p className="text-xs">Ein leerer Bereich wird erst nach erfolgreichem Laden angezeigt.</p>
            </div>
          )}
        </section>

        <section className="rounded-xl border-2 border-dashed border-neutral-gray-100 bg-white p-12 text-center text-text-muted">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-neutral-gray-100 bg-bg-app-soft">
            <ChevronRight className="h-7 w-7 rotate-90 text-navy-900" />
          </div>
          {selectedCustomer ? (
            <>
              <h2 className="font-serif text-base font-bold text-navy-700">Grunddaten von {selectedCustomer.name}</h2>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed">
                {selectedCustomer.orderCount ?? 0} Aufträge sind für diesen Kunden tenantgebunden nachweisbar. Kundenakte, Belege, Preise und Kommunikation bleiben bis zum gemeinsamen Detailvertrag bewusst geschlossen.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-serif text-base font-bold text-navy-700">Kunde auswählen</h2>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed">Die Liste zeigt nur verifizierte Stammdaten und die zugehörige Auftragsanzahl. Nicht freigegebene Details werden nicht simuliert.</p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
