"use client";
import { useState, useEffect, use } from "react";
import { OrderActionGrid } from "@/components/orders/OrderActionGrid";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { StationCompletionModal } from "@/components/orders/StationCompletionModal";
import { LabelPrintView } from "@/components/orders/LabelPrintView";
import { timelineRepository, TimelineEntry } from "@/lib/repositories/timelineRepository";
import { ordersRepository, Order } from "@/lib/repositories/ordersRepository";
import { Clock, Box } from "lucide-react";
import { getStationConfig } from "@/constants/stations";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    async function load() {
      // Wenn "new" übergeben wird, ist das ein fehlerhafter Pfad durch Next.js Cache o.ä.
      if (id === "new") return;
      
      const orders = await ordersRepository.getAll();
      const o = orders.find(x => x.id === id || x.orderNumber === id) || orders[0];
      setOrder(o);
      
      const t = await timelineRepository.getForOrder(o.id);
      setTimeline(t);
    }
    load();
  }, [id]);

  if (!order) return <div className="p-8 font-bold text-slate-500 flex items-center justify-center min-h-screen">Lade Auftrag...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-black font-serif text-slate-900">{order.orderNumber}</h1>
        <h2 className="text-2xl font-bold text-slate-600 mt-1">{order.title}</h2>
        <div className="flex gap-4 mt-4">
          <span className="px-3 py-1.5 bg-blue-100 text-blue-800 font-bold rounded-lg text-sm flex items-center">
            <Box className="w-4 h-4 mr-2" /> Station: {getStationConfig(order.currentStationId || order.station || "wareneingang").name}
          </span>
          <span className="px-3 py-1.5 bg-red-100 text-red-800 font-bold rounded-lg text-sm flex items-center">
            <Clock className="w-4 h-4 mr-2" /> Überfällig seit: 3 Stunden
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (Actions & Details) */}
        <div className="lg:col-span-7 space-y-8">
          <OrderActionGrid 
            orderId={order.id}
            customerId={order.customerId}
            currentStationId={order.currentStationId || order.station || "wareneingang"}
            customerPhone={undefined} // Not available on Order mock object directly yet
            onCompleteStation={() => setCompletionModalOpen(true)} 
            onPrint={() => setPrintOpen(true)} 
          />
          
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-widest pl-1 mb-4">Teile ({order.parts?.length || 0})</h3>
            <div className="space-y-3">
              {order.parts?.map((p: { quantity?: number; name?: string; surfaceRequested?: string }, i: number) => (
                <div key={i} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 gap-3">
                  <span className="font-bold text-slate-800 text-lg">{p.quantity}x {p.name}</span>
                  {p.surfaceRequested && (
                    <span className="text-sm font-bold text-slate-600 bg-white px-3 py-1.5 rounded-lg border-2 border-slate-200">
                      {p.surfaceRequested}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (Timeline & Docs) */}
        <div className="lg:col-span-5 bg-white border-2 border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
          <OrderTimeline entries={timeline} />
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
