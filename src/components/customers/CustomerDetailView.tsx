import React, { useState } from "react";
import { Customer } from "@/lib/types/customer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  FileText,
  MessageSquare,
  FileWarning, CheckCircle, ShieldAlert
} from "lucide-react";
import { CustomerMemoryCard } from "./CustomerMemoryCard";
import { CustomerContextOverlay, CustomerContextType } from "@/components/context/CustomerContextOverlay";
import { useAppShortcut } from "@/components/ui/AppShortcutContext";

interface CustomerDetailViewProps {
  customer: Customer;
  onEdit: (customer: Customer) => void;
}

export function CustomerDetailView({ customer, onEdit }: CustomerDetailViewProps) {
  const [contextOverlayType, setContextOverlayType] = useState<CustomerContextType>(null);
  const { openShortcut } = useAppShortcut();

  const handleSimulateMail = (email?: string, name?: string) => {
    if (email && email !== "Keine E-Mail hinterlegt" && email.includes("@")) {
      window.location.href = `mailto:${email}?subject=Status-Update%20zu%20Ihrem%20Galvanik-Auftrag%20-%20Kreile%20WerkstattCockpit&body=Hallo%20${encodeURIComponent(name || "")},%0A%0A`;
    } else {
      alert("Keine gültige E-Mail-Adresse für diesen Kunden hinterlegt.");
    }
  };

  const activeOrdersCount = (customer.orders || []).filter(o => o.status !== "done").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="shadow-md border-neutral-gray-100 overflow-hidden bg-white">
        {/* Beautiful Header in Kreile Navy */}
        <div className="bg-linear-to-r from-navy-900 to-navy-700 text-white p-4 md:p-6 relative">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-xs font-bold text-white/70 bg-navy-700 px-2 py-0.5 rounded border border-white/10">
                  {customer.customerNumber || customer.id}
                </span>
                <Badge className="bg-gold-1000 text-white border-0 text-[10px] font-bold uppercase tracking-wider py-0.5 px-2">
                  {customer.type}
                </Badge>
                {customer.customerStatus && (
                  <Badge variant="outline" className="border-white/20 text-white/90 text-[10px] font-bold uppercase tracking-wider py-0.5 px-2">
                    {customer.customerStatus}
                  </Badge>
                )}
              </div>
              <h2 className="font-bold text-2.5xl font-serif mt-2 leading-tight tracking-tight">
                {customer.name}
              </h2>
              {customer.contactPerson && (
                <p className="text-sm text-gold-100 mt-1 font-sans font-medium">
                  z.Hd. {customer.contactPerson}
                </p>
              )}
              <p className="text-xs text-white/90 mt-1 font-sans font-medium flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-accent-orange shrink-0" />
                {customer.address}
              </p>
              
              <div className="mt-3 flex gap-3 text-xs font-bold font-sans">
                <span className="bg-white/10 px-2.5 py-1 rounded-md">{activeOrdersCount} offene Aufträge</span>
                {customer.complaintSummary && customer.complaintSummary.totalComplaints > 0 && (
                  <span className="bg-danger-red/20 text-red-200 border border-danger-red/30 px-2.5 py-1 rounded-md flex items-center gap-1">
                    <FileWarning className="w-3.5 h-3.5" /> {customer.complaintSummary.totalComplaints} Reklamationen
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              {customer.phone ? (
                <a
                  href={`tel:${customer.phone}`}
                  className="bg-white/10 hover:bg-white/20 text-white font-bold border border-white/20 h-11 px-4 text-xs gap-1.5 flex items-center justify-center rounded-md shrink-0 font-sans transition-colors"
                >
                  <Phone className="h-4 w-4 text-accent-orange shrink-0" /> Anrufen
                </a>
              ) : (
                <div
                  className="bg-navy-700 text-text-muted font-bold border border-white/10 h-11 px-4 text-xs gap-1.5 flex items-center justify-center rounded-md cursor-not-allowed shrink-0 font-sans"
                  title="Telefonnummer in Kundenkartei prüfen"
                >
                  <AlertTriangle className="h-4 w-4 text-gold-600 shrink-0" /> Nummer prüfen
                </div>
              )}
              <Button
                onClick={() => handleSimulateMail(customer.email, customer.name)}
                className="bg-white/10 hover:bg-white/20 text-white font-bold border border-white/20 h-11 text-xs gap-1.5 flex-1 sm:flex-none justify-center transition-colors"
              >
                <Mail className="h-4 w-4 text-navy-700" /> E-Mail senden
              </Button>
            </div>
          </div>
        </div>

        <CardContent className="p-0">
          <Tabs defaultValue="uebersicht" className="w-full">
            {/* Scrollable Tablist for Mobile/Tablet */}
            <div className="w-full overflow-x-auto border-b border-neutral-gray-200 bg-bg-app-soft/30 scrollbar-hide">
              <TabsList className="h-14 p-1 bg-transparent w-max flex gap-1 mx-2 min-w-full justify-start">
                <TabsTrigger value="uebersicht" className="h-10 px-4 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-navy-900 text-text-muted font-bold text-sm tracking-tight transition-all">Übersicht</TabsTrigger>
                <TabsTrigger value="auftraege" className="h-10 px-4 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-navy-900 text-text-muted font-bold text-sm tracking-tight transition-all">Aufträge ({(customer.orders || []).length})</TabsTrigger>
                <TabsTrigger value="teile" className="h-10 px-4 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-navy-900 text-text-muted font-bold text-sm tracking-tight transition-all">Teile & Fotos</TabsTrigger>
                <TabsTrigger value="preise" className="h-10 px-4 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-navy-900 text-text-muted font-bold text-sm tracking-tight transition-all">Preise</TabsTrigger>
                <TabsTrigger value="reklamationen" className="h-10 px-4 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-navy-900 text-text-muted font-bold text-sm tracking-tight transition-all">Reklamationen</TabsTrigger>
                <TabsTrigger value="kommunikation" className="h-10 px-4 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-navy-900 text-text-muted font-bold text-sm tracking-tight transition-all">Kommunikation</TabsTrigger>
                <TabsTrigger value="notizen" className="h-10 px-4 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-navy-900 text-text-muted font-bold text-sm tracking-tight transition-all">Notizen</TabsTrigger>
              </TabsList>
            </div>

            <div className="p-4 md:p-6">
              <TabsContent value="uebersicht" className="mt-0 space-y-6">
                
                {/* 1. Werkstattgedächtnis */}
                <CustomerMemoryCard customer={customer} />

                {/* HIGHLIGHT: Direkte Werkstattnotiz */}
                {customer.notes && (
                  <div className="bg-gold-50 border-2 border-gold-600 rounded-xl p-5 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                      <FileText className="w-24 h-24 text-gold-600" />
                    </div>
                    <h3 className="text-sm font-extrabold text-gold-700 uppercase tracking-wider mb-2 flex items-center gap-2 relative z-10">
                      <FileText className="w-4 h-4" /> Werkstattnotiz
                    </h3>
                    <p className="text-base text-navy-900 whitespace-pre-wrap font-medium relative z-10">{customer.notes}</p>
                  </div>
                )}

                {/* NEW: AI Enrichment & Firmenprofil */}
                {customer.aiSummary && (
                  <div className="bg-linear-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-5 shadow-sm relative">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-5 w-5 text-indigo-500" />
                      <h3 className="text-sm font-extrabold text-indigo-900 uppercase tracking-wider">KI-Executive Summary</h3>
                      <Badge className="ml-auto bg-indigo-100 text-indigo-700 border-0 text-[10px]">Smart Profile</Badge>
                    </div>
                    <p className="text-sm text-indigo-900/80 leading-relaxed font-medium mb-4">
                      {customer.aiSummary}
                    </p>
                    
                    {customer.tags && customer.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {customer.tags.map(tag => (
                          <Badge key={tag} className="bg-white border-indigo-200 text-indigo-700 text-[10px] uppercase font-bold">{tag}</Badge>
                        ))}
                      </div>
                    )}

                    {customer.companyInfo && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-indigo-100">
                        {customer.companyInfo.industry && (
                          <div>
                            <span className="text-[10px] font-bold text-indigo-400 uppercase block mb-0.5">Branche</span>
                            <span className="text-xs font-semibold text-indigo-900">{customer.companyInfo.industry}</span>
                          </div>
                        )}
                        {customer.companyInfo.size && (
                          <div>
                            <span className="text-[10px] font-bold text-indigo-400 uppercase block mb-0.5">Größe</span>
                            <span className="text-xs font-semibold text-indigo-900">{customer.companyInfo.size}</span>
                          </div>
                        )}
                        {customer.companyInfo.founded && (
                          <div>
                            <span className="text-[10px] font-bold text-indigo-400 uppercase block mb-0.5">Gründung</span>
                            <span className="text-xs font-semibold text-indigo-900">{customer.companyInfo.founded}</span>
                          </div>
                        )}
                        {customer.creditRating && (
                          <div>
                            <span className="text-[10px] font-bold text-indigo-400 uppercase block mb-0.5">Bonität (extern)</span>
                            <span className="text-xs font-black text-emerald-600">{customer.creditRating}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Stammdaten Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Kontakt */}
                  <div className="bg-bg-app-soft p-3 md:p-4 rounded-xl border border-neutral-gray-100 space-y-3 relative pb-8">
                    <h3 className="text-xs font-extrabold text-text-muted uppercase tracking-wider">Kontaktdaten</h3>
                    <div className="space-y-2 text-sm">
                      {customer.phone && customer.phone !== "-" && customer.phone !== "Unbekannt" && (
                        <div className="flex justify-between py-1 border-b border-neutral-gray-300/65">
                          <span className="text-text-muted font-medium">Telefon:</span>
                          <span className="font-bold text-navy-900">{customer.phone}</span>
                        </div>
                      )}
                      {customer.email && customer.email !== "-" && customer.email !== "Unbekannt" && (
                        <div className="flex justify-between py-1 border-b border-neutral-gray-300/65">
                          <span className="text-text-muted font-medium">E-Mail:</span>
                          <span className="font-bold text-navy-900 text-xs">{customer.email}</span>
                        </div>
                      )}
                      {customer.prefComm && customer.prefComm !== "unknown" && (
                        <div className="flex justify-between py-1 border-b border-neutral-gray-300/65">
                          <span className="text-text-muted font-medium">Bevorzugt:</span>
                          <Badge className="bg-white text-navy-900 border border-neutral-gray-300 text-[10px] font-bold">{customer.prefComm}</Badge>
                        </div>
                      )}
                    </div>
                    {/* Maps Placeholder Link */}
                    {customer.address && customer.address !== "Keine Adresse hinterlegt" && (
                      <a 
                        href={`https://maps.google.com/?q=${encodeURIComponent(customer.address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 block w-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold py-2 rounded-lg text-center transition-colors"
                      >
                        Auf Google Maps öffnen
                      </a>
                    )}
                    <button onClick={() => onEdit(customer)} className="absolute bottom-3 left-3 md:left-4 text-[10px] text-navy-500 font-bold hover:underline">Fehlende Daten ergänzen</button>
                  </div>

                  {/* Profil (Expectations) */}
                  <div className="bg-bg-app-soft p-3 md:p-4 rounded-xl border border-neutral-gray-100 space-y-3 relative pb-8">
                    <h3 className="text-xs font-extrabold text-text-muted uppercase tracking-wider">Kundenprofil</h3>
                    <div className="space-y-2 text-sm">
                      {customer.expectationProfile?.qualityExpectation && customer.expectationProfile.qualityExpectation !== "unclear" && (
                        <div className="flex justify-between py-1 border-b border-neutral-gray-300/65">
                          <span className="text-text-muted font-medium">Qualität:</span>
                          <span className="font-bold text-navy-900">{customer.expectationProfile.qualityExpectation}</span>
                        </div>
                      )}
                      {customer.expectationProfile?.priceSensitivity && customer.expectationProfile.priceSensitivity !== "unknown" && (
                        <div className="flex justify-between py-1 border-b border-neutral-gray-300/65">
                          <span className="text-text-muted font-medium">Preisbewusst:</span>
                          <span className="font-bold text-navy-900">{customer.expectationProfile.priceSensitivity}</span>
                        </div>
                      )}
                      {customer.approvalProfile?.usualApprovalTimeDays && (
                        <div className="flex justify-between py-1 border-b border-neutral-gray-300/65">
                          <span className="text-text-muted font-medium">Freigaben:</span>
                          <span className="font-bold text-navy-900">{customer.approvalProfile.usualApprovalTimeDays} Tage</span>
                        </div>
                      )}
                    </div>
                    <button onClick={() => onEdit(customer)} className="absolute bottom-3 left-3 md:left-4 text-[10px] text-navy-500 font-bold hover:underline">Fehlende Daten ergänzen</button>
                  </div>

                  {/* Technisches Profil */}
                  <div className="bg-bg-app-soft p-3 md:p-4 rounded-xl border border-neutral-gray-100 space-y-3 relative pb-8">
                    <h3 className="text-xs font-extrabold text-text-muted uppercase tracking-wider">Technisches Profil</h3>
                    <div className="space-y-2 text-sm">
                      {customer.technicalProfile?.commonMaterials && customer.technicalProfile.commonMaterials.length > 0 && (
                        <div className="py-1 border-b border-neutral-gray-300/65">
                          <span className="text-text-muted font-medium block mb-1">Typische Materialien:</span>
                          <span className="font-bold text-navy-900 text-xs">{customer.technicalProfile.commonMaterials.join(", ")}</span>
                        </div>
                      )}
                      {customer.technicalProfile?.commonSurfaces && customer.technicalProfile.commonSurfaces.length > 0 && (
                        <div className="py-1 border-b border-neutral-gray-300/65">
                          <span className="text-text-muted font-medium block mb-1">Typische Oberflächen:</span>
                          <span className="font-bold text-navy-900 text-xs">{customer.technicalProfile.commonSurfaces.join(", ")}</span>
                        </div>
                      )}
                    </div>
                    <button onClick={() => onEdit(customer)} className="absolute bottom-3 left-3 md:left-4 text-[10px] text-navy-500 font-bold hover:underline">Fehlende Daten ergänzen</button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="auftraege" className="mt-0 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold font-serif text-navy-900">Auftragshistorie</h3>
                  <Button variant="outline" size="sm" onClick={() => openShortcut("new_order")}>
                    <Sparkles className="w-4 h-4 mr-2 text-accent-orange" /> Neuer Auftrag
                  </Button>
                </div>
                
                {(!customer.orders || customer.orders.length === 0) ? (
                  <div className="p-12 text-center text-text-muted border-2 border-dashed border-neutral-gray-200 rounded-xl">
                    <p>Keine Aufträge vorhanden.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customer.orders.map((order) => {
                      const isDone = order.status === "done";
                      const isCritical = order.status === "critical";
                      
                      let badgeColor = "bg-neutral-gray-100 text-navy-700 border-neutral-gray-100";
                      let borderLeft = "border-l-text-muted";
                      
                      if (isDone) {
                        badgeColor = "bg-success-green-soft text-success-green border-success-green";
                        borderLeft = "border-l-success-green border-l-4";
                      } else if (isCritical) {
                        badgeColor = "bg-accent-orange-soft text-danger-red border-danger-red";
                        borderLeft = "border-l-danger-red border-l-4";
                      } else {
                        badgeColor = "bg-gold-100 text-accent-orange border-accent-orange";
                        borderLeft = "border-l-accent-orange border-l-4";
                      }

                      return (
                        <div key={order.id} className={`p-4 bg-white border border-neutral-gray-200 rounded-xl ${borderLeft} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-mono font-bold text-navy-900">{order.orderNumber}</span>
                              <span className="text-text-muted">•</span>
                              <span className="text-navy-500">Eingang: {order.intakeDate.split('T')[0]}</span>
                            </div>
                            <h4 className="font-bold text-navy-900 text-sm font-serif">{order.task}</h4>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={`text-[10px] font-extrabold tracking-wider border ${badgeColor}`}>
                              {order.statusText}
                            </Badge>
                            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-text-muted" onClick={() => window.location.href = `/orders?search=${order.orderNumber}`}>
                              <ChevronRight className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="teile" className="mt-0 space-y-4">
                <h3 className="text-lg font-bold font-serif text-navy-900">Wiederkehrende Teile</h3>
                {(!customer.recurringItems || customer.recurringItems.length === 0) ? (
                  <div className="p-12 text-center text-text-muted border-2 border-dashed border-neutral-gray-200 rounded-xl">
                    <p>Keine wiederkehrenden Teile erfasst.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {customer.recurringItems.map(item => (
                      <Card key={item.id} className="shadow-sm border-neutral-gray-200">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-navy-900 text-sm">{item.name}</h4>
                            <Badge variant="outline" className="text-[10px] bg-bg-app-soft">Ø {item.averageDurationDays} Tage</Badge>
                          </div>
                          <p className="text-xs text-navy-500">Oberfläche: <span className="font-semibold">{item.usualSurface}</span> ({item.usualMaterial})</p>
                          {item.notes && <p className="text-[11px] text-text-muted mt-2 bg-neutral-gray-50 p-2 rounded">{item.notes}</p>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="preise" className="mt-0 space-y-4">
                <h3 className="text-lg font-bold font-serif text-navy-900">Preisreferenzen</h3>
                {(!customer.priceMemory || customer.priceMemory.length === 0) ? (
                  <div className="p-12 text-center text-text-muted border-2 border-dashed border-neutral-gray-200 rounded-xl">
                    <p>Keine Preisreferenzen hinterlegt.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customer.priceMemory.map(pm => (
                      <div key={pm.id} className="p-4 border border-neutral-gray-200 rounded-xl flex flex-col md:flex-row justify-between gap-4">
                        <div>
                          <h4 className="font-bold text-navy-900">{pm.title}</h4>
                          <p className="text-xs text-text-muted mt-1">Jahr: {pm.year}</p>
                          {pm.reason && <p className="text-xs text-gold-700 bg-gold-50 p-1.5 rounded mt-2 inline-block">Hinweis: {pm.reason}</p>}
                        </div>
                        <div className="text-right">
                          <span className="block text-lg font-black text-navy-900">{pm.priceNet} {pm.currency}</span>
                          <span className="text-[10px] text-text-muted font-bold uppercase">Netto</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="reklamationen" className="mt-0 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold font-serif text-navy-900">Reklamationshistorie</h3>
                  {customer.complaintSummary && (
                    <Badge variant="outline" className={customer.complaintSummary.riskLevel === "high" ? "border-danger-red text-danger-red" : ""}>
                      Risiko: {customer.complaintSummary.riskLevel.toUpperCase()}
                    </Badge>
                  )}
                </div>
                
                {(!customer.feedbacks || customer.feedbacks.length === 0) ? (
                  <div className="p-12 text-center text-text-muted border-2 border-dashed border-neutral-gray-200 rounded-xl flex flex-col items-center">
                    <CheckCircle className="w-8 h-8 text-success-green mb-2 opacity-50" />
                    <p>Keine Reklamationen oder Kundenfeedbacks dokumentiert.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customer.feedbacks.map((fb: Record<string, unknown>) => (
                      <div key={fb.id as string | undefined} className={`p-4 border rounded-xl flex gap-3 ${fb.type === 'negative' ? 'bg-danger-red/5 border-danger-red/20' : 'bg-bg-app-soft border-neutral-gray-100'}`}>
                        {fb.type === 'negative' ? <FileWarning className="w-5 h-5 text-danger-red shrink-0" /> : <MessageSquare className="w-5 h-5 text-navy-500 shrink-0" />}
                        <div>
                          <span className="text-[10px] font-bold text-text-muted block mb-1">{fb.date as string}</span>
                          <p className="text-sm text-navy-900">{fb.text as string}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="kommunikation" className="mt-0 space-y-4">
                <h3 className="text-lg font-bold font-serif text-navy-900">Kommunikation & Freigaben</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button onClick={() => setContextOverlayType("kommunikation")} className="text-left w-full cursor-pointer hover:shadow-md transition-shadow rounded-xl">
                    <Card className="shadow-sm border-neutral-gray-200 h-full">
                      <CardContent className="p-4 space-y-3">
                        <h4 className="font-bold text-sm uppercase text-text-muted tracking-wider">Bevorzugter Weg</h4>
                        <p className="text-lg font-serif text-navy-900">{customer.prefComm || "Unbekannt"}</p>
                        {customer.expectationProfile?.communicationStyle && (
                          <p className="text-xs text-navy-500 bg-neutral-gray-50 p-2 rounded">Stil: {customer.expectationProfile.communicationStyle}</p>
                        )}
                      </CardContent>
                    </Card>
                  </button>
                  
                  <button onClick={() => setContextOverlayType("zahlungen")} className="text-left w-full cursor-pointer hover:shadow-md transition-shadow rounded-xl">
                    <Card className="shadow-sm border-neutral-gray-200 h-full">
                      <CardContent className="p-4 space-y-3">
                        <h4 className="font-bold text-sm uppercase text-text-muted tracking-wider">Zahlungsverhalten</h4>
                        <p className="text-lg font-serif text-navy-900">{customer.paymentProfile?.paymentBehavior || "Unbekannt"}</p>
                        {customer.paymentProfile?.invoiceNotes && (
                          <p className="text-xs text-navy-500 bg-neutral-gray-50 p-2 rounded">{customer.paymentProfile.invoiceNotes}</p>
                        )}
                      </CardContent>
                    </Card>
                  </button>
                </div>
              </TabsContent>

              <TabsContent value="notizen" className="mt-0 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold font-serif text-navy-900">Interne Notizen & Besonderheiten</h3>
                </div>
                
                {customer.expectationProfile?.riskNotes && (
                  <div className="p-4 bg-danger-red/10 border border-danger-red/30 rounded-xl">
                    <h4 className="text-sm font-bold text-danger-red flex items-center gap-2 mb-2">
                      <ShieldAlert className="w-4 h-4" /> Technische Risikonotiz
                    </h4>
                    <p className="text-sm text-navy-900">{customer.expectationProfile.riskNotes}</p>
                  </div>
                )}
                
                {customer.technicalProfile?.handlingNotes && (
                  <div className="p-4 bg-gold-50 border border-gold-200 rounded-xl">
                    <h4 className="text-sm font-bold text-gold-700 flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4" /> Handhabung / Verpackung
                    </h4>
                    <p className="text-sm text-navy-900">{customer.technicalProfile.handlingNotes}</p>
                    {customer.technicalProfile.packagingPreference && (
                      <p className="text-xs text-text-muted mt-2">Verpackung: {customer.technicalProfile.packagingPreference}</p>
                    )}
                  </div>
                )}

              </TabsContent>

            </div>
          </Tabs>

          {/* Actions Bar fixed at bottom of card */}
          <div className="flex flex-col sm:flex-row gap-3 p-6 border-t bg-neutral-gray-50/50 rounded-b-xl">
            <Button 
              variant="outline" 
              className="font-bold text-xs h-11 border-neutral-gray-200 hover:bg-white flex-1 gap-1.5"
              onClick={() => onEdit(customer)}
            >
              Stammdaten bearbeiten
            </Button>
            <Button 
              className="bg-navy-900 text-white hover:bg-navy-700 font-bold text-xs h-11 flex-1 gap-1.5"
              onClick={() => openShortcut("new_order")}
            >
              <Sparkles className="w-4 h-4" /> Neuer Auftrag
            </Button>
          </div>
        </CardContent>
      </Card>

      {contextOverlayType && (
        <CustomerContextOverlay
          type={contextOverlayType}
          customer={customer as any}
          onClose={() => setContextOverlayType(null)}
        />
      )}
    </div>
  );
}
