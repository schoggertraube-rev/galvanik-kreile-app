"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";
import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect, use } from "react";
import { OrderActionGrid } from "@/components/orders/OrderActionGrid";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { OrderProfitabilityCard } from "@/components/orders/OrderProfitabilityCard";
import { StationCompletionModal } from "@/components/orders/StationCompletionModal";
import { LabelPrintView } from "@/components/orders/LabelPrintView";
import { CaptureCard } from "@/components/erfassung/CaptureCard";
import { timelineRepository, TimelineEntry } from "@/lib/repositories/timelineRepository";
import { ordersRepository, Order } from "@/lib/repositories/ordersRepository";
import { Clock, Box, PhoneCall, CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getStationConfig } from "@/constants/stations";
import { customersRepository, Customer } from "@/lib/repositories/customersRepository";
import { getOrderConnections, type OrderConnections } from "./orderConnections.actions";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  usePageView();
  const { id } = use(params);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connections, setConnections] = useState<OrderConnections | null>(null);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (id === "new") {
        setLoadError("Der Pfad /orders/new ist kein gespeicherter Auftrag.");
        return;
      }
      try {
        setConnections(null);
        setConnectionsError(null);
        const orders = await ordersRepository.getAll();
        const found = orders.find(x => x.id === id || x.orderNumber === id);
        if (!found) {
          setLoadError("Auftrag wurde nicht gefunden.");
          return;
        }
        setOrder(found);

        const [custs, entries, connectionResult] = await Promise.all([
          customersRepository.getAll(),
          timelineRepository.getForOrder(found.id),
          getOrderConnections(found.id),
        ]);
        setCustomer(custs.find(c => c.id === found.customerId) || null);
        setTimeline(entries);
        if (connectionResult.ok) {
          setConnections(connectionResult.data);
        } else {
          setConnectionsError(connectionResult.message);
        }
        setLoadError(null);
      } catch (error) {
        console.error(error);
        setLoadError(error instanceof Error ? error.message : "Auftragsdaten konnten nicht geladen werden.");
      }
    }
    load();
  }, [id]);

  if (loadError) return <div className="p-8 font-bold text-danger-red flex items-center justify-center min-h-screen">{loadError}</div>;
  if (!order) return <div className="p-8 font-bold text-text-muted flex items-center justify-center min-h-screen">Lade Auftrag...</div>;

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-8">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Orders',href:'/orders'}, {label:'[id]'}]} />
        <BackButton label="Orders" href="/orders" />
      </div>
      
      

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-black font-serif text-navy-900">{order.orderNumber}</h1>
            <h2 className="text-2xl font-bold text-text-muted mt-1">{order.title}</h2>
          </div>
          {customer && (
            <Link href={`/customers/${customer.id}`} className="bg-white border-2 border-neutral-gray-200 rounded-2xl p-4 hover:border-navy-400 hover:shadow-md transition-all flex flex-col items-end text-right group">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Kunde</span>
              <span className="text-lg font-black text-navy-900 group-hover:underline">{customer.name}</span>
              <span className="text-xs text-text-muted font-semibold">{customer.customerNumber}</span>
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-4 mt-4">
          <Link href={`/warendurchlauf/${getStationConfig(order.currentStationId || order.station || "wareneingang").name.toLowerCase().includes("galvanik") ? "galvanik" : "wareneingang"}?station=${order.currentStationId}`} className="px-3 py-1.5 bg-navy-700 text-white hover:bg-navy-800 transition-colors font-bold rounded-lg text-sm flex items-center shadow-sm">
            <Box className="w-4 h-4 mr-2" /> Station: {getStationConfig(order.currentStationId || order.station || "wareneingang").name}
          </Link>
          {(() => {
            if (!order.dueDate) {
              return (
                <span className="px-3 py-1.5 bg-green-100 text-green-800 font-bold rounded-lg text-sm flex items-center">
                  <Clock className="w-4 h-4 mr-2" /> Neu angelegt
                </span>
              );
            }
            const due = new Date(order.dueDate);
            const today = new Date();
            const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate());
            const isOverdue = dueMidnight < todayMidnight;
            
            if (isOverdue) {
              const diffHours = Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60)));
              return (
                <span className="px-3 py-1.5 bg-danger-red text-danger-red font-bold rounded-lg text-sm flex items-center">
                  <Clock className="w-4 h-4 mr-2" /> Überfällig seit: {diffHours} Stunden
                </span>
              );
            } else {
              return (
                <span className="px-3 py-1.5 bg-green-100 text-green-800 font-bold rounded-lg text-sm flex items-center">
                  <Clock className="w-4 h-4 mr-2" /> Fällig am: {due.toLocaleDateString("de-DE")}
                </span>
              );
            }
          })()}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (Actions & Details) */}
        <div className="lg:col-span-7 space-y-8">
          <OrderActionGrid 
            orderId={order.id}
            customerId={order.customerId}
            currentStationId={order.currentStationId || order.station || "wareneingang"}
            currentStatus={order.status}
            customerPhone={undefined} // Not available on Order mock object directly yet
            onCompleteStation={() => setCompletionModalOpen(true)} 
            onPrint={() => setPrintOpen(true)} 
          />
          
          <div className="bg-white border-2 border-neutral-gray-300 rounded-3xl p-6 md:p-8 shadow-sm">
            <h3 className="text-sm font-extrabold text-text-muted uppercase tracking-widest pl-1 mb-4">Teile ({order.parts?.length || 0})</h3>
            <div className="space-y-3">
              {order.parts?.map((p: { quantity?: number; name?: string; surfaceRequested?: string }, i: number) => (
                <div key={i} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 bg-bg-app-soft rounded-2xl border-2 border-neutral-gray-100 gap-3">
                  <span className="font-bold text-navy-900 text-lg">{p.quantity}x {p.name}</span>
                  {p.surfaceRequested && (
                    <span className="text-sm font-bold text-text-muted bg-white px-3 py-1.5 rounded-lg border-2 border-neutral-gray-300">
                      {p.surfaceRequested}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <CaptureCard orderId={order.id} stationKuerzel={order.currentStationId || order.station} />
          
          <OrderProfitabilityCard order={order} />
        </div>

        {/* Right Column (Timeline & Docs) */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* Mandantengebundene, serverbestätigte Verknüpfungen */}
          {connectionsError ? (
            <div role="alert" className="bg-red-50 border-2 border-red-200 rounded-3xl p-5 text-sm font-bold text-red-800">
              {connectionsError}
            </div>
          ) : !connections ? (
            <div className="animate-pulse bg-neutral-gray-100 rounded-3xl h-40" />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border-2 border-neutral-gray-200 rounded-3xl p-5 shadow-sm">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-2">Qualitätskontrolle</span>
                {connections.capabilities.quality === "forbidden" ? (
                  <span className="text-sm font-bold text-text-muted">QS-Daten sind für diese Rolle nicht freigegeben</span>
                ) : connections.quality ? (
                  <div className="flex flex-col gap-1">
                    <span className={`text-sm font-black flex items-center gap-1 ${connections.quality.result.toLowerCase() === "bestanden" ? "text-emerald-700" : "text-amber-700"}`}>
                      {connections.quality.result.toLowerCase() === "bestanden"
                        ? <CheckCircle2 className="w-4 h-4" />
                        : <AlertTriangle className="w-4 h-4" />}
                      {connections.quality.result}
                    </span>
                    <span className="text-xs font-semibold text-text-muted">
                      Geprüft {new Date(connections.quality.inspectedAt).toLocaleDateString("de-DE")}
                      {connections.quality.examiner ? ` · ${connections.quality.examiner}` : ""}
                    </span>
                    <Link href={`/kontrolle?order=${encodeURIComponent(order.orderNumber)}`} className="text-xs text-navy-600 font-bold hover:underline">Prüfdatensatz öffnen</Link>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-text-muted">Keine QS-Prüfung verknüpft</span>
                    <Link href={`/kontrolle?order=${encodeURIComponent(order.orderNumber)}`} className="text-xs text-navy-600 font-bold hover:underline">Zur Qualitätskontrolle</Link>
                  </div>
                )}
              </div>

              <div className="bg-white border-2 border-neutral-gray-200 rounded-3xl p-5 shadow-sm">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-2">Rechnung</span>
                {connections.capabilities.invoice === "forbidden" ? (
                  <span className="text-sm font-bold text-text-muted">Rechnungsdaten sind für diese Rolle nicht freigegeben</span>
                ) : connections.invoice ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-black text-navy-900">{connections.invoice.number}</span>
                    <span className="text-xs font-semibold text-text-muted">
                      {connections.invoice.status} · {connections.invoice.grossEur.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                    </span>
                    <Link href={`/buchhaltung/rechnungen/${connections.invoice.id}`} className="text-xs text-navy-600 font-bold hover:underline">Rechnung anzeigen</Link>
                  </div>
                ) : (
                  <span className="text-sm font-bold text-text-muted">Keine Rechnung mit diesem Auftrag verknüpft</span>
                )}
              </div>

              <div className="col-span-2 bg-blue-50 border-2 border-blue-100 rounded-3xl p-5 shadow-sm">
                <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block mb-1">Anfrage- und Marketingquelle</span>
                {connections.capabilities.marketing === "forbidden" ? (
                  <span className="text-sm font-bold text-text-muted">Marketing-Attribution ist für diese Rolle nicht freigegeben</span>
                ) : connections.marketing ? (
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-sm font-black text-navy-900 block">{connections.marketing.sourceLabel}</span>
                      <span className="text-xs font-semibold text-text-muted">
                        Typ: {connections.marketing.sourceType}
                        {connections.marketing.touchpoint ? ` · Kanal: ${connections.marketing.touchpoint.channel}` : ""}
                        {connections.marketing.confidencePercent !== null ? ` · Konfidenz: ${connections.marketing.confidencePercent.toLocaleString("de-DE")} %` : ""}
                      </span>
                    </div>
                    <Link href="/marketing/attribution" className="text-xs font-bold text-blue-700 bg-white px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-100">
                      Attribution öffnen
                    </Link>
                  </div>
                ) : (
                  <span className="text-sm font-bold text-text-muted">Keine Anfrage oder Marketingquelle mit diesem Auftrag verknüpft</span>
                )}
                {connections.warnings.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs font-semibold text-amber-800">
                    {connections.warnings.map((warning) => <li key={warning}>Datenhinweis: {warning}</li>)}
                  </ul>
                )}
              </div>
            </div>
          )}
          <div className="bg-white border-2 border-neutral-gray-300 rounded-3xl p-6 md:p-8 shadow-sm">
            <OrderTimeline entries={timeline} />
          </div>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <PhoneCall className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold font-serif text-blue-900 text-lg">Telefonnotizen (Vorbereitet)</h3>
            </div>
            <p className="text-sm text-blue-800 leading-relaxed mb-4">
              Die Integration echter Telefonnotizen aus der Kommunikationszentrale ist vorbereitet. 
              Sobald das System vollständig mit echten Auftragsdaten verknüpft ist, werden Anrufe zu diesem Auftrag hier protokolliert.
            </p>
            <Link href="/telefonnotiz?source=warendurchlauf">
              <Button variant="outline" className="w-full text-xs bg-white border-blue-300 text-blue-700 hover:bg-blue-100">
                Zur Kommunikationszentrale
              </Button>
            </Link>
          </div>
        </div>
      </div>
      {completionModalOpen && (
        <StationCompletionModal 
          orderId={order.id} 
          customerId={order.customerId} 
          currentStationId={order.currentStationId || order.station || "wareneingang"}
          onClose={() => setCompletionModalOpen(false)} 
        />
      )}
      {printOpen && (
        <LabelPrintView 
          order={order} 
          onClose={() => setPrintOpen(false)} 
          showPreviewModal={true} 
        />
      )}
    </div>
  );
}
