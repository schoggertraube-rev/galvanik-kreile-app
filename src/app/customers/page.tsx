"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  UserPlus,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Euro,
  X,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Building,
  User,
  School,
  ArrowLeft,
  ArrowRight,
  Check
} from "lucide-react";
import { INITIAL_CUSTOMERS } from "@/lib/mockData";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchToolbar } from "@/components/ui/SearchToolbar";

interface MockPart {
  id: string;
  name: string;
  material: string;
  finish: string;
  location: string;
}

interface MockOrder {
  id: string;
  orderNumber: string;
  task: string;
  intakeDate: string;
  dueDate: string;
  status: "active" | "done" | "waiting" | "critical";
  statusText: string;
  parts: MockPart[];
}

interface PriceAgreement {
  id: string;
  scope: string;
  rate: string;
  date: string;
}

interface FeedbackLog {
  id: string;
  date: string;
  type: "positive" | "negative" | "neutral";
  text: string;
}

interface Customer {
  id: string;
  name: string;
  type: "Privatkunde" | "Geschäftskunde" | "Institution";
  city: string;
  address: string;
  phone: string;
  email: string;
  prefComm: "E-Mail" | "Telefon" | "Brief / Post";
  risk: "Niedrig" | "Mittel" | "Hoch";
  riskNote: string;
  notes: string;
  priceAgreements: PriceAgreement[];
  orders: MockOrder[];
  feedbacks: FeedbackLog[];
}

const safe = (value: unknown) => String(value ?? "").toLowerCase();

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // Custom dialog state for creating a customer (simulated UI)
  const [showAddModal, setShowAddModal] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS as unknown as Customer[]);

  useEffect(() => {
    const stored = localStorage.getItem("kreile_customers");
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomers(JSON.parse(stored));
    } else {
      localStorage.setItem("kreile_customers", JSON.stringify(INITIAL_CUSTOMERS));
    }
  }, []);

  // Customer creation wizard state
  const [modalStep, setModalStep] = useState(1);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [newCustName, setNewCustName] = useState("");
  const [newCustContact, setNewCustContact] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");
  const [newCustType, setNewCustType] = useState("Privatkunde");
  const [newCustNotes, setNewCustNotes] = useState("");

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
  };

  const handleStartEdit = (customer: Customer) => {
    setEditingCustomerId(customer.id);
    setNewCustName(customer.name);
    
    let contact = "";
    let notesPart = "";
    if (customer.notes) {
      const contactMatch = customer.notes.match(/Ansprechpartner:\s*([\s\S]*?)(?:\nNotizen:|$)/);
      const notesMatch = customer.notes.match(/Notizen:\s*([\s\S]*)/);
      if (contactMatch) contact = contactMatch[1].trim();
      if (notesMatch) notesPart = notesMatch[1].trim();
      if (!contactMatch && !notesMatch) {
        notesPart = customer.notes;
      }
    }
    
    setNewCustContact(contact === "Keine Angabe" ? "" : contact);
    setNewCustPhone(customer.phone);
    setNewCustEmail(customer.email);
    setNewCustAddress(customer.address === "Keine Adresse hinterlegt" ? "" : customer.address);
    
    // Map db types back to UI touch tiles
    let uiType = "Privatkunde";
    if (customer.type === "Geschäftskunde") {
      uiType = "Gewerbekunde";
    } else if (customer.type === "Institution") {
      uiType = "Möbel & Kunst";
    }
    setNewCustType(uiType);
    setNewCustNotes(notesPart === "Keine Notizen" ? "" : notesPart);
    
    setModalStep(1);
    setShowAddModal(true);
  };

  const handleSaveCustomer = () => {
    if (!newCustName.trim()) {
      alert("Bitte geben Sie einen Kundennamen ein.");
      return;
    }

    // Map newCustType to the 3 database types
    let mappedType: "Privatkunde" | "Geschäftskunde" | "Institution" = "Privatkunde";
    if (newCustType === "Gewerbekunde" || newCustType === "Stammkunde" || newCustType === "Geschäftskunde") {
      mappedType = "Geschäftskunde";
    } else if (newCustType === "Möbel & Kunst" || newCustType === "Institution") {
      mappedType = "Institution";
    }

    // Derive city from address or fallback
    let derivedCity = "Unbekannt";
    if (newCustAddress) {
      const parts = newCustAddress.split(/[,\s]+/);
      derivedCity = parts[parts.length - 1] || "Unbekannt";
    }

    let updatedCustomers: Customer[];
    let savedCustomer: Customer;

    if (editingCustomerId) {
      updatedCustomers = customers.map(c => {
        if (c.id === editingCustomerId) {
          const updated: Customer = {
            ...c,
            name: newCustName,
            type: mappedType,
            city: derivedCity,
            address: newCustAddress || "Keine Adresse hinterlegt",
            phone: newCustPhone || "",
            email: newCustEmail || "",
            prefComm: newCustEmail ? "E-Mail" : (newCustPhone ? "Telefon" : "Brief / Post"),
            notes: `Ansprechpartner: ${newCustContact || "Keine Angabe"}\nNotizen: ${newCustNotes || "Keine Notizen"}`
          };
          savedCustomer = updated;
          return updated;
        }
        return c;
      });
    } else {
      const newId = `KD-${10000 + customers.length + 1}`;
      const newCustomer: Customer = {
        id: newId,
        name: newCustName,
        type: mappedType,
        city: derivedCity,
        address: newCustAddress || "Keine Adresse hinterlegt",
        phone: newCustPhone || "",
        email: newCustEmail || "",
        prefComm: newCustEmail ? "E-Mail" : (newCustPhone ? "Telefon" : "Brief / Post"),
        risk: "Niedrig",
        riskNote: "Neukunde über geführten Tablet-Prozess angelegt.",
        notes: `Ansprechpartner: ${newCustContact || "Keine Angabe"}\nNotizen: ${newCustNotes || "Keine Notizen"}`,
        priceAgreements: [],
        orders: [],
        feedbacks: []
      };
      savedCustomer = newCustomer;
      updatedCustomers = [newCustomer, ...customers];
    }

    setCustomers(updatedCustomers);
    setSelectedCustomer(savedCustomer!);
    localStorage.setItem("kreile_customers", JSON.stringify(updatedCustomers));
    
    // Reset states
    setEditingCustomerId(null);
    setNewCustName("");
    setNewCustContact("");
    setNewCustPhone("");
    setNewCustEmail("");
    setNewCustAddress("");
    setNewCustType("Privatkunde");
    setNewCustNotes("");
    setModalStep(1);
    setShowAddModal(false);
    
    alert(editingCustomerId 
      ? `Kundenänderungen für "${savedCustomer!.name}" wurden erfolgreich gespeichert!` 
      : `Kunde "${savedCustomer!.name}" (${savedCustomer!.id}) wurde erfolgreich angelegt und ausgewählt!`
    );
  };


  const handleSimulateMail = (email: string, name: string) => {
    if (email && email !== "Keine E-Mail hinterlegt" && email.includes("@")) {
      window.location.href = `mailto:${email}?subject=Status-Update%20zu%20Ihrem%20Galvanik-Auftrag%20-%20Kreile%20WerkstattCockpit&body=Hallo%20${encodeURIComponent(name)},%0A%0A`;
    } else {
      alert("Keine gültige E-Mail-Adresse für diesen Kunden hinterlegt.");
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans max-w-7xl">
      <PageHeader
        title="Kundenkartei"
        subtitle="Technische Profile, historische Preisabsprachen, Reklamationen und zugeordnete Bauteile."
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT COLUMN: Master Customers List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1 uppercase tracking-wider">
            <span>{filteredCustomers.length} Kunden</span>
            <span>Klicke für Akte</span>
          </div>

          {filteredCustomers.length > 0 ? (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {filteredCustomers.map((customer) => {
                const isSelected = selectedCustomer?.id === customer.id;
                const activeOrders = (customer.orders || []).filter(o => o.status !== "done").length;
                
                // Color mapping for customer initials avatar
                let avatarColor = "bg-kreile-surface-warm text-kreile-gold-muted border-kreile-border-strong";
                let typeIcon = <User className="h-3.5 w-3.5" />;
                
                if (customer.type === "Geschäftskunde") {
                  avatarColor = "bg-orange-50 text-orange-700 border-orange-200";
                  typeIcon = <Building className="h-3.5 w-3.5" />;
                } else if (customer.type === "Institution") {
                  avatarColor = "bg-slate-100 text-slate-800 border-slate-200";
                  typeIcon = <School className="h-3.5 w-3.5" />;
                }

                return (
                  <Card
                    key={customer.id}
                    onClick={() => selectCustomer(customer)}
                    className={`transition-all duration-200 cursor-pointer border-kreile-border-strong shadow-sm hover:border-kreile-gold-muted hover:shadow bg-white ${
                      isSelected ? "ring-2 ring-kreile-navy border-transparent shadow-md" : ""
                    }`}
                  >
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center font-bold text-sm shrink-0 ${avatarColor}`}>
                          {customer.name.substring(0, 2).toUpperCase()}
                        </div>
                        
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-kreile-navy text-sm md:text-base font-serif tracking-tight">
                            {customer.name}
                          </h4>
                          
                          <div className="flex flex-wrap items-center gap-2 text-xs text-kreile-muted font-sans">
                            <span className="font-mono bg-kreile-surface-warm px-1.5 py-0.5 rounded text-[10px] text-kreile-muted font-bold">
                              {customer.id}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-kreile-muted">
                              {typeIcon} {customer.type}
                            </span>
                            <span className="text-kreile-muted">•</span>
                            <span className="text-kreile-muted font-medium">{customer.city}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-right shrink-0">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-kreile-muted font-extrabold uppercase tracking-wide">Aufträge</span>
                          <span className="text-sm font-bold text-kreile-navy font-sans flex items-center gap-1">
                            {customer.orders?.length ?? 0}
                            {activeOrders > 0 && (
                              <span className="w-2 h-2 rounded-full bg-orange-500 inline-block animate-pulse" title="Aktiver Auftrag" />
                            )}
                          </span>
                        </div>
                        <ChevronRight className={`h-5 w-5 transition-transform ${isSelected ? "text-kreile-navy translate-x-1" : "text-kreile-muted"}`} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-kreile-muted bg-white border border-kreile-border-strong rounded-xl space-y-2">
              <User className="h-8 w-8 mx-auto text-kreile-muted animate-pulse" />
              <p className="font-bold text-kreile-muted">Keine passenden Kunden</p>
              <p className="text-xs">Ändere den Filter oder passe den Suchbegriff an.</p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Detail View Panel (CRM Customer File) */}
        <div className="lg:col-span-2">
          {selectedCustomer ? (
            <div className="space-y-6">
              <Card className="shadow-md border-kreile-border overflow-hidden bg-white">
                
                {/* Beautiful Header in Kreile Navy */}
                <div className="bg-gradient-to-r from-kreile-navy to-kreile-navy-soft text-white p-6 relative">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-white/70 bg-kreile-navy-soft px-2 py-0.5 rounded border border-white/10">
                          {selectedCustomer.id}
                        </span>
                        <Badge className="bg-orange-500 text-white border-0 text-[10px] font-bold uppercase tracking-wider py-0.5 px-2">
                          {selectedCustomer.type}
                        </Badge>
                      </div>
                      <h2 className="font-bold text-2.5xl font-serif mt-2 leading-tight tracking-tight">
                        {selectedCustomer.name}
                      </h2>
                      <p className="text-xs text-white/90 mt-1 font-sans font-medium flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                        {selectedCustomer.address}
                      </p>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {selectedCustomer.phone ? (
                        <a
                          href={`tel:${selectedCustomer.phone}`}
                          className="bg-white/10 hover:bg-white/20 text-white font-bold border border-white/20 h-11 px-4 text-xs gap-1.5 flex items-center rounded-md shrink-0 font-sans"
                        >
                          <Phone className="h-4 w-4 text-orange-400 shrink-0" /> Anrufen ({selectedCustomer.phone})
                        </a>
                      ) : (
                        <div
                          className="bg-kreile-navy-soft text-kreile-muted font-bold border border-white/10 h-11 px-4 text-xs gap-1.5 flex items-center rounded-md cursor-not-allowed shrink-0 font-sans"
                          title="Telefonnummer in Kundenkartei prüfen"
                        >
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" /> Nummer prüfen
                        </div>
                      )}
                      <Button
                        onClick={() => handleSimulateMail(selectedCustomer.email, selectedCustomer.name)}
                        className="bg-white/10 hover:bg-white/20 text-white font-bold border border-white/20 h-11 text-xs gap-1.5 flex-1 sm:flex-none"
                      >
                        <Mail className="h-4 w-4 text-blue-450" /> E-Mail
                      </Button>
                    </div>
                  </div>
                </div>

                <CardContent className="p-6 space-y-6">
                  
                  {/* Grid for core details: Contact & Internal Risk Note */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Stammdaten Core Specs */}
                    <div className="bg-kreile-surface-soft p-4 rounded-xl border border-slate-100 space-y-3 text-sm">
                      <h3 className="text-xs font-extrabold text-kreile-muted uppercase tracking-wider">Kontaktdaten</h3>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center py-1 border-b border-kreile-border-strong/65">
                          <span className="text-kreile-muted font-medium">Telefon:</span>
                          <span className="font-bold text-kreile-navy font-mono">{selectedCustomer.phone}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-kreile-border-strong/65">
                          <span className="text-kreile-muted font-medium">E-Mail:</span>
                          <span className="font-bold text-kreile-navy font-mono text-xs">{selectedCustomer.email}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-kreile-muted font-medium">Bevorzugter Kanal:</span>
                          <Badge className="bg-kreile-surface-warm text-kreile-navy border-kreile-border-strong border text-[10px] font-bold">
                            {selectedCustomer.prefComm}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Diskreter Werkstatt-Hinweis (Internal risk / profile profile) */}
                    <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/60 space-y-2.5 text-sm">
                      <div className="flex items-center gap-1.5">
                        <ShieldAlert className="h-4.5 w-4.5 text-amber-600 shrink-0" />
                        <h3 className="text-xs font-extrabold text-amber-800 uppercase tracking-wider">
                          Interner Werkstatt-Hinweis
                        </h3>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-xs font-semibold">Risikoprofil:</span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                            selectedCustomer.risk === "Niedrig"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : selectedCustomer.risk === "Mittel"
                              ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}>
                            {selectedCustomer.risk}
                          </span>
                        </div>
                        <p className="text-xs text-amber-950 font-medium leading-relaxed mt-1">
                          {selectedCustomer.riskNote}
                        </p>
                      </div>
                    </div>

                  </div>

                  {/* General Master Notes */}
                  {selectedCustomer.notes && (
                    <div className="border-t pt-4">
                      <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                        Werkstattnotiz / Besonderheiten
                      </h3>
                      <p className="text-xs text-slate-600 bg-slate-50/40 p-3 rounded-lg border border-slate-200/50 leading-relaxed font-sans">
                        {selectedCustomer.notes}
                      </p>
                    </div>
                  )}

                  {/* Pricing Agreements */}
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center gap-1.5">
                      <Euro className="h-4 w-4 text-orange-500" />
                      <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                        Sonderkonditionen & Preisabsprachen
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedCustomer.priceAgreements.map((agreement) => (
                        <div key={agreement.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs flex justify-between items-start">
                          <div>
                            <span className="font-bold text-slate-800 block text-xs">{agreement.scope}</span>
                            <span className="text-slate-400 text-[10px] font-semibold mt-1 block">Vereinbart am {agreement.date}</span>
                          </div>
                          <Badge className="bg-orange-50 border border-orange-200 text-orange-800 text-[11px] font-extrabold font-sans">
                            {agreement.rate}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Active and Past Orders */}
                  <div className="space-y-3 border-t pt-4">
                    <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                      Auftragshistorie ({selectedCustomer.orders.length} Aufträge)
                    </h3>

                    <div className="space-y-3">
                      {selectedCustomer.orders.map((order) => {
                        const isDone = order.status === "done";
                        const isCritical = order.status === "critical";
                        const isWaiting = order.status === "waiting";
                        const isWarning = order.status === "active";

                        let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
                        let borderLeft = "border-l-slate-400";
                        if (isDone) {
                          badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                          borderLeft = "border-l-emerald-500 border-l-4";
                        } else if (isCritical) {
                          badgeColor = "bg-red-50 text-red-700 border-red-200";
                          borderLeft = "border-l-red-500 border-l-4";
                        } else if (isWaiting) {
                          badgeColor = "bg-slate-200 text-slate-700 border-slate-300";
                          borderLeft = "border-l-slate-500 border-l-4";
                        } else if (isWarning) {
                          badgeColor = "bg-orange-50 text-orange-700 border-orange-200";
                          borderLeft = "border-l-orange-500 border-l-4";
                        }

                        return (
                          <div 
                            key={order.id} 
                            className={`p-4 bg-white border border-slate-200 rounded-xl ${borderLeft} hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4`}
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-mono font-bold text-slate-900">{order.orderNumber}</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-500 font-semibold">Eingang: {order.intakeDate}</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-500 font-semibold">Liefertermin: {order.dueDate}</span>
                              </div>
                              <h4 className="font-bold text-slate-800 text-sm font-serif">{order.task}</h4>
                              
                              {/* Display associated parts under each order */}
                              <div className="mt-2.5 pt-2 border-t border-slate-100">
                                <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide block mb-1.5">Werkstücke</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {order.parts.map(part => (
                                    <div key={part.id} className="p-2 bg-slate-50 rounded border border-slate-100 flex items-start justify-between text-xs">
                                      <div>
                                        <p className="font-bold text-slate-800 text-[11px] leading-tight">{part.name}</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">
                                          {part.finish} ({part.material})
                                        </p>
                                      </div>
                                      <Badge variant="outline" className="font-mono text-[8px] bg-white text-slate-500 px-1 py-0 border-slate-200 shrink-0">
                                        {part.id}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 justify-end shrink-0">
                              <Badge className={`text-[10px] font-extrabold tracking-wider border ${badgeColor}`}>
                                {order.statusText}
                              </Badge>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-9 w-9 p-0 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-900"
                                onClick={() => window.location.href = `/orders?search=${order.orderNumber}`}
                              >
                                <ArrowUpRight className="h-4.5 w-4.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Feedback Logs & Reklamationshistorie */}
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="h-4.5 w-4.5 text-blue-600" />
                      <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                        Feedback & Reklamationshistorie
                      </h3>
                    </div>

                    <div className="space-y-2">
                      {selectedCustomer.feedbacks.map((log) => {
                        let icon = <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
                        let bg = "bg-emerald-50/40 border-emerald-100 text-emerald-950";
                        let label = "Kundenlob";

                        if (log.type === "negative") {
                          icon = <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />;
                          bg = "bg-red-50/40 border-red-100 text-red-950";
                          label = "Reklamation";
                        } else if (log.type === "neutral") {
                          icon = <Clock className="h-4 w-4 text-blue-500" />;
                          bg = "bg-blue-50/40 border-blue-100 text-blue-950";
                          label = "Kommentar / Doku";
                        }

                        return (
                          <div key={log.id} className={`p-3 border.5 rounded-xl ${bg} text-xs flex gap-2.5 items-start`}>
                            <div className="mt-0.5 shrink-0">{icon}</div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold uppercase text-[9px] tracking-wide">{label}</span>
                                <span className="text-[10px] text-slate-400 font-semibold">{log.date}</span>
                              </div>
                              <p className="leading-relaxed font-medium">{log.text}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      className="font-bold text-xs h-11 border-slate-200 hover:bg-slate-50 flex-1 gap-1.5"
                      onClick={() => handleStartEdit(selectedCustomer)}
                    >
                      Stammdaten bearbeiten
                    </Button>
                    <Button 
                      className="bg-blue-900 text-white hover:bg-blue-800 font-bold text-xs h-11 flex-1 gap-1.5"
                      onClick={() => window.location.href = `/orders/new?customer=${selectedCustomer.id}`}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-orange-400" /> Neuen Auftrag erfassen
                    </Button>
                  </div>

                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-dashed border-2 border-slate-200 text-center p-16 text-slate-400 bg-white">
              <div className="w-14 h-14 bg-slate-50 rounded-full border border-slate-100 flex items-center justify-center mx-auto mb-4 shadow-inner">
                <ChevronRight className="h-7 w-7 text-slate-300 rotate-90" />
              </div>
              <h3 className="font-bold text-slate-700 text-base font-serif">Kein Kunde ausgewählt</h3>
              <p className="text-xs max-w-[280px] mx-auto mt-2 leading-relaxed">
                Wähle einen Kunden aus der linken Liste, um das vollständige technische Profil, Preisvereinbarungen und Werkstücke einzusehen.
              </p>
            </Card>
          )}
        </div>

      </div>

      {/* Simulated Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <Card className="max-w-xl w-full shadow-2xl border-slate-250 overflow-hidden bg-white animate-scale-up rounded-2xl">
            {/* Header with clear branding and step info */}
            <div className="bg-linear-to-r from-blue-950 to-slate-900 text-white p-6 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold tracking-wider bg-orange-500 text-white py-0.5 px-2 rounded-full font-mono uppercase shadow-sm">
                    Schritt {modalStep} von 4
                  </span>
                  <span className="text-xs text-slate-300 font-medium">• Assistent</span>
                </div>
                <h3 className="font-bold text-xl font-serif mt-1 tracking-tight">
                  {editingCustomerId ? "Kunde bearbeiten" : "Kunde anlegen"}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setModalStep(1);
                  setEditingCustomerId(null);
                }}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer border-0"
                aria-label="Schließen"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Stepper Dots Indicator (highly visible, touch target safe) */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4].map((s) => {
                  const isActive = modalStep === s;
                  const isCompleted = modalStep > s;
                  return (
                    <div
                      key={s}
                      onClick={() => s < modalStep && setModalStep(s)}
                      className={`h-3.5 rounded-full transition-all duration-300 cursor-pointer ${
                        isActive 
                          ? "w-8 bg-blue-900" 
                          : isCompleted 
                            ? "w-3.5 bg-emerald-600" 
                            : "w-3.5 bg-slate-350"
                      }`}
                      title={`Gehe zu Schritt ${s}`}
                    />
                  );
                })}
              </div>
              <span className="text-[10.5px] font-black uppercase text-slate-500 font-sans tracking-wide">
                {modalStep === 1 && "1. Stammdaten"}
                {modalStep === 2 && "2. Kontaktdaten"}
                {modalStep === 3 && "3. Kundentyp & Notiz"}
                {modalStep === 4 && (editingCustomerId ? "4. Änderungen prüfen" : "4. Überprüfung")}
              </span>
            </div>
            
            <CardContent className="p-6 space-y-6 min-h-[380px] flex flex-col justify-between">
              
              {/* STEP 1: STAMMDATEN (Name & Contact) */}
              {modalStep === 1 && (
                <div className="space-y-5 flex-1">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-xs text-slate-600 leading-relaxed">
                    <p className="font-semibold text-slate-800">📋 Tipp für Werkstatt & Tablet:</p>
                    Geben Sie den Namen der Firma oder den vollen Namen ein. Der Name ist das primäre Suchkriterium im Leitstand.
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">Kunden-Name / Firma <span className="text-red-500">*</span></label>
                    <Input 
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      placeholder="z. B. Porsche Classic Club, Müller AG, Hans Keller..." 
                      className="h-13 rounded-xl text-base border-slate-250 shadow-sm focus:border-blue-900 focus:ring-1 focus:ring-blue-900 font-sans" 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">Ansprechpartner <span className="text-slate-400 font-medium">(Optional)</span></label>
                    <Input 
                      value={newCustContact}
                      onChange={(e) => setNewCustContact(e.target.value)}
                      placeholder="z. B. Herr Brunner, Werkstattleiter..." 
                      className="h-13 rounded-xl text-base border-slate-250 shadow-sm focus:border-blue-900 focus:ring-1 focus:ring-blue-900 font-sans" 
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: CONTACT DETAILS */}
              {modalStep === 2 && (
                <div className="space-y-5 flex-1">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">Telefonnummer <span className="text-slate-400 font-medium">(Optional)</span></label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <Input 
                        value={newCustPhone}
                        onChange={(e) => setNewCustPhone(e.target.value)}
                        placeholder="z. B. +41 61 789 45 12" 
                        type="tel"
                        className="pl-12 h-13 rounded-xl text-base border-slate-250 shadow-sm focus:border-blue-900 focus:ring-1 focus:ring-blue-900 font-mono" 
                      />
                    </div>
                    {/* Important missing phone notice */}
                    {!newCustPhone.trim() && (
                      <div className="bg-amber-50 border border-amber-250 rounded-xl p-3.5 flex items-start gap-3 mt-2">
                        <AlertTriangle className="h-5.5 w-5.5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-900">
                          <span className="font-bold block">Hinweis: „Telefonnummer später ergänzen“</span>
                          <p className="mt-0.5 text-amber-955 font-medium leading-relaxed">
                            Ohne Telefonnummer kann die Werkstatt den Kunden nicht direkt für Rückfragen oder Freigaben kontaktieren.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">E-Mail-Adresse <span className="text-slate-400 font-medium">(Optional)</span></label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <Input 
                        value={newCustEmail}
                        onChange={(e) => setNewCustEmail(e.target.value)}
                        placeholder="z. B. info@porsche-classic.ch" 
                        type="email"
                        className="pl-12 h-13 rounded-xl text-base border-slate-250 shadow-sm focus:border-blue-900 focus:ring-1 focus:ring-blue-900 font-sans" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">Adresse / Ort <span className="text-slate-400 font-medium">(Optional)</span></label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <Input 
                        value={newCustAddress}
                        onChange={(e) => setNewCustAddress(e.target.value)}
                        placeholder="Straße, PLZ und Ort" 
                        className="pl-12 h-13 rounded-xl text-base border-slate-250 shadow-sm focus:border-blue-900 focus:ring-1 focus:ring-blue-900 font-sans" 
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: KUNDENTYP & NOTIZ */}
              {modalStep === 3 && (
                <div className="space-y-5 flex-1">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">Kundentyp <span className="text-red-500">*</span></label>
                    
                    {/* Generous touch tiles for Kundentyp selection */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {[
                        { id: "Privatkunde", label: "Privatkunde", desc: "Einzelaufträge" },
                        { id: "Gewerbekunde", label: "Gewerbekunde", desc: "Firmenkunde" },
                        { id: "Oldtimer-Liebhaber", label: "Oldtimer-Liebhaber", desc: "Restauration" },
                        { id: "Möbel & Kunst", label: "Möbel & Kunst", desc: "Designstücke" },
                        { id: "Stammkunde", label: "Stammkunde", desc: "Sonderkonditionen" }
                      ].map((t) => {
                        const isSelected = newCustType === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setNewCustType(t.id)}
                            className={`p-3.5 border-2 rounded-xl text-left transition-all h-20 flex flex-col justify-between cursor-pointer select-none ${
                              isSelected 
                                ? "bg-blue-900 border-blue-950 text-white shadow-md ring-1 ring-blue-955 scale-102" 
                                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            <span className="font-extrabold text-sm block tracking-tight">{t.label}</span>
                            <span className={`text-[10px] block mt-1 font-medium ${isSelected ? "text-blue-200" : "text-slate-500"}`}>{t.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">Werkstatt-Notiz / Besonderheiten <span className="text-slate-400 font-medium">(Optional)</span></label>
                    <textarea 
                      value={newCustNotes}
                      onChange={(e) => setNewCustNotes(e.target.value)}
                      className="w-full text-sm p-4 rounded-xl border border-slate-250 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-900 min-h-[90px]" 
                      placeholder="z. B. Gewünschter Qualitätsgrad, empfindliches Material, Sonderwünsche..."
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: ZUSAMMENFASSUNG & SPEICHERN */}
              {modalStep === 4 && (
                <div className="space-y-4 flex-1">
                  <div className="bg-emerald-50 border border-emerald-250 p-4 rounded-xl text-emerald-900 flex items-start gap-3">
                    <CheckCircle2 className="h-5.5 w-5.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-bold block uppercase tracking-wider text-[10px] text-emerald-800">
                        {editingCustomerId ? "Stammdaten angepasst" : "Stammdaten vollständig erfasst"}
                      </span>
                      <p className="mt-0.5 text-emerald-950 font-medium">
                        {editingCustomerId 
                          ? "Bitte überprüfen Sie die Änderungen. Der Datensatz wird direkt aktualisiert." 
                          : "Bitte überprüfen Sie die Angaben. Der Kunde wird direkt in die Kundenkartei von WerkstattOS eingetragen."}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 border rounded-xl divide-y text-sm overflow-hidden font-sans">
                    <div className="p-3.5 flex items-center justify-between">
                      <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Kunde:</span>
                      <span className="font-extrabold text-slate-900 font-serif text-base">{newCustName}</span>
                    </div>

                    {newCustContact && (
                      <div className="p-3.5 flex items-center justify-between">
                        <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Ansprechpartner:</span>
                        <span className="font-bold text-slate-800">{newCustContact}</span>
                      </div>
                    )}

                    <div className="p-3.5 flex items-center justify-between">
                      <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Telefonnummer:</span>
                      {newCustPhone ? (
                        <span className="font-mono font-bold text-slate-800">{newCustPhone}</span>
                      ) : (
                        <Badge className="bg-amber-100 border border-amber-300 text-amber-900 text-[10.5px] font-extrabold">
                          Telefonnummer später ergänzen
                        </Badge>
                      )}
                    </div>

                    <div className="p-3.5 flex items-center justify-between">
                      <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">E-Mail:</span>
                      <span className="font-mono font-bold text-slate-800 text-xs truncate max-w-[200px]">
                        {newCustEmail || "Nicht hinterlegt"}
                      </span>
                    </div>

                    <div className="p-3.5 flex items-center justify-between">
                      <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Adresse:</span>
                      <span className="font-bold text-slate-800 truncate max-w-[200px]">
                        {newCustAddress || "Keine Adresse"}
                      </span>
                    </div>

                    <div className="p-3.5 flex items-center justify-between">
                      <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Kundentyp:</span>
                      <Badge className="bg-blue-900 text-white text-[10px] font-extrabold uppercase py-0.5 px-2">
                        {newCustType}
                      </Badge>
                    </div>

                    {newCustNotes && (
                      <div className="p-3.5 space-y-1">
                        <span className="text-slate-500 font-bold text-xs uppercase tracking-wider block">Werkstatt-Notiz:</span>
                        <p className="text-xs text-slate-700 bg-white border border-slate-100 p-2.5 rounded-lg leading-relaxed font-sans shadow-xs">
                          {newCustNotes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* NAVIGATION ACTION BUTTONS - Generous Touch Targets */}
              <div className="flex gap-3 pt-5 border-t mt-4">
                {modalStep > 1 ? (
                  <Button 
                    variant="outline" 
                    onClick={() => setModalStep(prev => prev - 1)}
                    className="flex-1 font-bold text-sm h-14 border-slate-200 rounded-xl hover:bg-slate-50 flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="h-4.5 w-4.5 text-slate-500" /> Zurück
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowAddModal(false);
                      setModalStep(1);
                      setEditingCustomerId(null);
                    }}
                    className="flex-1 font-bold text-sm h-14 border-slate-200 rounded-xl hover:bg-slate-50"
                  >
                    Abbrechen
                  </Button>
                )}

                {modalStep < 4 ? (
                  <Button 
                    onClick={() => {
                      if (modalStep === 1 && !newCustName.trim()) {
                        alert("Bitte tragen Sie den Kunden-Namen / die Firma ein.");
                        return;
                      }
                      setModalStep(prev => prev + 1);
                    }}
                    className="flex-1 bg-blue-900 hover:bg-blue-800 text-white font-bold text-sm h-14 rounded-xl flex items-center justify-center gap-2"
                  >
                    Weiter <ArrowRight className="h-4.5 w-4.5 text-orange-400" />
                  </Button>
                ) : (
                  <Button 
                    onClick={handleSaveCustomer}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm h-14 rounded-xl flex items-center justify-center gap-2 shadow-md"
                  >
                    {editingCustomerId ? "Kunde speichern" : "Kunde anlegen"} <Check className="h-5 w-5 text-white stroke-2" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
