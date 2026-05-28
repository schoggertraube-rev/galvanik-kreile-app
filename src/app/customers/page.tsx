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
import { CustomerDetailView } from "@/components/customers/CustomerDetailView";
import { CustomerTypeConsequences } from "@/components/customers/CustomerTypeConsequences";
import { Customer } from "@/lib/types/customer";
import { EXTENDED_CUSTOMERS as INITIAL_CUSTOMERS } from "@/lib/mockCustomersExtended";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchToolbar } from "@/components/ui/SearchToolbar";
import type { CustomerType } from "@/types/customerType";

const safe = (value: unknown) => String(value ?? "").toLowerCase();

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS as unknown as Customer[]);

  useEffect(() => {
    const stored = localStorage.getItem("kreile_customers_v2");
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomers(JSON.parse(stored));
    } else {
      localStorage.setItem("kreile_customers_v2", JSON.stringify(INITIAL_CUSTOMERS));
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
    setNewCustPhone(customer.phone || "");
    setNewCustEmail(customer.email || "");
    setNewCustAddress(customer.address === "Keine Adresse hinterlegt" ? "" : (customer.address || ""));
    
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
        customerNumber: newId,
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
    localStorage.setItem("kreile_customers_v2", JSON.stringify(updatedCustomers));
    
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
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center font-bold text-sm shrink-0 ${avatarColor}`}>
                          {customer.name.substring(0, 2).toUpperCase()}
                        </div>
                        
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-navy-900 text-sm md:text-base font-serif tracking-tight">
                            {customer.name}
                          </h4>
                          
                          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted font-sans">
                            <span className="font-mono bg-bg-app-soft px-1.5 py-0.5 rounded text-[10px] text-text-muted font-bold">
                              {customer.id}
                            </span>
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
              <p className="font-bold text-text-muted">Keine passenden Kunden</p>
              <p className="text-xs">Ändere den Filter oder passe den Suchbegriff an.</p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Detail View Panel (CRM Customer File) */}
        <div className="lg:col-span-2">
          {selectedCustomer ? (
            <CustomerDetailView customer={selectedCustomer as Customer} onEdit={handleStartEdit} />
          ) : (
            <Card className="border-dashed border-2 border-neutral-gray-100 text-center p-16 text-text-muted bg-white">
              <div className="w-14 h-14 bg-bg-app-soft rounded-full border border-neutral-gray-100 flex items-center justify-center mx-auto mb-4 shadow-inner">
                <ChevronRight className="h-7 w-7 text-text-muted rotate-90" />
              </div>
              <h3 className="font-bold text-navy-700 text-base font-serif">Kein Kunde ausgewählt</h3>
              <p className="text-xs max-w-[280px] mx-auto mt-2 leading-relaxed">
                Wähle einen Kunden aus der linken Liste, um das vollständige technische Profil, Preisvereinbarungen und Werkstücke einzusehen.
              </p>
            </Card>
          )}
        </div>
      </div>
      {/* Simulated Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-navy-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <Card className="max-w-xl w-full shadow-2xl border-neutral-gray-300 overflow-hidden bg-white animate-scale-up rounded-2xl">
            {/* Header with clear branding and step info */}
            <div className="bg-linear-to-r from-blue-950 to-navy-900 text-white p-6 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold tracking-wider bg-gold-1000 text-white py-0.5 px-2 rounded-full font-mono uppercase shadow-sm">
                    Schritt {modalStep} von 4
                  </span>
                  <span className="text-xs text-text-muted font-medium">• Assistent</span>
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
            <div className="bg-bg-app-soft border-b border-neutral-gray-100 px-6 py-4 flex items-center justify-between">
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
                          ? "w-8 bg-navy-900" 
                          : isCompleted 
                            ? "w-3.5 bg-success-green" 
                            : "w-3.5 bg-neutral-gray-300"
                      }`}
                      title={`Gehe zu Schritt ${s}`}
                    />
                  );
                })}
              </div>
              <span className="text-[10.5px] font-black uppercase text-navy-500 font-sans tracking-wide">
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
                  <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-100 text-xs text-navy-500 leading-relaxed">
                    <p className="font-semibold text-navy-900">📋 Tipp für Werkstatt & Tablet:</p>
                    Geben Sie den Namen der Firma oder den vollen Namen ein. Der Name ist das primäre Suchkriterium im Leitstand.
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-black text-navy-500 uppercase tracking-wider block">Kunden-Name / Firma <span className="text-danger-red">*</span></label>
                    <Input 
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      placeholder="z. B. Porsche Classic Club, Müller AG, Hans Keller..." 
                      className="h-13 rounded-xl text-base border-neutral-gray-300 shadow-sm focus:border-navy-700 focus:ring-1 focus:ring-blue-900 font-sans" 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-black text-navy-500 uppercase tracking-wider block">Ansprechpartner <span className="text-text-muted font-medium">(Optional)</span></label>
                    <Input 
                      value={newCustContact}
                      onChange={(e) => setNewCustContact(e.target.value)}
                      placeholder="z. B. Herr Brunner, Werkstattleiter..." 
                      className="h-13 rounded-xl text-base border-neutral-gray-300 shadow-sm focus:border-navy-700 focus:ring-1 focus:ring-blue-900 font-sans" 
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: CONTACT DETAILS */}
              {modalStep === 2 && (
                <div className="space-y-5 flex-1">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-navy-500 uppercase tracking-wider block">Telefonnummer <span className="text-text-muted font-medium">(Optional)</span></label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
                      <Input 
                        value={newCustPhone}
                        onChange={(e) => setNewCustPhone(e.target.value)}
                        placeholder="z. B. +41 61 789 45 12" 
                        type="tel"
                        className="pl-12 h-13 rounded-xl text-base border-neutral-gray-300 shadow-sm focus:border-navy-700 focus:ring-1 focus:ring-blue-900 font-mono" 
                      />
                    </div>
                    {/* Important missing phone notice */}
                    {!newCustPhone.trim() && (
                      <div className="bg-gold-100 border border-gold-600 rounded-xl p-3.5 flex items-start gap-3 mt-2">
                        <AlertTriangle className="h-5.5 w-5.5 text-gold-600 shrink-0 mt-0.5" />
                        <div className="text-xs text-gold-600">
                          <span className="font-bold block">Hinweis: „Telefonnummer später ergänzen“</span>
                          <p className="mt-0.5 text-gold-600 font-medium leading-relaxed">
                            Ohne Telefonnummer kann die Werkstatt den Kunden nicht direkt für Rückfragen oder Freigaben kontaktieren.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-navy-500 uppercase tracking-wider block">E-Mail-Adresse <span className="text-text-muted font-medium">(Optional)</span></label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
                      <Input 
                        value={newCustEmail}
                        onChange={(e) => setNewCustEmail(e.target.value)}
                        placeholder="z. B. info@porsche-classic.ch" 
                        type="email"
                        className="pl-12 h-13 rounded-xl text-base border-neutral-gray-300 shadow-sm focus:border-navy-700 focus:ring-1 focus:ring-blue-900 font-sans" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-navy-500 uppercase tracking-wider block">Adresse / Ort <span className="text-text-muted font-medium">(Optional)</span></label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
                      <Input 
                        value={newCustAddress}
                        onChange={(e) => setNewCustAddress(e.target.value)}
                        placeholder="Straße, PLZ und Ort" 
                        className="pl-12 h-13 rounded-xl text-base border-neutral-gray-300 shadow-sm focus:border-navy-700 focus:ring-1 focus:ring-blue-900 font-sans" 
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: KUNDENTYP & NOTIZ */}
              {modalStep === 3 && (
                <div className="space-y-5 flex-1">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-navy-500 uppercase tracking-wider block">Kundentyp <span className="text-danger-red">*</span></label>
                    
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
                                ? "bg-navy-900 border-navy-700 text-white shadow-md ring-1 ring-blue-955 scale-102" 
                                : "bg-bg-app-soft border-neutral-gray-100 text-navy-700 hover:bg-neutral-gray-100"
                            }`}
                          >
                            <span className="font-extrabold text-sm block tracking-tight">{t.label}</span>
                            <span className={`text-[10px] block mt-1 font-medium ${isSelected ? "text-navy-700" : "text-navy-500"}`}>{t.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-navy-500 uppercase tracking-wider block">Werkstatt-Notiz / Besonderheiten <span className="text-text-muted font-medium">(Optional)</span></label>
                    <textarea 
                      value={newCustNotes}
                      onChange={(e) => setNewCustNotes(e.target.value)}
                      className="w-full text-sm p-4 rounded-xl border border-neutral-gray-300 bg-bg-app-soft focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-900 min-h-[90px]" 
                      placeholder="z. B. Gewünschter Qualitätsgrad, empfindliches Material, Sonderwünsche..."
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: ZUSAMMENFASSUNG & SPEICHERN */}
              {modalStep === 4 && (
                <div className="space-y-4 flex-1">
                  <div className="bg-success-green-soft border border-success-green p-4 rounded-xl text-success-green flex items-start gap-3">
                    <CheckCircle2 className="h-5.5 w-5.5 text-success-green shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-bold block uppercase tracking-wider text-[10px] text-success-green">
                        {editingCustomerId ? "Stammdaten angepasst" : "Stammdaten vollständig erfasst"}
                      </span>
                      <p className="mt-0.5 text-success-green font-medium">
                        {editingCustomerId 
                          ? "Bitte überprüfen Sie die Änderungen. Der Datensatz wird direkt aktualisiert." 
                          : "Bitte überprüfen Sie die Angaben. Der Kunde wird direkt in die Kundenkartei von WerkstattOS eingetragen."}
                      </p>
                    </div>
                  </div>

                  <div className="bg-bg-app-soft border rounded-xl divide-y text-sm overflow-hidden font-sans">
                    <div className="p-3.5 flex items-center justify-between">
                      <span className="text-navy-500 font-bold text-xs uppercase tracking-wider">Kunde:</span>
                      <span className="font-extrabold text-navy-900 font-serif text-base">{newCustName}</span>
                    </div>

                    {newCustContact && (
                      <div className="p-3.5 flex items-center justify-between">
                        <span className="text-navy-500 font-bold text-xs uppercase tracking-wider">Ansprechpartner:</span>
                        <span className="font-bold text-navy-900">{newCustContact}</span>
                      </div>
                    )}

                    <div className="p-3.5 flex items-center justify-between">
                      <span className="text-navy-500 font-bold text-xs uppercase tracking-wider">Telefonnummer:</span>
                      {newCustPhone ? (
                        <span className="font-mono font-bold text-navy-900">{newCustPhone}</span>
                      ) : (
                        <Badge className="bg-amber-100 border border-gold-600 text-gold-600 text-[10.5px] font-extrabold">
                          Telefonnummer später ergänzen
                        </Badge>
                      )}
                    </div>

                    <div className="p-3.5 flex items-center justify-between">
                      <span className="text-navy-500 font-bold text-xs uppercase tracking-wider">E-Mail:</span>
                      <span className="font-mono font-bold text-navy-900 text-xs truncate max-w-[200px]">
                        {newCustEmail || "Nicht hinterlegt"}
                      </span>
                    </div>

                    <div className="p-3.5 flex items-center justify-between">
                      <span className="text-navy-500 font-bold text-xs uppercase tracking-wider">Adresse:</span>
                      <span className="font-bold text-navy-900 truncate max-w-[200px]">
                        {newCustAddress || "Keine Adresse"}
                      </span>
                    </div>

                    <div className="p-3.5 flex items-center justify-between">
                      <span className="text-navy-500 font-bold text-xs uppercase tracking-wider">Kundentyp:</span>
                      <Badge className="bg-navy-900 text-white text-[10px] font-extrabold uppercase py-0.5 px-2">
                        {newCustType}
                      </Badge>
                    </div>

                    {newCustNotes && (
                      <div className="p-3.5 space-y-1">
                        <span className="text-navy-500 font-bold text-xs uppercase tracking-wider block">Werkstatt-Notiz:</span>
                        <p className="text-xs text-navy-700 bg-white border border-neutral-gray-100 p-2.5 rounded-lg leading-relaxed font-sans shadow-xs">
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
                    className="flex-1 font-bold text-sm h-14 border-neutral-gray-100 rounded-xl hover:bg-bg-app-soft flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="h-4.5 w-4.5 text-navy-500" /> Zurück
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowAddModal(false);
                      setModalStep(1);
                      setEditingCustomerId(null);
                    }}
                    className="flex-1 font-bold text-sm h-14 border-neutral-gray-100 rounded-xl hover:bg-bg-app-soft"
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
                    className="flex-1 bg-navy-900 hover:bg-navy-700 text-white font-bold text-sm h-14 rounded-xl flex items-center justify-center gap-2"
                  >
                    Weiter <ArrowRight className="h-4.5 w-4.5 text-accent-orange" />
                  </Button>
                ) : (
                  <Button 
                    onClick={handleSaveCustomer}
                    className="flex-1 bg-success-green hover:bg-success-green-soft0 text-white font-black text-sm h-14 rounded-xl flex items-center justify-center gap-2 shadow-md"
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
