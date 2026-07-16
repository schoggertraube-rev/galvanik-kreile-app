"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";

import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  Building,
  User,
  School,
  UserPlus
} from "lucide-react";

import { Customer } from "@/lib/types/customer";
// Mock data removed
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchToolbar } from "@/components/ui/SearchToolbar";
import { NewCustomerForm } from "@/components/customers/NewCustomerForm";
import { getCustomersDb } from "@/app/actions/customers.actions";
import { trackUiEvent } from "@/lib/tracking/tracking";
import { useCustomerOverlay } from "@/components/customers/useCustomerOverlay";

import { useRouter } from "next/navigation";

const safe = (value: unknown) => String(value ?? "").toLowerCase();

export default function CustomersPage() {
  usePageView();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const { open: openCustomer } = useCustomerOverlay();

  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    let isMounted = true;
    
    const loadCustomers = async () => {
      try {
        const res = await getCustomersDb();
        if (res && !res.ok && res.error === "UNAUTHORIZED") {
          router.push("/start?reason=session_expired");
          return;
        }
        if (isMounted && res.ok) {
          setCustomers(res.data);
        }
      } catch (err) {
        console.error("Failed to load customers:", err);
      }
    };
    
    loadCustomers();

    const handleSync = () => {
      console.log("[CustomersPage] Sync event received, reloading customers...");
      loadCustomers();
    };

    window.addEventListener('kreile-sync-customers', handleSync);
    window.addEventListener('kreile-sync-focus', handleSync);
    
    return () => {
      isMounted = false;
      window.removeEventListener('kreile-sync-customers', handleSync);
      window.removeEventListener('kreile-sync-focus', handleSync);
    };
  }, [router]);

  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);

  const filteredCustomers = customers.filter(c => {
    const cleanTerm = searchTerm.toLowerCase();
    const matchesSearch =
      safe(c.name).includes(cleanTerm) ||
      safe(c.id).includes(cleanTerm) ||
      safe(c.city).includes(cleanTerm);

    if (typeFilter === "all") return matchesSearch;
    return matchesSearch && c.type === typeFilter;
  });

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    trackUiEvent("detail_open", { target: "customer" });
    openCustomer(customer.id);
  };

  return (
    <div className="space-y-6 pb-12 font-sans max-w-7xl">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Customers',href:'/customers'}]} />
        <BackButton label="Home" href="/" />
      </div>
      
      <PageHeader
        title="Kundenkartei"
        action={{
          label: "Neuer Kunde",
          onClick: () => setShowAddModal(true),
          icon: UserPlus,
        }}
      />

      {/* Toolbar & Filters - Optimized for touch, no thin administrative tables */}
      <SearchToolbar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Name, ID oder Ort suchen..."
        filters={[
          { id: "all", label: "Alle Kundentypen" },
          { id: "Privatkunde", label: "Privatkunden" },
          { id: "Geschäftskunde", label: "Geschäftskunden" },
          { id: "Institution", label: "Institutionen" }
        ]}
        activeFilter={typeFilter}
        onFilterChange={setTypeFilter}
      />

      {/* CRM Master-Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 items-start">
        
        {/* LEFT COLUMN: Master Customers List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between text-xs text-navy-500 font-bold px-1 uppercase tracking-wider">
            <span>{filteredCustomers.length} Kunden</span>
            <span>Klicke für Akte</span>
          </div>

          {filteredCustomers.length > 0 ? (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {filteredCustomers.map((customer) => {
                const isSelected = selectedCustomer?.id === customer.id;
                const activeOrders = (customer.orders || []).filter(o => o.status !== "done").length;
                
                // Color mapping for customer initials avatar
                let avatarColor = "bg-bg-app-soft text-gold-600 border-neutral-gray-300";
                let typeIcon = <User className="h-3.5 w-3.5" />;
                
                if (customer.type === "Geschäftskunde") {
                  avatarColor = "bg-gold-100 text-accent-orange border-accent-orange";
                  typeIcon = <Building className="h-3.5 w-3.5" />;
                } else if (customer.type === "Institution") {
                  avatarColor = "bg-neutral-gray-100 text-navy-900 border-neutral-gray-100";
                  typeIcon = <School className="h-3.5 w-3.5" />;
                }

                return (
                  <Card
                    key={customer.id}
                    onClick={() => selectCustomer(customer)}
                    className={`transition-all duration-200 cursor-pointer border-neutral-gray-300 shadow-sm hover:border-gold-600 hover:shadow bg-white ${
                      isSelected ? "ring-2 ring-navy-900 border-transparent shadow-md" : ""
                    }`}
                  >
                    <CardContent className="p-3 md:p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center font-bold text-sm shrink-0 ${avatarColor}`}>
                          {customer.name.substring(0, 2).toUpperCase()}
                        </div>
                        
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-navy-900 text-sm md:text-base font-serif tracking-tight">
                            {customer.name}
                          </h4>
                          
                          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted font-sans">
                            {customer.customerNumber && (
                              <span className="font-mono bg-bg-app-soft px-1.5 py-0.5 rounded text-[10px] text-text-muted font-bold">
                                {customer.customerNumber}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-text-muted">
                              {typeIcon} {customer.type}
                            </span>
                            <span className="text-text-muted">•</span>
                            <span className="text-text-muted font-medium">{customer.city}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-right shrink-0">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-text-muted font-extrabold uppercase tracking-wide">Aufträge</span>
                          <span className="text-sm font-bold text-navy-900 font-sans flex items-center gap-1">
                            {customer.orders?.length ?? 0}
                            {activeOrders > 0 && (
                              <span className="w-2 h-2 rounded-full bg-gold-1000 inline-block animate-pulse" title="Aktiver Auftrag" />
                            )}
                          </span>
                        </div>
                        <ChevronRight className={`h-5 w-5 transition-transform ${isSelected ? "text-navy-900 translate-x-1" : "text-text-muted"}`} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-text-muted bg-white border border-neutral-gray-300 rounded-xl space-y-2">
              <User className="h-8 w-8 mx-auto text-text-muted animate-pulse" />
              <p className="font-bold text-text-muted">Noch keine Aufträge erfasst</p>
              <p className="text-xs">Ändere den Filter oder passe den Suchbegriff an.</p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Detail View Panel (CRM Customer File) */}
        <div className="lg:col-span-2">
          {selectedCustomer ? (
            <Card className="border-dashed border-2 border-neutral-gray-100 text-center p-16 text-text-muted bg-white">
              <div className="w-14 h-14 bg-bg-app-soft rounded-full border border-neutral-gray-100 flex items-center justify-center mx-auto mb-4 shadow-inner">
                <User className="h-7 w-7 text-navy-900" />
              </div>
              <h3 className="font-bold text-navy-700 text-base font-serif">Kundenkarte {selectedCustomer.name} geöffnet</h3>
              <p className="text-xs max-w-[280px] mx-auto mt-2 leading-relaxed">
                Das Overlay mit den Kundendetails ist jetzt aktiv. Schließe das Overlay, um zur Liste zurückzukehren.
              </p>
              <Button onClick={() => openCustomer(selectedCustomer.id)} className="mt-4" variant="outline">
                Overlay erneut öffnen
              </Button>
            </Card>
          ) : (
            <Card className="border-dashed border-2 border-neutral-gray-100 text-center p-16 text-text-muted bg-white">
              <div className="w-14 h-14 bg-bg-app-soft rounded-full border border-neutral-gray-100 flex items-center justify-center mx-auto mb-4 shadow-inner">
                <ChevronRight className="h-7 w-7 text-text-muted rotate-90" />
              </div>
              <h3 className="font-bold text-navy-700 text-base font-serif">Kein Kunde ausgewählt</h3>
              <p className="text-xs max-w-[280px] mx-auto mt-2 leading-relaxed">
                Wähle einen Kunden aus der linken Liste, um das vollständige Profil einzusehen.
              </p>
            </Card>
          )}
          {showAddModal && (
            <NewCustomerForm
              customerId={editingCustomerId}
              onClose={() => {
                setShowAddModal(false);
                setEditingCustomerId(null);
              }}
              onSave={async (id) => {
                setShowAddModal(false);
                setEditingCustomerId(null);
                const res = await getCustomersDb();
                if (res.ok) {
                  setCustomers(res.data);
                  const newCust = res.data.find(c => c.id === id);
                  if (newCust) setSelectedCustomer(newCust);
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
