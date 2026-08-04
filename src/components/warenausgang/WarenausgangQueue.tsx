"use client";

import { useMemo, useState } from "react";
import type { OperationalOrder } from "@/lib/types/operationalOrder";
import { format } from "date-fns";
import { PackageCheck, Mail, CheckCircle2, AlertCircle, FileText, Loader2 } from "lucide-react";

import { getUrgency } from "@/lib/orders/getUrgency";
import { generateDeliveryNote } from "@/app/actions/pdf.actions";

interface WarenausgangQueueProps {
  allOrders: OperationalOrder[]; // Receives all orders to determine completeness
}

export function WarenausgangQueue({ allOrders }: WarenausgangQueueProps) {
  // Filtere nach fertigen Aufträgen
  const finishedOrders = useMemo(() => {
    const finishedStatuses = ["completed", "shipped", "fertig", "abgeschlossen"];
    return allOrders.filter(o => {
      const isFinishedStatus = finishedStatuses.includes(o.status?.toLowerCase() || "");
      // Fallback auf Station warenausgang, falls Status nicht explizit gepflegt ist
      const isWarenausgangStation = o.station === "warenausgang" || o.currentStationId === "warenausgang";
      return isFinishedStatus || isWarenausgangStation;
    });
  }, [allOrders]);

  // Gruppiere die fertigen Aufträge nach Kunde und sortiere die Gruppen (Vollständige zuerst)
  const groupedOrders = useMemo(() => {
    const groups: Record<string, { orders: OperationalOrder[], isComplete: boolean }> = {};
    
    // 1. Fertige Aufträge gruppieren
    finishedOrders.forEach(o => {
      const c = o.customerName || "Unbekannt";
      if (!groups[c]) groups[c] = { orders: [], isComplete: true };
      groups[c].orders.push(o);
    });

    // 2. Vollständigkeitsprüfung anhand ALLER Aufträge des Kunden
    const finishedStatuses = ["completed", "shipped", "fertig", "abgeschlossen"];
    allOrders.forEach(o => {
      const c = o.customerName || "Unbekannt";
      // Wenn der Kunde in der Gruppe ist, prüfe, ob es noch unfertige Aufträge für ihn gibt
      if (groups[c]) {
        const isFinishedStatus = finishedStatuses.includes(o.status?.toLowerCase() || "");
        const isWarenausgangStation = o.station === "warenausgang" || o.currentStationId === "warenausgang";
        if (!isFinishedStatus && !isWarenausgangStation && o.status !== "cancelled") {
          groups[c].isComplete = false;
        }
      }
    });

    return Object.entries(groups).sort((a, b) => {
      // Sortiere vollständige Gruppen nach oben
      if (a[1].isComplete && !b[1].isComplete) return -1;
      if (!a[1].isComplete && b[1].isComplete) return 1;
      return a[0].localeCompare(b[0]);
    });
  }, [allOrders, finishedOrders]);

  const [isGeneratingNote, setIsGeneratingNote] = useState<string | null>(null);

  const handleGenerateNote = async (customerName: string, custOrders: OperationalOrder[]) => {
    setIsGeneratingNote(customerName);
    try {
      const orderIds = custOrders.map(o => o.id);
      const base64 = await generateDeliveryNote(orderIds);
      const url = `data:application/pdf;base64,${base64}`;
      const win = window.open();
      if (win) {
        win.document.write(`<iframe src="${url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
        win.document.title = `Lieferschein_${customerName}.pdf`;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `Lieferschein_${customerName}.pdf`;
        a.click();
      }
    } catch (e) {
      console.error("Fehler beim Generieren des Lieferscheins", e);
      alert("Fehler beim Generieren des Lieferscheins.");
    } finally {
      setIsGeneratingNote(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between text-xs text-text-muted font-semibold px-1">
        <span>{finishedOrders.length} Aufträge im Warenausgang</span>
        <span>Nach Kunde gruppiert</span>
      </div>

      {groupedOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-neutral-gray-100 shadow-sm text-text-muted text-sm font-medium">
          Keine fertigen Aufträge im Warenausgang.
        </div>
      ) : (
        groupedOrders.map(([customer, groupData]) => {
          const custOrders = groupData.orders;
          const isComplete = groupData.isComplete;

          return (
            <div key={customer} className="bg-white border-2 border-neutral-gray-100 rounded-3xl p-5 shadow-sm transition-all hover:border-neutral-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold font-serif text-navy-900">{customer}</h3>
                  {isComplete ? (
                    <span className="flex items-center gap-1.5 bg-success-green-soft text-success-green px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                      <CheckCircle2 className="w-3 h-3" />
                      Bereit zum Versand
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 bg-accent-orange-soft text-accent-orange px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                      <AlertCircle className="w-3 h-3" />
                      Unvollständig
                    </span>
                  )}
                </div>
                
                {isComplete && (
                  <div className="hidden sm:flex gap-2">
                    <button 
                      onClick={() => handleGenerateNote(customer, custOrders)}
                      disabled={isGeneratingNote === customer}
                      className="flex items-center gap-2 bg-white text-navy-900 border-2 border-navy-900 px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-bg-app-soft transition-all active:scale-95 shadow-md"
                    >
                      {isGeneratingNote === customer ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                      Lieferschein erstellen
                    </button>
                      <button 
                        disabled
                        className="flex items-center gap-2 bg-navy-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold opacity-50 cursor-not-allowed shadow-md"
                        title="Zahlungslink-Versand in Vorbereitung"
                      >
                        <Mail className="w-4 h-4" />
                        Zahlungs-QR anfordern (Demo)
                      </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {custOrders.map(o => {
                  const u = getUrgency(o.dueDate);
                  const isCrit = u === "kritisch";
                  const bgClass = isCrit ? "bg-danger-red/10 border-danger-red/30" : "bg-bg-app-soft border-neutral-gray-100";
                  const dotColor = u === "kritisch" ? "bg-danger-red" : u === "gefaehrdet" ? "bg-accent-orange" : "bg-success-green";

                  return (
                    <div key={o.id} className={`flex items-center justify-between rounded-2xl p-4 border ${bgClass}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                        <div className="w-10 h-10 rounded-full bg-success-green-soft flex items-center justify-center shrink-0">
                          <PackageCheck className="w-5 h-5 text-success-green" />
                        </div>
                        <div>
                          <div className="font-extrabold text-sm text-navy-900 font-mono tracking-tight">#{o.id.slice(0, 8).toUpperCase()}</div>
                          <div className="text-xs text-text-muted font-medium mt-0.5">
                            Fertiggestellt am {format(new Date(), "dd.MM.yy")}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {isComplete && (
                  <button 
                    disabled
                    className="sm:hidden w-full mt-4 flex items-center justify-center gap-2 bg-navy-900 text-white px-4 py-3.5 rounded-xl text-xs font-bold opacity-50 cursor-not-allowed shadow-md"
                    title="Zahlungslink-Versand in Vorbereitung"
                  >
                    <Mail className="w-4 h-4" />
                    Zahlungs-QR anfordern (Demo)
                  </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
