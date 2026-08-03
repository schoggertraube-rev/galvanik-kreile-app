"use client";
import { useState, useEffect } from "react";
import { X, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateOrderLabel } from "@/app/actions/pdf.actions";

interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName?: string;
  title: string;
  task?: string;
  parts: Record<string, unknown>[];
  intakeDate?: string;
  createdAt?: string;
}

interface BulkLabelPrintViewProps {
  orders: Order[];
  onClose?: () => void;
  onPrintComplete?: () => void;
}

export function BulkLabelPrintView({ orders, onClose, onPrintComplete }: BulkLabelPrintViewProps) {
  const [mounted, setMounted] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [customerMap, setCustomerMap] = useState<Record<string, string>>({});
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const orderIds = orders.map(o => o.id);
      const base64 = await generateOrderLabel(orderIds);
      const url = `data:application/pdf;base64,${base64}`;
      const win = window.open();
      if (win) {
        win.document.write(`<iframe src="${url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
        win.document.title = `Bulk_Laufkarten_${new Date().getTime()}.pdf`;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `Bulk_Laufkarten_${new Date().getTime()}.pdf`;
        a.click();
      }
      if (onPrintComplete) onPrintComplete();
    } catch (e) {
      console.error("Fehler beim Generieren der Bulk-Laufkarten", e);
      alert("Fehler beim Generieren der Laufkarten.");
    } finally {
      setPrinting(false);
    }
  };

  if (!mounted || orders.length === 0) return null;

  return (
    <>
      <div className="fixed inset-0 bg-navy-900/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
        <div className="bg-navy-900 border-2 border-navy-900 rounded-3xl w-full max-w-2xl p-8 shadow-2xl space-y-6 flex flex-col max-h-[90vh]">
          <div className="flex justify-between items-center border-b border-navy-800 pb-4">
            <div className="flex items-center gap-3 text-white">
              <div className="bg-navy-700 p-3 rounded-2xl">
                <Printer className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold tracking-tight">Sammeldruck Warteschlange</h3>
                <p className="text-text-muted text-sm">{orders.length} Etiketten bereit zum Druck</p>
              </div>
            </div>
            {onClose && (
              <button onClick={onClose} className="p-3 bg-navy-800 hover:bg-navy-700 rounded-2xl text-text-muted hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {orders.map((order, idx) => (
              <div key={order.id} className="flex items-center justify-between bg-navy-800 p-4 rounded-2xl border border-navy-700">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-navy-900 flex items-center justify-center text-xs font-bold text-text-muted">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-white font-bold">{order.orderNumber}</p>
                    <p className="text-text-muted text-xs line-clamp-1">{order.task || order.title}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="bg-gold-600/20 text-gold-400 text-[10px] font-bold px-2 py-1 rounded-lg">A6 ETIKETT</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4 pt-2">
            {onClose && (
              <Button variant="outline" onClick={onClose} className="w-1/3 h-16 rounded-2xl border-2 border-navy-800 bg-transparent text-text-muted hover:bg-navy-800 hover:text-white font-bold transition-all text-lg">
                Abbrechen
              </Button>
            )}
            <Button 
              onClick={handlePrint}
              disabled={printing}
              className="flex-1 h-16 rounded-2xl bg-gold-600 hover:bg-gold-500 text-navy-900 font-black shadow-lg shadow-gold-600/20 active:scale-95 transition-all flex items-center justify-center gap-3 text-lg"
            >
              {printing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Wird gedruckt...
                </>
              ) : (
                <>
                  <Printer className="w-6 h-6" />
                  Alle {orders.length} Etiketten drucken
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
