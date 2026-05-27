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
import { ordersRepository } from "@/lib/repositories/ordersRepository";

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
      try {
        const dbOrders = await ordersRepository.getAll();
        if (dbOrders && dbOrders.length > 0) {
          setOrders(dbOrders as unknown as MockOrder[]);
        }
      } catch (e) {
        console.error("Fehler beim Laden aus dem Repository", e);
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
            <Link href="/" className="p-2 bg-bg-app-soft hover:bg-neutral-gray-100 text-text-muted rounded-lg mr-1 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-black text-navy-900">
              {getStationHeadline()}
            </h1>
          </div>
          <p className="text-text-muted text-sm mt-1">
            Stationsspezifische Übersicht der Werkstücke in Schritt: {slug.toUpperCase()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between text-xs text-text-muted font-semibold px-1">
            <span>{filteredOrders.length} Aufträge an dieser Station</span>
            <span>Klicke für Details</span>
          </div>

          {filteredOrders.length > 0 ? (
            <div className="space-y-6">
              {slug === "wareneingang" && (
                <Card className="bg-gradient-to-r from-navy-900 to-navy-700 text-white p-6 rounded-xl shadow-md border border-white/10">
                  <div className="flex flex-col items-center">
                    <h2 className="text-xl font-bold font-serif mb-4 text-white">Neuen Auftrag erfassen</h2>
                    <Link href="/orders/new" className="w-full max-w-sm">
                      <Button className="w-full bg-white text-navy-900 hover:bg-bg-app-soft py-6 text-base font-extrabold rounded-xl shadow-md transition-all">
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
                  ? "bg-bg-app-soft/50"
                  : isRed
                  ? "bg-accent-orange-soft/50"
                  : isOrange
                  ? "bg-gold-100/30"
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
                      isSelected ? "ring-2 ring-navy-900 border-transparent shadow" : "border-neutral-gray-300"
                    }`}
                  >
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-navy-900 text-base">{order.orderNumber}</span>
                          <span className="text-xs text-text-muted">• {order.customerName}</span>
                          <Badge variant="outline" className={`text-[9px] font-bold tracking-wider py-0 px-1.5 ${badgeStyle}`}>
                            {evalRes.statusText}
                          </Badge>
                        </div>
                        <h4 className="font-bold text-navy-900 text-sm md:text-base font-serif">{order.task}</h4>
                        <div className="flex items-center gap-3 text-xs text-text-muted font-semibold pt-0.5">
                          <span>Eingang: {order.intakeDate}</span>
                          <span>•</span>
                          <span>Teile: {order.parts?.length ?? 0}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right shrink-0">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-text-muted font-bold uppercase">{dueLabel}</span>
                          <span className={`font-black text-lg ${isRed ? "text-danger-red" : isOrange ? "text-accent-orange" : "text-navy-900"}`}>
                            {dueValue}
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
              <Package className="h-8 w-8 mx-auto text-text-muted animate-pulse" />
              <p className="font-bold text-text-muted">Keine Aufträge in dieser Station</p>
              <p className="text-xs">Alle Aufträge sind bereits in Folgestationen abgearbeitet.</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          {selectedOrder ? (
            <Card className="shadow-md border-neutral-gray-100 overflow-hidden sticky top-6">
              <div className="bg-navy-900 text-white p-5 relative">
                <button
                  onClick={() => setSelectedOrderId(null)}
                  className="absolute right-4 top-4 text-white/70 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-white/70">{selectedOrder.orderNumber}</span>
                  <Badge className="bg-navy-700 text-white border-0 text-[8px] font-bold uppercase tracking-wider py-0.5">
                    Station: {getStationConfig(selectedOrder.station).name.toUpperCase()}
                  </Badge>
                </div>
                <h3 className="font-bold text-lg font-serif mt-1 leading-tight">{selectedOrder.task}</h3>
                <p className="text-xs text-white/70 mt-1 font-semibold">Kunde: {selectedOrder.customerName}</p>
              </div>

              <CardContent className="p-5 space-y-5">
                <div className="grid grid-cols-2 gap-3 bg-bg-app-soft p-3 rounded-lg border border-neutral-gray-100 text-xs">
                  <div>
                    <span className="text-text-muted block font-semibold text-[10px] uppercase">Eingang</span>
                    <span className="font-bold text-navy-900">{selectedOrder.intakeDate}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block font-semibold text-[10px] uppercase">Teile</span>
                    <span className="font-bold text-navy-900">{selectedOrder.parts.length} Stück</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-bold uppercase text-text-muted tracking-wider">Erfasste Werkstücke</span>
                  {(selectedOrder.parts || []).map((p, i) => (
                  <div key={p.id ?? `part-${i}`} className="p-2.5 bg-bg-app-soft border border-neutral-gray-100 rounded-lg flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-navy-900 block">{p.name}</span>
                      <span className="text-text-muted text-[10px]">Material: {p.material} | Finish: {p.finish}</span>
                    </div>
                    <Badge variant="outline" className="font-mono text-[9px] bg-white text-text-muted">
                      {p.id ?? `part-${i}`}
                    </Badge>
                  </div>
                ))}
                </div>

                <div className="pt-4 border-t border-neutral-gray-100">
                  <Link href={`/orders/${selectedOrder.id}`}>
                     <Button className="w-full bg-navy-900 hover:bg-navy-700 text-white shadow-sm font-bold h-11 rounded-xl">
                       Auftrag Details & Bearbeiten
                     </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-2 border-neutral-gray-300 bg-bg-app-soft/50 p-6 text-center rounded-2xl space-y-2 sticky top-6">
              <div className="h-12 w-12 rounded-full bg-bg-app-soft flex items-center justify-center mx-auto text-text-muted">
                <Package className="h-6 w-6" />
              </div>
              <h4 className="font-extrabold text-sm text-navy-900">Wähle einen Auftrag</h4>
              <p className="text-xs text-text-muted max-w-xs mx-auto leading-relaxed">
                Klicke links auf einen Auftrag in der Stations-Warteschlange, um Details zu sehen.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
