"use client";

import { useState, useEffect, use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Package, ArrowLeft, X } from "lucide-react";
import { INITIAL_ORDERS, MockOrder } from "@/lib/mockData";
import { getStationConfig } from "@/constants/stations";
import { evaluateOrderPriority } from "@/lib/priority";

const VALID_SLUGS = ["wareneingang", "entmetallisierung", "schleiferei", "beschichtung", "warenausgang"];

export default function StationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  if (!VALID_SLUGS.includes(slug)) {
    notFound();
  }

  const [orders, setOrders] = useState<MockOrder[]>(INITIAL_ORDERS);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (typeof window !== "undefined") {
        const savedOrders = localStorage.getItem("kreile_orders");
        if (savedOrders) {
          try {
            setOrders(JSON.parse(savedOrders));
          } catch {}
        }
      }
    };
    loadData();
  }, []);

  const filteredOrders = orders.filter(o => (o.currentStationId || o.station) === slug);
  const selectedOrder = orders.find(o => o.id === selectedOrderId) || null;
  const config = getStationConfig(slug);

  const getStationHeadline = () => {
    const suffixMap: Record<string, string> = {
      wareneingang: " (Neue & Unvollständige Aufträge)",
      entmetallisierung: "",
      schleiferei: " (Vorarbeit & Polieren)",
      beschichtung: " (Beschichtung)",
      warenausgang: " (Versand & Abholung)"
    };
    return `${config.fullName}${suffixMap[slug] || ""}`;
  };

  return (
    <div className="space-y-6 pb-12 font-sans max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/" className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg mr-1 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-extrabold font-serif text-slate-900 tracking-tight">
              {getStationHeadline()}
            </h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Stationsspezifische Übersicht der Werkstücke in Schritt: {slug.toUpperCase()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
            <span>{filteredOrders.length} Aufträge an dieser Station</span>
            <span>Klicke für Details</span>
          </div>

          {filteredOrders.length > 0 ? (
            <div className="space-y-6">
              {slug === "wareneingang" && (
                <Card className="bg-gradient-to-r from-blue-900 to-slate-800 text-white p-6 rounded-xl shadow-lg">
                  <div className="flex flex-col items-center">
                    <h2 className="text-2xl font-bold mb-4">Neuen Auftrag erfassen</h2>
                    <Link href="/orders/new">
                      <Button className="w-full max-w-sm bg-white text-blue-900 hover:bg-gray-100 py-4 text-xl rounded-xl mb-4">
                        Wareneingang erfassen
                      </Button>
                    </Link>
                  </div>
                </Card>
              )}
              {filteredOrders.map((order) => {
                const evalRes = evaluateOrderPriority(order);
                const isSelected = order.id === selectedOrderId;
                const isRed = evalRes.risk === "red";
                const isOrange = evalRes.risk === "orange";
                const itemBg = isSelected
                  ? "bg-blue-50/60"
                  : isRed
                  ? "bg-red-50/70"
                  : isOrange
                  ? "bg-orange-50/30"
                  : "bg-white";
                const borderStyle = evalRes.config.leftBorderClass + " border-l-4";
                const badgeStyle = evalRes.config.badgeClass;
                const dueLabel = evalRes.dueLabel;
                const dueValue = evalRes.dueValue;

                return (
                  <Card
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`transition-all duration-200 cursor-pointer shadow-sm ${itemBg} ${borderStyle} ${
                      isSelected ? "ring-2 ring-blue-900 border-transparent shadow" : "border-slate-200"
                    }`}
                  >
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-slate-900 text-base">{order.orderNumber}</span>
                          <span className="text-xs text-slate-500">• {order.customerName}</span>
                          <Badge variant="outline" className={`text-[9px] font-bold tracking-wider py-0 px-1.5 ${badgeStyle}`}>
                            {evalRes.statusText}
                          </Badge>
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm md:text-base font-serif">{order.task}</h4>
                        <div className="flex items-center gap-3 text-xs text-slate-400 font-semibold pt-0.5">
                          <span>Eingang: {order.intakeDate}</span>
                          <span>•</span>
                          <span>Teile: {order.parts?.length ?? 0}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right shrink-0">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">{dueLabel}</span>
                          <span className={`font-black text-lg ${isRed ? "text-red-600" : isOrange ? "text-orange-600" : "text-slate-700"}`}>
                            {dueValue}
                          </span>
                        </div>
                        <ChevronRight className={`h-5 w-5 transition-transform ${isSelected ? "text-blue-900 translate-x-1" : "text-slate-300"}`} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-xl space-y-2">
              <Package className="h-8 w-8 mx-auto text-slate-300 animate-pulse" />
              <p className="font-bold text-slate-600">Keine Aufträge in dieser Station</p>
              <p className="text-xs">Alle Aufträge sind bereits in Folgestationen abgearbeitet.</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          {selectedOrder ? (
            <Card className="shadow-md border-blue-100 overflow-hidden sticky top-6">
              <div className="bg-blue-900 text-white p-5 relative">
                <button
                  onClick={() => setSelectedOrderId(null)}
                  className="absolute right-4 top-4 text-white/70 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-blue-200">{selectedOrder.orderNumber}</span>
                  <Badge className="bg-blue-950 text-white border-0 text-[8px] font-bold uppercase tracking-wider py-0.5">
                    Station: {getStationConfig(selectedOrder.station).name.toUpperCase()}
                  </Badge>
                </div>
                <h3 className="font-bold text-lg font-serif mt-1 leading-tight">{selectedOrder.task}</h3>
                <p className="text-xs text-blue-200 mt-1 font-semibold">Kunde: {selectedOrder.customerName}</p>
              </div>

              <CardContent className="p-5 space-y-5">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Eingang</span>
                    <span className="font-bold text-slate-800">{selectedOrder.intakeDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Teile</span>
                    <span className="font-bold text-slate-800">{selectedOrder.parts.length} Stück</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Erfasste Werkstücke</span>
                  {selectedOrder.parts.map((p, i) => (
                  <div key={p.id ?? `part-${i}`} className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800 block">{p.name}</span>
                      <span className="text-slate-500 text-[10px]">Material: {p.material} | Finish: {p.finish}</span>
                    </div>
                    <Badge variant="outline" className="font-mono text-[9px] bg-white text-slate-400">
                      {p.id ?? `part-${i}`}
                    </Badge>
                  </div>
                ))}
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <Link href={`/orders/${selectedOrder.id}`}>
                     <Button className="w-full bg-blue-900 hover:bg-blue-800 text-white shadow-sm font-bold h-11 rounded-xl">
                       Auftrag Details & Bearbeiten
                     </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50 p-6 text-center rounded-2xl space-y-2 sticky top-6">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Package className="h-6 w-6" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-700">Wähle einen Auftrag</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                Klicke links auf einen Auftrag in der Stations-Warteschlange, um Details zu sehen.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
