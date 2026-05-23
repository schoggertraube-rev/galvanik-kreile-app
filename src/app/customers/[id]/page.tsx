"use client";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import { CustomerProfileHeader } from "@/components/customers/CustomerProfileHeader";
import { CustomerEditModal } from "@/components/customers/CustomerEditModal";
import { PriceAgreementPanel } from "@/components/customers/PriceAgreementPanel";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { customersRepository, Customer } from "@/lib/repositories/customersRepository";
import { priceAgreementsRepository, PriceAgreement } from "@/lib/repositories/priceAgreementsRepository";
import { timelineRepository, TimelineEntry } from "@/lib/repositories/timelineRepository";
import { ordersRepository, Order } from "@/lib/repositories/ordersRepository";
import { complaintsRepository, Complaint } from "@/lib/repositories/complaintsRepository";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStationConfig } from "@/constants/stations";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  ArrowLeft,
  AlertCircle,
  History,
  PhoneCall,
  Mail
} from "lucide-react";

export default function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [agreements, setAgreements] = useState<PriceAgreement[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleSaveCustomer = async (changes: Partial<Customer>) => {
    if (!customer) return;
    const updated = await customersRepository.updateCustomer(customer.id, changes);
    if (updated) {
      setCustomer(updated);
    }
  };

  useEffect(() => {
    async function load() {
      if (id === "new") {
        setIsLoading(false);
        return;
      }
      
      try {
        const custs = await customersRepository.getAll();
        const c = custs.find(x => x.id === id || x.customerNumber === id) || custs[0];
        setCustomer(c);
        
        if (c) {
          const ags = await priceAgreementsRepository.getByCustomer(c.id);
          setAgreements(ags);
          
          const t = await timelineRepository.getForCustomer(c.id);
          setTimeline(t);

          const allOrders = await ordersRepository.getAll();
          const customerOrders = allOrders.filter(o => o.customerId === c.id);
          setOrders(customerOrders);

          const customerComplaints = await complaintsRepository.getByCustomer(c.id);
          setComplaints(customerComplaints);
        }
      } catch (err) {
        console.error("Error loading customer profile:", err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  if (isLoading) {
    return (
      <div className="p-8 font-bold text-slate-500 flex flex-col items-center justify-center min-h-screen space-y-4 bg-slate-50">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-blue-900 animate-spin"></div>
        <p className="text-lg">Lade Kundenkartei...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 text-center min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <AlertCircle className="w-16 h-16 text-red-500 animate-bounce" />
        <h2 className="text-2xl font-bold text-slate-800">Kunde nicht gefunden</h2>
        <p className="text-slate-500">Der gesuchte Kunde existiert nicht oder wurde gelöscht.</p>
        <Link href="/customers">
          <Button className="bg-slate-900 text-white rounded-xl">Zurück zur Kundenliste</Button>
        </Link>
      </div>
    );
  }

  // Segment active vs historic orders
  const activeOrders = orders.filter(o => o.status !== "done" && o.status !== "closed");
  const historicOrders = orders.filter(o => o.status === "done" || o.status === "closed");

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
    <div className="min-h-screen bg-slate-50 pb-16 font-sans">
      {/* Top bar with back navigation */}
      <div className="bg-white border-b border-slate-200 py-4 px-4 md:px-8 mb-6 flex items-center justify-between shadow-xs sticky top-0 z-10">
        <Link href="/customers" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold transition-all group">
          <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          <span>Zurück zur Kundenübersicht</span>
        </Link>
        <span className="font-mono text-sm text-slate-400 font-bold">KUNDENID: {customer.customerNumber}</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column (Profile, Orders, Agreements, Complaints, Similar Orders, Notes) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Kopfbereich (Header) */}
            <CustomerProfileHeader customer={customer} />

            {/* Werkstattgedächtnis & Notizen */}
            <Card className="border-2 border-slate-200 rounded-3xl overflow-hidden shadow-xs bg-white">
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                  <h3 className="text-xl font-bold font-serif text-slate-900">Werkstattgedächtnis</h3>
                  <Badge variant="outline" className="text-slate-500 font-semibold">Technischer Notizzettel</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Notes Card */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Wichtige Besonderheiten</span>
                    <p className="text-sm font-medium text-slate-700 leading-relaxed italic">
                      {customer.notes || "Keine besonderen technischen Anweisungen vermerkt."}
                    </p>
                  </div>

                  {/* Customer Risk profile */}
                  <div className={`p-5 rounded-2xl border space-y-3 ${
                    customer.risk === "Hoch" 
                      ? "bg-red-50/50 border-red-100 text-red-950" 
                      : customer.risk === "Mittel" 
                        ? "bg-amber-50/50 border-amber-100 text-amber-950" 
                        : "bg-emerald-50/50 border-emerald-100 text-emerald-950"
                  }`}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`w-5 h-5 ${
                        customer.risk === "Hoch" 
                          ? "text-red-650" 
                          : customer.risk === "Mittel" 
                            ? "text-amber-600" 
                            : "text-emerald-600"
                      }`} />
                      <span className="text-[10px] font-black uppercase tracking-wider">Risikobeurteilung: {customer.risk || "Niedrig"}</span>
                    </div>
                    <p className="text-xs font-semibold leading-relaxed">
                      {customer.riskNote || "Zuverlässiger Kunde mit einwandfreier Historie."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-bold text-slate-500 bg-blue-50/55 p-3 rounded-xl border border-blue-100">
                  <span className="text-blue-900">Bevorzugter Kommunikationskanal:</span>
                  <span className="bg-white px-2 py-0.5 rounded-md border text-blue-950 shadow-2xs">{customer.prefComm || "E-Mail"}</span>
                </div>
              </CardContent>
            </Card>

            {/* Aktive Aufträge */}
            <Card className="border-2 border-slate-200 rounded-3xl overflow-hidden shadow-xs bg-white">
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold font-serif text-slate-900">Laufende Aufträge</h3>
                    <p className="text-xs font-semibold text-slate-400">Aktuell in der Werkstatt</p>
                  </div>
                  <Badge className="bg-blue-900 text-white font-extrabold text-xs px-2.5 py-1">
                    {activeOrders.length} Aktiv
                  </Badge>
                </div>

                <div className="space-y-4">
                  {activeOrders.map(order => {
                    const config = getStationConfig(order.station);
                    const isRed = order.risk === "red";
                    const isOrange = order.risk === "orange";
                    
                    return (
                      <div key={order.id} className="p-5 bg-white border-2 border-slate-100 hover:border-blue-900 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-xs group">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900 text-base">{order.orderNumber}</span>
                            <Badge variant="outline" className={`text-[9px] font-black uppercase ${
                              isRed 
                                ? "bg-red-50 text-red-700 border-red-200" 
                                : isOrange 
                                  ? "bg-orange-50 text-orange-700 border-orange-200" 
                                  : "bg-slate-50 text-slate-700 border-slate-250"
                            }`}>
                              {order.statusText || "IN ARBEIT"}
                            </Badge>
                          </div>
                          <h4 className="font-bold text-slate-800 text-lg font-serif">{order.title}</h4>
                          
                          <div className="flex items-center gap-3 text-xs text-slate-400 font-bold">
                            <span>Eingang: {order.intakeDate}</span>
                            <span>•</span>
                            <span className="text-blue-950 font-extrabold bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100/50">
                              Aktuell: {config.name}
                            </span>
                          </div>
                        </div>

                        <div className="flex md:flex-col items-end justify-between md:justify-center border-t md:border-t-0 pt-3 md:pt-0 shrink-0">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 font-extrabold block uppercase">Termin</span>
                            <span className={`font-black text-base ${isRed ? "text-red-750" : isOrange ? "text-orange-700" : "text-slate-700"}`}>
                              {order.dueValue || order.dueDate}
                            </span>
                          </div>
                          
                          <Link href={`/orders?search=${order.orderNumber}`} className="mt-2 text-xs font-bold text-blue-900 hover:underline flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                            <span>Zur Steuerung</span>
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}

                  {activeOrders.length === 0 && (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 border rounded-2xl space-y-2 border-dashed">
                      <Clock className="w-8 h-8 mx-auto text-slate-350" />
                      <p className="font-bold text-slate-600">Keine aktiven Aufträge</p>
                      <p className="text-xs max-w-md mx-auto">Dieser Kunde hat aktuell alle Werkstattaufträge abgeschlossen oder pausiert.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Preisabsprachen */}
            <PriceAgreementPanel agreements={agreements} />

            {/* Reklamationen & Nacharbeit */}
            <Card className="border-2 border-red-200 rounded-3xl overflow-hidden shadow-xs bg-white">
              <div className="bg-red-50/50 border-b border-red-150 p-6 md:px-8 py-5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-655" />
                  <h3 className="text-lg font-bold font-serif text-red-950">Qualitätswarnungen & Reklamationen</h3>
                </div>
                <Badge variant="outline" className="bg-white border-red-200 text-red-800 font-extrabold text-xs">
                  {complaints.length} Fälle
                </Badge>
              </div>
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="space-y-4">
                  {complaints.map(c => (
                    <div key={c.id} className="p-5 bg-red-50/10 border border-red-100 rounded-2xl space-y-3 shadow-2xs">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-red-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-red-100 text-red-850 font-bold rounded text-[10px] uppercase">
                            {mapComplaintReason(c.reason)}
                          </span>
                          <span className="text-xs text-slate-450 font-bold">Erfasst: {new Date(c.createdAt).toLocaleDateString("de-DE")}</span>
                        </div>
                        
                        <div className="text-xs font-bold text-slate-600 flex items-center gap-1">
                          <span>Betrifft:</span>
                          <Link href={`/orders?search=${c.orderId}`} className="text-blue-900 hover:underline">
                            {c.orderId}
                          </Link>
                        </div>
                      </div>

                      <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                        {c.description}
                      </p>

                      {c.resolvedAt ? (
                        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-bold flex items-start gap-2">
                          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[10px] uppercase font-black text-emerald-700 block">Lösung ({new Date(c.resolvedAt).toLocaleDateString("de-DE")})</span>
                            {c.resolution}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-xs font-bold flex items-center gap-2">
                          <Clock className="w-4.5 h-4.5 text-amber-600 shrink-0" />
                          <span>Fall in Bearbeitung. Nächste Qualitätssicherung ausstehend.</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {complaints.length === 0 && (
                    <div className="p-6 text-center text-slate-400 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
                      <p className="font-bold text-emerald-800">Keine Reklamationen verzeichnet</p>
                      <p className="text-xs">Exzellente Quote! Für diesen Kunden liegen keine ungelösten Qualitätsfälle vor.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Wiederkehrende Teile & Ähnliche Aufträge */}
            <Card className="border-2 border-slate-200 rounded-3xl overflow-hidden shadow-xs bg-white">
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold font-serif text-slate-900">Wiederkehrende Teile / Ähnliche Aufträge</h3>
                    <p className="text-xs font-semibold text-slate-400">Vergangene Arbeiten & Historische Referenzen</p>
                  </div>
                  <Badge variant="outline" className="text-slate-500 font-semibold">Historische Ähnlichkeit</Badge>
                </div>

                <div className="space-y-4">
                  {historicOrders.map(order => (
                    <div key={order.id} className="p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between gap-4 transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-500">{order.orderNumber}</span>
                          <span className="text-xs text-slate-400">• Geliefert: {order.dueDate || "Erledigt"}</span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm">{order.title}</h4>
                        <div className="flex gap-2">
                          {((order.parts || []) as unknown as { name: string; finish?: string; finishStyle?: string }[]).map((p, idx: number) => (
                            <span key={idx} className="text-[10px] bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded font-bold">
                              {p.name} ({p.finish || p.finishStyle})
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-800 font-black rounded-lg">Erledigt</span>
                      </div>
                    </div>
                  ))}

                  {historicOrders.length === 0 && (
                    <p className="text-slate-500 text-sm font-semibold text-center italic py-4 bg-slate-50/30 border border-slate-100 rounded-xl">
                      Noch keine abgeschlossenen historischen Referenzarbeiten vorhanden.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Kommunikationshistorie */}
            <Card className="border-2 border-slate-200 rounded-3xl overflow-hidden shadow-xs bg-white">
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                  <h3 className="text-xl font-bold font-serif text-slate-900">Kommunikationshistorie</h3>
                  <Badge variant="outline" className="text-slate-500 font-semibold">Letzte Kontakte</Badge>
                </div>

                <div className="space-y-4">
                  <div className="p-4 border border-slate-150 rounded-xl bg-slate-50/30 space-y-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <PhoneCall className="w-3.5 h-3.5 text-emerald-600" /> Telefonat bzgl. Kostenvoranschlag
                      </span>
                      <span className="text-slate-400 font-bold">Vor 2 Tagen</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed font-semibold">
                      Herr Kreile hat mit dem Kunden telefoniert. Die Freigabe für den Jugendstilleuchter wird nach Rücksprache im Kirchenvorstand nächste Woche schriftlich erteilt.
                    </p>
                  </div>

                  <div className="p-4 border border-slate-150 rounded-xl bg-slate-50/30 space-y-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-blue-650" /> E-Mail mit Fotodokumentation versendet
                      </span>
                      <span className="text-slate-400 font-bold">Vor 7 Tagen</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed font-semibold">
                      Automatisches Update mit Foto vom Entmetallisierungsergebnis an {customer.email || "Kunden"} geschickt. Kunde hat den Empfang kurz bestätigt.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Right Column (Timeline & Quick Actions) */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Quick Actions Panel */}
            <Card className="border-2 border-slate-200 rounded-3xl overflow-hidden shadow-xs bg-slate-900 text-white sticky top-24">
              <CardContent className="p-6 md:p-8 space-y-6">
                <h3 className="text-lg font-bold font-serif border-b border-white/10 pb-4">Schnellaktionen</h3>
                
                <div className="flex flex-col gap-3">
                  <Link href={`/orders/new?customerId=${customer.id}`} className="w-full">
                    <Button className="w-full h-12 bg-white hover:bg-slate-150 text-slate-900 font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md">
                      Neuer Auftrag anlegen
                    </Button>
                  </Link>

                  {customer.phone ? (
                    <a href={`tel:${customer.phone}`} className="w-full">
                      <Button variant="outline" className="w-full h-12 bg-transparent border-white/20 hover:bg-white/10 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2">
                        <PhoneCall className="w-4 h-4 text-emerald-450" />
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
                        <Mail className="w-4 h-4 text-blue-350" />
                        <span>E-Mail schreiben</span>
                      </Button>
                    </a>
                  ) : (
                    <Button variant="outline" disabled className="w-full h-12 bg-transparent border-white/10 text-white/40 font-extrabold text-sm rounded-xl flex items-center justify-center gap-2" title="Keine E-Mail hinterlegt">
                      <Mail className="w-4 h-4" />
                      <span>Keine E-Mail</span>
                    </Button>
                  )}
                </div>

                <div className="border-t border-white/10 pt-4 text-center">
                  <p className="text-[10px] text-white/50 font-bold uppercase">Werkstatt Cockpit V1.0</p>
                </div>
              </CardContent>
            </Card>

            {/* Aggregated Order Timeline */}
            <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 md:p-8 shadow-xs">
              <div className="flex justify-between items-center border-b pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-slate-500" />
                  <h3 className="text-lg font-bold font-serif text-slate-800">Kundengeschichte</h3>
                </div>
                <Badge variant="outline" className="text-slate-400 text-[10px] font-bold">Aggregiert</Badge>
              </div>
              <OrderTimeline entries={timeline} />
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
