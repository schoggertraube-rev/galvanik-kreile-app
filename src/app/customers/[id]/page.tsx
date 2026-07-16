"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";
import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import { CustomerProfileHeader } from "@/components/customers/CustomerProfileHeader";

import { PriceAgreementPanel } from "@/components/customers/PriceAgreementPanel";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { Customer } from "@/lib/repositories/customersRepository";
import { PriceAgreement } from "@/lib/repositories/priceAgreementsRepository";
import { TimelineEntry } from "@/lib/repositories/timelineRepository";
import { Order } from "@/lib/repositories/ordersRepository";
import { Complaint } from "@/lib/repositories/complaintsRepository";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStationConfig } from "@/constants/stations";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  History,
  PhoneCall,
  Mail,
  AlertCircle,
  FileText,
  TrendingUp
} from "lucide-react";
import { useAppShortcut } from "@/components/ui/AppShortcutContext";

type CustomerInvoice = {
  id: string;
  nummer: string;
  datum: string;
  faelligAm: string | null;
  brutto: string;
  status: string;
};

type CustomerCapabilities = {
  canViewPrices: boolean;
  canViewQa: boolean;
  communicationProjection: "not_connected";
  marketingProjection: "not_connected";
  anonymization: "retention_policy_and_durable_receipt_missing";
};

export default function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  usePageView();
  const { id } = use(params);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [agreements, setAgreements] = useState<PriceAgreement[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [capabilities, setCapabilities] = useState<CustomerCapabilities | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { openShortcut } = useAppShortcut();


  useEffect(() => {
    async function load() {
      if (id === "new") {
        setIsLoading(false);
        return;
      }
      
      try {
        setLoadError(null);
        const { getCustomerDetailsAction } = await import("./actions");
        const res = await getCustomerDetailsAction(id as string);
        
        if (res.ok && res.data) {
          setCustomer(res.data.customer as unknown as Customer);
          setAgreements(res.data.agreements as unknown as PriceAgreement[]);
          setOrders(res.data.orders.map((o: Record<string, any>) => ({
             ...o,
             statusText: o.statusText || o.status || undefined,
          })) as Order[]);
          setComplaints(res.data.complaints.map((c: Record<string, any>) => ({
             ...c,
             photoIds: Array.isArray(c.photoIds) ? c.photoIds : [],
             resolvedAt: c.resolvedAt || undefined,
             resolution: c.resolution || undefined,
          })) as Complaint[]);
          setInvoices(res.data.rechnungen as CustomerInvoice[]);
          setCapabilities(res.data.capabilities);
          setTimeline([]);
        } else {
           setCustomer(null);
           setLoadError(res.message || "Kundendetails konnten nicht geladen werden.");
        }
      } catch (err) {
        console.error("Error loading customer profile:", err);
        setCustomer(null);
        setLoadError("Kundendetails konnten nicht geladen werden.");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  if (isLoading) {
    return (
      <div className="p-8 font-bold text-text-muted flex flex-col items-center justify-center min-h-screen space-y-4 bg-bg-app-soft">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Customers',href:'/customers'}, {label:'[id]'}]} />
        <BackButton label="Customers" href="/customers" />
      </div>
      
        <div className="w-12 h-12 rounded-full border-4 border-neutral-gray-300 border-t-navy-900 animate-spin"></div>
        <p className="text-lg">Lade Kundenkartei...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 text-center min-h-screen bg-transparent flex flex-col items-center justify-center space-y-4">
        <AlertCircle className="w-16 h-16 text-danger-red animate-bounce" />
        <h2 className="text-2xl font-bold text-navy-900">{loadError ? "Kundendaten nicht verfügbar" : "Kunde nicht gefunden"}</h2>
        <p className="text-text-muted">{loadError || "Der gesuchte Kunde existiert nicht."}</p>
        <Link href="/customers">
          <Button className="bg-navy-900 text-white rounded-xl">Zurück zur Kundenliste</Button>
        </Link>
      </div>
    );
  }

  // Segment active orders
  const activeOrders = orders.filter(o => o.status === "in_progress");

  // Top 5 parts
  const allParts = orders.flatMap(o => o.parts || []);
  const partFreq = allParts.reduce<Record<string, number>>((acc, p) => {
    const pObj = p as { name?: string; quantity?: number | string };
    const name = String(pObj.name || "Unbekanntes Teil");
    acc[name] = (acc[name] || 0) + Number(pObj.quantity || 1);
    return acc;
  }, {});
  const topParts = Object.entries(partFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Similar/Recent Orders (max 10)
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.intakeDate || b.dueDate || "").getTime() - new Date(a.intakeDate || a.dueDate || "").getTime())
    .slice(0, 10);

  // Map complaint reasons
  const mapComplaintReason = (reason: string) => {
    const maps: Record<string, string> = {
      surface_quality: "Oberflächengüte ungenügend",
      wrong_surface: "Falsche Oberfläche",
      damage: "Beschädigung am Werkstück",
      delay: "Terminüberschreitung",
      communication: "Kommunikationsfehler",
      customer_expectation: "Erwartung nicht getroffen",
      transport: "Transportschaden",
      other: "Sonstiges"
    };
    return maps[reason] || reason;
  };

  return (
    <div className="min-h-screen bg-transparent pb-16 font-sans">
      {/* Top bar with back navigation */}
      <div className="bg-white border-b border-neutral-gray-300 py-4 px-4 md:px-8 mb-6 flex items-center justify-between shadow-xs sticky top-0 z-10">
        
        <span className="font-mono text-sm text-text-muted font-bold">KUNDENID: {customer.customerNumber}</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column (Profile, Orders, Agreements, Complaints, Similar Orders, Notes) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Kopfbereich (Header) */}
            <CustomerProfileHeader customer={customer} />

            {/* Werkstattgedächtnis & Notizen */}
            <Card className="border-2 border-neutral-gray-300 rounded-3xl overflow-hidden shadow-xs bg-white">
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                  <h3 className="text-xl font-bold font-serif text-navy-900">Werkstattgedächtnis</h3>
                  <Badge variant="outline" className="text-text-muted font-semibold">Technischer Notizzettel</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Notes Card */}
                  <div className="bg-bg-app-soft p-5 rounded-2xl border border-neutral-gray-100 space-y-2">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Wichtige Besonderheiten</span>
                    <p className="text-sm font-medium text-navy-900 leading-relaxed italic">
                      {customer.notes || "Keine besonderen technischen Anweisungen vermerkt."}
                    </p>
                  </div>

                  {/* Customer Risk profile */}
                  <div className={`p-5 rounded-2xl border space-y-3 ${
                    customer.risk === "Hoch" 
                      ? "bg-accent-orange-soft/50 border-danger-red text-danger-red" 
                      : customer.risk === "Mittel"
                        ? "bg-gold-100 border-gold-600 text-gold-600"
                        : customer.risk === "Niedrig"
                          ? "bg-success-green-soft/50 border-success-green text-success-green"
                          : "bg-bg-app-soft border-neutral-gray-300 text-text-muted"
                  }`}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`w-5 h-5 ${
                        customer.risk === "Hoch" 
                          ? "text-danger-red" 
                          : customer.risk === "Mittel"
                            ? "text-gold-600"
                            : customer.risk === "Niedrig"
                              ? "text-success-green"
                              : "text-text-muted"
                      }`} />
                      <span className="text-[10px] font-black uppercase tracking-wider">Risikobeurteilung: {customer.risk || "Nicht bewertet"}</span>
                    </div>
                    <p className="text-xs font-semibold leading-relaxed">
                      {customer.riskNote || "Keine Begründung zur Risikobeurteilung hinterlegt."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-bold text-text-muted bg-bg-app-soft/40 p-3 rounded-xl border border-neutral-gray-300">
                  <span className="text-navy-900">Bevorzugter Kommunikationskanal:</span>
                  <span className="bg-white px-2 py-0.5 rounded-md border text-navy-900 shadow-2xs">{customer.prefComm || "Nicht hinterlegt"}</span>
                </div>
              </CardContent>
            </Card>

            {/* Aktive Aufträge */}
            <Card className="border-2 border-neutral-gray-300 rounded-3xl overflow-hidden shadow-xs bg-white">
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold font-serif text-navy-900">Laufende Aufträge</h3>
                    <p className="text-xs font-semibold text-text-muted">Aktuell in der Werkstatt</p>
                  </div>
                  <Badge className="bg-navy-900 text-white font-extrabold text-xs px-2.5 py-1">
                    {activeOrders.length} Aktiv
                  </Badge>
                </div>

                <div className="space-y-4">
                  {activeOrders.map(order => {
                    const config = getStationConfig(order.station);
                    const isRed = order.risk === "red";
                    const isOrange = order.risk === "orange";
                    
                    return (
                      <div key={order.id} className="p-5 bg-white border-2 border-neutral-gray-100 hover:border-gold-600 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-xs group">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-navy-900 text-base">{order.orderNumber}</span>
                            <Badge variant="outline" className={`text-[9px] font-black uppercase ${
                              isRed 
                                ? "bg-accent-orange-soft text-danger-red border-danger-red" 
                                : isOrange 
                                  ? "bg-gold-100 text-accent-orange border-accent-orange" 
                                  : "bg-bg-app-soft text-navy-900 border-neutral-gray-300"
                            }`}>
                              {order.statusText || "Nicht hinterlegt"}
                            </Badge>
                          </div>
                          <h4 className="font-bold text-navy-900 text-lg font-serif">{order.title}</h4>
                          
                          <div className="flex items-center gap-3 text-xs text-text-muted font-bold">
                            <span>Eingang: {order.intakeDate}</span>
                            <span>•</span>
                            <span className="text-navy-900 font-extrabold bg-bg-app-soft px-2.5 py-0.5 rounded-lg border border-neutral-gray-100/50">
                              Aktuell: {config.name}
                            </span>
                          </div>
                        </div>

                        <div className="flex md:flex-col items-end justify-between md:justify-center border-t md:border-t-0 pt-3 md:pt-0 shrink-0">
                          <div className="text-right">
                            <span className="text-[10px] text-text-muted font-extrabold block uppercase">Termin</span>
                            <span className={`font-black text-base ${isRed ? "text-danger-red" : isOrange ? "text-accent-orange" : "text-navy-900"}`}>
                              {order.dueValue || order.dueDate}
                            </span>
                          </div>
                          
                          <Link href={`/orders?search=${order.orderNumber}`} className="mt-2 text-xs font-bold text-navy-900 hover:underline flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                            <span>Zur Steuerung</span>
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}

                  {activeOrders.length === 0 && (
                    <div className="p-8 text-center text-text-muted bg-bg-app-soft border rounded-2xl space-y-2 border-dashed">
                      <Clock className="w-8 h-8 mx-auto text-neutral-gray-300" />
                      <p className="font-bold text-text-muted">Keine aktiven Aufträge</p>
                      <p className="text-xs max-w-md mx-auto">Keine bestätigten Aufträge mit dem gespeicherten Status „in_progress“.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Preisabsprachen */}
            {capabilities?.canViewPrices ? (
              <PriceAgreementPanel agreements={agreements} />
            ) : (
              <Card className="rounded-3xl border-2 border-neutral-gray-300 bg-white p-6 text-sm text-text-muted">
                Preisvereinbarungen sind für diese Rolle nicht freigegeben.
              </Card>
            )}

            {/* Reklamationen & Nacharbeit */}
            {!capabilities?.canViewQa ? (
              <Card className="rounded-3xl border-2 border-neutral-gray-300 bg-white p-6 text-sm text-text-muted">
                Reklamations- und QS-Daten sind für diese Rolle nicht freigegeben.
              </Card>
            ) : (
            <Card className="border-2 border-danger-red rounded-3xl overflow-hidden shadow-xs bg-white">
              <div className="bg-linear-to-br from-navy-900 to-black p-6 rounded-[24px] text-white flex flex-col justify-between relative overflow-hidden group">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-danger-red" />
                  <h3 className="text-lg font-bold font-serif text-danger-red">Qualitätswarnungen & Reklamationen</h3>
                </div>
                <Badge variant="outline" className="bg-white border-danger-red text-danger-red font-extrabold text-xs">
                  {complaints.length} Fälle
                </Badge>
              </div>
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="space-y-4">
                  {complaints.map(c => (
                    <div key={c.id} className="p-5 bg-accent-orange-soft/50 border border-danger-red rounded-2xl space-y-3 shadow-2xs">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-danger-red pb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-danger-red text-danger-red font-bold rounded text-[10px] uppercase">
                            {mapComplaintReason(c.reason)}
                          </span>
                          <span className="text-xs text-slate-450 font-bold">Erfasst: {new Date(c.createdAt).toLocaleDateString("de-DE")}</span>
                        </div>
                        
                        <div className="text-xs font-bold text-text-muted flex items-center gap-1">
                          <span>Betrifft:</span>
                          <Link href={`/orders?search=${c.orderId}`} className="text-navy-900 hover:underline">
                            {c.orderId}
                          </Link>
                        </div>
                      </div>

                      <p className="text-sm font-semibold text-navy-900 leading-relaxed">
                        {c.description}
                      </p>

                      {c.resolvedAt ? (
                        <div className="p-3 bg-success-green-soft border border-success-green rounded-xl text-success-green text-xs font-bold flex items-start gap-2">
                          <CheckCircle2 className="w-4.5 h-4.5 text-success-green shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[10px] uppercase font-black text-success-green block">Lösung ({new Date(c.resolvedAt).toLocaleDateString("de-DE")})</span>
                            {c.resolution}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-gold-100 border border-gold-600 rounded-xl text-gold-600 text-xs font-bold flex items-center gap-2">
                          <Clock className="w-4.5 h-4.5 text-gold-600 shrink-0" />
                          <span>Gespeicherter Status: {c.status || "Nicht hinterlegt"}</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {complaints.length === 0 && (
                    <div className="p-6 text-center text-text-muted bg-bg-app-soft border border-neutral-gray-100 rounded-2xl space-y-1">
                      <p className="font-bold text-text-muted">Keine bestätigten Reklamationen vorhanden</p>
                      <p className="text-xs">Der Reklamationsbestand wurde erfolgreich und ohne Treffer geladen.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Wiederkehrende Teile */}
            <Card className="border-2 border-neutral-gray-300 rounded-3xl overflow-hidden shadow-xs bg-white">
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold font-serif text-navy-900">Wiederkehrende Teile</h3>
                    <p className="text-xs font-semibold text-text-muted">Top 5 Bauteile dieses Kunden nach Häufigkeit</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {topParts.length > 0 ? topParts.map((p, idx) => (
                    <Badge key={idx} variant="outline" className="px-3 py-1.5 bg-bg-app-soft text-navy-900 font-bold border-neutral-gray-300">
                      {p.name} <span className="ml-2 text-accent-orange">({p.count}x)</span>
                    </Badge>
                  )) : (
                    <p className="text-text-muted text-sm font-semibold italic py-4">Noch keine Bauteile erfasst.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Ähnliche Aufträge */}
            <Card className="border-2 border-neutral-gray-300 rounded-3xl overflow-hidden shadow-xs bg-white">
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold font-serif text-navy-900">Ähnliche Aufträge (Zuletzt)</h3>
                    <p className="text-xs font-semibold text-text-muted">Letzte 10 Aufträge dieses Kunden</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {recentOrders.map(order => (
                    <div key={order.id} className="p-4 bg-bg-app-soft/50 hover:bg-bg-app-soft border border-neutral-gray-100 rounded-xl flex items-center justify-between gap-4 transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-text-muted">{order.orderNumber}</span>
                          <span className="text-xs text-text-muted">• Eingang: {order.intakeDate || "Nicht hinterlegt"}</span>
                        </div>
                        <h4 className="font-bold text-navy-900 text-sm">{order.title}</h4>
                      </div>
                      <div className="text-right">
                        <span className="rounded-lg bg-bg-app-soft px-2 py-1 text-xs font-black text-navy-900">
                          {order.status || "Nicht hinterlegt"}
                        </span>
                      </div>
                    </div>
                  ))}

                  {recentOrders.length === 0 && (
                    <p className="text-text-muted text-sm font-semibold text-center italic py-4 bg-bg-app-soft/30 border border-neutral-gray-100 rounded-xl">
                      Keine Aufträge gefunden.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Rechnungen & Offene Posten */}
            <Card className="border-2 border-neutral-gray-300 rounded-3xl overflow-hidden shadow-xs bg-white">
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold font-serif text-navy-900 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-text-muted" /> Rechnungen & Offene Posten
                    </h3>
                    <p className="text-xs font-semibold text-text-muted">Letzte Rechnungsaktivitäten dieses Kunden</p>
                  </div>
                  {capabilities?.canViewPrices && (
                    <Link href={`/buchhaltung/rechnungen?customer=${customer.customerNumber}`}>
                      <Button variant="outline" className="text-xs font-bold">Alle Rechnungen</Button>
                    </Link>
                  )}
                </div>
                
                <div className="space-y-3">
                  {!capabilities?.canViewPrices ? (
                    <div className="rounded-2xl border border-neutral-gray-200 bg-bg-app-soft p-4 text-sm text-text-muted">
                      Rechnungsdaten sind für diese Rolle nicht freigegeben.
                    </div>
                  ) : invoices.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-neutral-gray-200 p-4 text-sm text-text-muted">
                      Keine bestätigten Rechnungen für diesen Kunden vorhanden.
                    </div>
                  ) : invoices.slice(0, 5).map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between rounded-2xl border border-neutral-gray-200 bg-white p-4">
                      <div>
                        <span className="block text-[10px] font-bold text-text-muted">{invoice.nummer} · {new Date(invoice.datum).toLocaleDateString("de-DE")}</span>
                        <span className="text-sm font-black text-navy-900">{invoice.status}</span>
                      </div>
                      <span className="text-sm font-black text-navy-900">{Number(invoice.brutto).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Kommunikationshistorie */}
            <Card className="border-2 border-neutral-gray-300 rounded-3xl overflow-hidden shadow-xs bg-white">
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                  <h3 className="text-xl font-bold font-serif text-navy-900">Kommunikationshistorie</h3>
                  <Badge variant="outline" className="text-text-muted font-semibold">Letzte Kontakte</Badge>
                </div>

                <div className="space-y-4">
                  <div className="p-5 bg-blue-50 border border-blue-200 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2">
                      <PhoneCall className="w-5 h-5 text-blue-600" />
                      <h4 className="font-bold text-blue-900">Kommunikationsprojektion nicht eingebettet</h4>
                    </div>
                    <p className="text-sm text-blue-800 leading-relaxed">
                      Diese Profilseite zeigt keine erfundenen Kontakte. Bestätigte Telefonnotizen bleiben in der tenantgebundenen Kommunikationszentrale erhalten; eine gefilterte Profilprojektion ist noch nicht verbunden.
                    </p>
                    <Link href="/telefonnotiz?source=kunde">
                      <Button variant="outline" className="mt-2 text-xs bg-white border-blue-300 text-blue-700 hover:bg-blue-100">
                        Zur Kommunikationszentrale
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Right Column (Timeline & Quick Actions) */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Marketing & Insights */}
            <Card className="border-2 border-blue-200 bg-linear-to-br from-blue-50 to-indigo-50 rounded-3xl overflow-hidden shadow-sm">
              <CardContent className="p-6 space-y-5">
                <h3 className="text-lg font-bold font-serif text-blue-900 flex items-center gap-2 border-b border-blue-200 pb-3">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Marketing Profil
                </h3>
                
                <div className="rounded-xl border border-blue-200 bg-white p-4 text-sm text-blue-900">
                  Attribution, Segment und Feedback-Score werden hier erst angezeigt, wenn eine bestätigte kundenbezogene Marketingprojektion verbunden ist. Derzeit sind keine Werte belegt.
                </div>
                
                <Link href={`/marketing?customer=${customer.customerNumber}`}>
                  <Button variant="outline" className="w-full mt-2 text-xs font-bold border-blue-300 text-blue-700 bg-white hover:bg-blue-100">
                    Marketing-Historie
                  </Button>
                </Link>
              </CardContent>
            </Card>
            
            {/* Quick Actions Panel */}
            <Card className="border-2 border-neutral-gray-300 rounded-3xl overflow-hidden shadow-xs bg-navy-900 text-white sticky top-24">
              <CardContent className="p-6 md:p-8 space-y-6">
                <h3 className="text-lg font-bold font-serif border-b border-white/10 pb-4">Schnellaktionen</h3>
                
                <div className="flex flex-col gap-3">
                  <button onClick={() => openShortcut("new_order")} className="w-full">
                    <Button className="w-full h-12 bg-white hover:bg-neutral-gray-100 text-navy-900 font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md">
                      Neuer Auftrag anlegen
                    </Button>
                  </button>

                  {customer.phone ? (
                    <a href={`tel:${customer.phone}`} className="w-full">
                      <Button variant="outline" className="w-full h-12 bg-transparent border-white/20 hover:bg-white/10 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2">
                        <PhoneCall className="w-4 h-4 text-success-green" />
                        <span>Kunde anrufen</span>
                      </Button>
                    </a>
                  ) : (
                    <Button variant="outline" disabled className="w-full h-12 bg-transparent border-white/10 text-white/40 font-extrabold text-sm rounded-xl flex items-center justify-center gap-2" title="Keine Telefonnummer hinterlegt">
                      <PhoneCall className="w-4 h-4" />
                      <span>Keine Rufnummer</span>
                    </Button>
                  )}

                  {customer.email ? (
                    <a href={`mailto:${customer.email}`} className="w-full">
                      <Button variant="outline" className="w-full h-12 bg-transparent border-white/20 hover:bg-white/10 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2">
                        <Mail className="w-4 h-4 text-accent-orange" />
                        <span>E-Mail schreiben</span>
                      </Button>
                    </a>
                  ) : (
                    <Button variant="outline" disabled className="w-full h-12 bg-transparent border-white/10 text-white/40 font-extrabold text-sm rounded-xl flex items-center justify-center gap-2" title="Keine E-Mail hinterlegt">
                      <Mail className="w-4 h-4" />
                      <span>Keine E-Mail</span>
                    </Button>
                  )}

                  {/* DSGVO-Anonymisierung bleibt fail-closed, bis der vollständige Daten- und Belegvertrag steht. */}
                  {customer.name && !customer.name.startsWith("ANONYMISIERT") && (
                    <div className="pt-4 mt-2 border-t border-white/10">
                      <Button
                        variant="outline"
                        disabled
                        title="Datenumfang, Aufbewahrungsregeln und dauerhafter Auditbeleg sind noch nicht vollständig verbunden."
                        className="w-full min-h-10 bg-transparent border-white/20 text-white/50 font-bold text-xs rounded-xl flex items-center justify-center gap-2"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        <span>Anonymisierung nicht freigegeben</span>
                      </Button>
                      <p className="mt-2 text-[10px] leading-relaxed text-white/50">Es wurden keine Daten verändert. Aufbewahrungsmatrix, Tenant-Transaktion, Idempotenz und dauerhafter Auditbeleg fehlen noch.</p>
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10 pt-4 text-center">
                  <p className="text-[10px] text-white/50 font-bold uppercase">Werkstatt Cockpit V1.0</p>
                </div>
              </CardContent>
            </Card>

            {/* Aggregated Order Timeline */}
            <div className="bg-white border-2 border-neutral-gray-300 rounded-3xl p-6 md:p-8 shadow-xs">
              <div className="flex justify-between items-center border-b pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-text-muted" />
                  <h3 className="text-lg font-bold font-serif text-navy-900">Kundengeschichte</h3>
                </div>
                <Badge variant="outline" className="text-text-muted text-[10px] font-bold">Aggregiert</Badge>
              </div>
              <OrderTimeline entries={timeline} />
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
