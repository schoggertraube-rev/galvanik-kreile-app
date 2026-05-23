"use client";
import { useState } from "react";
import { CheckCircle2, Factory, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { intakeService } from "@/lib/services/intakeService";
import { useRouter } from "next/navigation";
import { LabelPrintView } from "@/components/orders/LabelPrintView";
import type { Order } from "@/lib/repositories/ordersRepository";

export function IntakeCompletionSummary({ 
  customerSelection, newCustomerDetails, items, onBack 
}: { 
  customerSelection: { id: string | null, newName?: string }, newCustomerDetails?: any, items: Record<string, unknown>[], onBack?: () => void 
}) {
  const [saving, setSaving] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const router = useRouter();

  const handleFinish = async () => {
    setSaving(true);
    try {
      const order = await intakeService.processIntake({
        customerId: customerSelection.id,
        newCustomerName: customerSelection.newName,
        newCustomerDetails,
        orderTitle: `${String(items[0].name)} ${items.length > 1 ? `+ ${items.length - 1} weitere` : ''}`,
        items: items as { name: string; quantity: number; surfaceRequested?: string }[]
      });
      // Delay for UX transition
      await new Promise(r => setTimeout(r, 800));
      setCreatedOrder(order);
      setSaving(false);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  const dateStr = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const customerDisplayName = customerSelection.newName || "Bestandskunde";

  if (createdOrder) {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-8 animate-in zoom-in-95 duration-500 pt-6">
        {/* Success Header */}
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <CheckCircle2 className="w-10 h-10 animate-bounce" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Erfolgreich gespeichert!</h2>
          <p className="text-slate-500 font-medium">Auftrag {createdOrder.orderNumber} wurde angelegt und steht bereit.</p>
        </div>

        {/* Embedded Label preview */}
        <div className="bg-slate-955 border-2 border-slate-900 rounded-3xl p-6 shadow-inner flex flex-col items-center">
          <div className="text-slate-400 font-extrabold uppercase tracking-widest text-xs mb-4">Etiketten-Vorschau (A6 Hochformat)</div>
          
          <div className="bg-white text-black p-6 w-[280px] h-[395px] flex flex-col justify-between shadow-xl rounded-xl border border-slate-200">
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-black pb-1.5">
                <span className="font-extrabold text-[9px] tracking-wider uppercase">KREILE GALVANIK</span>
                <span className="text-[8px] font-bold bg-black text-white px-1.5 py-0.5 rounded">A6</span>
              </div>

              <div className="text-center py-2 border-b border-black border-dashed">
                <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">AUFTRAGSNUMMER</div>
                <div className="text-3xl font-black tracking-tight leading-none my-1">{createdOrder.orderNumber}</div>
                <div className="text-[10px] font-bold text-slate-800 line-clamp-1">{createdOrder.title}</div>
              </div>

              <div className="space-y-1.5 text-[9px]">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">KUNDE:</span>
                  <span className="font-black text-slate-900">{customerDisplayName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">DATUM:</span>
                  <span className="font-bold text-slate-800">{dateStr}</span>
                </div>
                <div className="border-t border-slate-200 pt-1">
                  <span className="text-slate-500 font-bold block mb-0.5">POSITIONS-DETAILS:</span>
                  <div className="max-h-[85px] overflow-y-auto space-y-0.5 pr-1">
                    {createdOrder.parts?.map((p: Record<string, unknown>, i: number) => (
                      <div key={i} className="flex justify-between text-[8px] border-b border-slate-100 last:border-0 py-0.5">
                        <span className="font-medium">{String(p.quantity)}x {String(p.name)}</span>
                        {!!p.surfaceRequested && <span className="font-mono bg-slate-100 px-1 rounded text-[7px]">{String(p.surfaceRequested)}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-1.5 border-t border-black pt-2 mt-auto">
              <div className="flex justify-center items-stretch h-6 bg-white px-1.5 py-0.5 border border-slate-200 rounded">
                {Array.from(createdOrder.orderNumber as string).map((char: string, i) => {
                  const width = ((char.charCodeAt(0) + i * 9) % 3) + 1;
                  const gap = ((char.charCodeAt(0) + i * 17) % 3) + 1;
                  return <div key={i} className="bg-black" style={{ width: `${width}px`, marginRight: `${gap}px` }} />;
                })}
              </div>
              <span className="font-mono text-[7px] tracking-[0.25em] text-black">*{createdOrder.orderNumber}*</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={() => router.push("/today")}
            variant="outline"
            className="flex-1 h-16 text-sm font-bold rounded-2xl border-2 border-slate-200 text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
          >
            Zum Leitstand
          </Button>
          <Button
            onClick={() => router.push(`/orders/${createdOrder.id}`)}
            variant="outline"
            className="flex-1 h-16 text-sm font-bold rounded-2xl border-2 border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 active:scale-95 transition-all"
          >
            Auftrag öffnen
          </Button>
          <Button
            onClick={() => window.print()}
            className="flex-1 h-16 text-sm font-black rounded-2xl bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-600/30 active:scale-95 transition-all flex items-center justify-center gap-2 animate-pulse"
          >
            <Printer className="w-5 h-5" /> Etikett drucken
          </Button>
        </div>

        {/* Mount LabelPrintView Portal for printing */}
        <LabelPrintView 
          order={createdOrder} 
          customerName={customerDisplayName} 
          showPreviewModal={false} 
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8 animate-in zoom-in-95 duration-500 pt-6">
      {onBack && (
        <div className="flex justify-start mb-2">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm px-3 py-2 rounded-xl hover:bg-slate-100 transition-all"
          >
            <span className="text-xl leading-none">&larr;</span> Zurück zur Korrektur
          </button>
        </div>
      )}
      <div className="text-center space-y-2">
        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <h2 className="text-4xl font-black font-serif text-slate-900 tracking-tight">Zusammenfassung</h2>
        <p className="text-slate-500 font-medium text-lg">Alles bereit. Auftrag wird jetzt in die Produktion gegeben.</p>
      </div>

      <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-md space-y-6">
        <div className="flex justify-between items-center py-2 border-b-2 border-slate-100 border-dashed">
          <span className="text-slate-400 font-extrabold uppercase tracking-widest text-xs">Kunde</span>
          <span className="text-slate-900 font-black text-lg">{customerSelection.newName || "Bestandskunde (aus Kartei)"}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b-2 border-slate-100 border-dashed">
          <span className="text-slate-400 font-extrabold uppercase tracking-widest text-xs">Bauteile</span>
          <span className="text-slate-900 font-black text-lg">{items.length} Position(en)</span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-slate-400 font-extrabold uppercase tracking-widest text-xs">Nächste Station</span>
          <span className="text-blue-800 bg-blue-50 border border-blue-200 px-4 py-1.5 rounded-full font-black flex items-center gap-2">
            <Factory className="w-4 h-4" /> Wareneingang (Physisch)
          </span>
        </div>
      </div>

      <Button 
        onClick={handleFinish}
        disabled={saving}
        className="w-full h-16 text-xl font-black rounded-2xl bg-green-600 text-white hover:bg-green-700 shadow-xl shadow-green-600/30 active:scale-95 transition-all"
      >
        {saving ? "Auftrag wird erstellt..." : "Auftrag jetzt speichern"}
      </Button>
    </div>
  )
}
