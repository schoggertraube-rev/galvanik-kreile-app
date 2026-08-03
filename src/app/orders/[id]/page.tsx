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
import { ErfassungCard } from "@/components/erfassung/ErfassungCard";
import { timelineRepository, TimelineEntry } from "@/lib/repositories/timelineRepository";
import { ordersRepository, Order } from "@/lib/repositories/ordersRepository";
import { Clock, Box, PhoneCall, CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getStationConfig } from "@/constants/stations";
import { customersRepository, Customer } from "@/lib/repositories/customersRepository";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  usePageView();
  const { id } = use(params);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    async function load() {
      // Wenn "new" übergeben wird, ist das ein fehlerhafter Pfad durch Next.js Cache o.ä.
      if (id === "new") return;
      
      const orders = await ordersRepository.getAll();
      const o = orders.find(x => x.id === id || x.orderNumber === id) || orders[0];
      setOrder(o);
      
      const custs = await customersRepository.getAll();
      setCustomer(custs.find(c => c.id === o.customerId) || null);

      const t = await timelineRepository.getForOrder(o.id);
      setTimeline(t);
    }
    load();
  }, [id]);

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
          
          <ErfassungCard orderId={order.id} />
          
          <OrderProfitabilityCard order={order} />
        </div>

        {/* Right Column (Timeline & Docs) */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* Vernetzte Bereiche */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border-2 border-neutral-gray-200 rounded-3xl p-5 hover:border-navy-400 transition-colors shadow-sm">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-2">Kontrolle</span>
              {(parseInt(order.orderNumber.replace(/\\D/g, '') || "0") % 2 === 0) ? (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-black text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> QS Bestanden</span>
                  <Link href={`/kontrolle?order=${order.orderNumber}`} className="text-xs text-navy-600 font-bold hover:underline">Prüfprotokoll öffnen</Link>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-black text-amber-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Nacharbeit</span>
                  <Link href={`/kontrolle?order=${order.orderNumber}`} className="text-xs text-navy-600 font-bold hover:underline">Details ansehen</Link>
                </div>
              )}
            </div>

            <div className="bg-white border-2 border-neutral-gray-200 rounded-3xl p-5 hover:border-navy-400 transition-colors shadow-sm">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-2">Rechnung</span>
              {order.status === "completed" || order.status === "done" ? (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-black text-navy-900">RE-{new Date().getFullYear()}-{order.orderNumber.substring(0,4)}</span>
                  <Link href={`/buchhaltung/rechnungen/1`} className="text-xs text-navy-600 font-bold hover:underline">Rechnung anzeigen</Link>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-text-muted italic">Noch nicht abgerechnet</span>
                </div>
              )}
            </div>
            
            <div className="col-span-2 bg-linear-to-r from-blue-50 to-indigo-50 border-2 border-blue-100 rounded-3xl p-5 shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block mb-1">Marketing-Quelle</span>
                  <span className="text-sm font-black text-navy-900">Empfehlung / Bestandskunde</span>
                </div>
                <Link href="/marketing/attribution" className="text-xs font-bold text-blue-600 bg-white px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50">
                  Kampagne ansehen
                </Link>
              </div>
            </div>
          </div>
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
