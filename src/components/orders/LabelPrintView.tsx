"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { customersRepository } from "@/lib/repositories/customersRepository";
import { labelService } from "@/lib/services/labelService";

interface LabelPrintViewProps {
  order: {
    id: string;
    orderNumber: string;
    customerId: string;
    title: string;
    parts: Record<string, unknown>[];
    createdAt?: string;
  };
  customerName?: string;
  onClose?: () => void;
  showPreviewModal?: boolean;
}

export function LabelPrintView({ order, customerName: propCustomerName, onClose, showPreviewModal = true }: LabelPrintViewProps) {
  const [mounted, setMounted] = useState(false);
  const [customerName, setCustomerName] = useState(propCustomerName || "Lade Kunde...");
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!propCustomerName) {
      let active = true;
      async function fetchCustomer() {
        try {
          const cust = await customersRepository.getById(order.customerId);
          if (active) {
            if (cust) {
              setCustomerName(cust.name);
            } else {
              setCustomerName("Unbekannter Kunde");
            }
          }
        } catch (e) {
          if (active) {
            console.error(e);
            setCustomerName("Fehler beim Laden");
          }
        }
      }
      fetchCustomer();
      return () => {
        active = false;
      };
    }
  }, [order.customerId, propCustomerName]);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      // Trigger native print dialog
      window.print();
      // Record print log event via label service
      await labelService.generateLabel(order.id);
    } catch (e) {
      console.error("Drucken fehlgeschlagen:", e);
    } finally {
      setPrinting(false);
    }
  };

  if (!mounted) return null;

  const dateStr = order.createdAt 
    ? new Date(order.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) 
    : new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

  const labelContent = (
    <div className="print-area font-sans text-black hidden print:flex flex-col justify-between h-[148mm] w-[105mm] p-6 bg-white border border-slate-200">
      {/* Print-specific layout */}
      <div className="space-y-4">
        {/* Logo/Header */}
        <div className="flex justify-between items-center border-b border-black pb-2">
          <span className="font-extrabold text-[13px] tracking-[0.15em] uppercase">KREILE GALVANIK</span>
          <span className="text-[10px] font-medium tracking-wider">A6 WERKSTATT-ETIKETT</span>
        </div>

        {/* Order Identifier */}
        <div className="text-center py-4 border-b border-black border-dashed">
          <div className="text-[12px] font-bold text-kreile-muted uppercase tracking-widest">AUFTRAGSNUMMER</div>
          <div className="text-[44px] font-black tracking-tight leading-none my-1">{order.orderNumber}</div>
          <div className="text-[14px] font-bold mt-1 text-slate-800">{order.title}</div>
        </div>

        {/* Details Table */}
        <div className="grid grid-cols-2 gap-y-3 text-[12px] py-2 border-b border-black">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">KUNDE</div>
            <div className="font-black text-[13px]">{customerName}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">DATUM</div>
            <div className="font-bold">{dateStr}</div>
          </div>
          <div className="col-span-2">
            <div className="text-[10px] font-bold text-slate-500 uppercase">BAUTEILE</div>
            <div className="space-y-1 mt-1 font-bold">
              {order.parts?.map((p: Record<string, unknown>, i: number) => (
                <div key={i} className="flex justify-between text-[11px] border-b border-slate-100 last:border-0 py-0.5">
                  <span>{String(p.quantity)}x {String(p.name)}</span>
                  {!!p.surfaceRequested && <span className="font-mono text-[9px] bg-slate-100 px-1 rounded">{String(p.surfaceRequested)}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer & Barcode */}
      <div className="flex flex-col items-center gap-2 border-t border-black pt-4">
        <QRCodeImage orderId={order.id} orderNumber={order.orderNumber} />
        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1">
          Nächste Station: WARENEINGANG
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Portal for browser printing (directly attached to body) */}
      {createPortal(labelContent, document.body)}

      {/* 2. Premium UI Modal Preview for Workshop Meister */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-kreile-navy/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-slate-950 border-2 border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-6 flex flex-col max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-900 pb-4">
              <div className="flex items-center gap-2 text-white">
                <Printer className="w-5 h-5 text-blue-500" />
                <h3 className="text-xl font-bold tracking-tight">Etikettendruck Vorschau</h3>
              </div>
              {onClose && (
                <button onClick={onClose} className="p-2 hover:bg-kreile-navy rounded-xl text-kreile-muted hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Simulated Printed Label on Screen */}
            <div className="flex justify-center py-4 bg-kreile-navy rounded-2xl border-2 border-slate-800/50 shadow-inner">
              <div className="bg-white text-black p-6 w-[280px] h-[395px] flex flex-col justify-between shadow-xl rounded-xl border border-slate-200 scale-95 origin-center">
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-black pb-1.5">
                    <span className="font-extrabold text-[9px] tracking-wider uppercase">KREILE GALVANIK</span>
                    <span className="text-[8px] font-bold bg-black text-white px-1.5 py-0.5 rounded">A6</span>
                  </div>

                  <div className="text-center py-2 border-b border-black border-dashed">
                    <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">AUFTRAGSNUMMER</div>
                    <div className="text-3xl font-black tracking-tight leading-none my-1">{order.orderNumber}</div>
                    <div className="text-[10px] font-bold text-slate-800 line-clamp-1">{order.title}</div>
                  </div>

                  <div className="space-y-1.5 text-[9px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">KUNDE:</span>
                      <span className="font-black text-slate-900">{customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">DATUM:</span>
                      <span className="font-bold text-slate-800">{dateStr}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1">
                      <span className="text-slate-500 font-bold block mb-0.5">POSITIONS-DETAILS:</span>
                      <div className="max-h-[85px] overflow-y-auto space-y-0.5 pr-1">
                        {order.parts?.map((p: Record<string, unknown>, i: number) => (
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
                  <QRCodeImage orderId={order.id} orderNumber={order.orderNumber} />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              {onClose && (
                <Button variant="outline" onClick={onClose} className="flex-1 h-14 rounded-2xl border-2 border-slate-800 text-kreile-muted hover:bg-kreile-navy hover:text-white font-bold transition-all">
                  Schließen
                </Button>
              )}
              <Button 
                onClick={handlePrint}
                disabled={printing}
                className="flex-1 h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {printing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Wird gedruckt...
                  </>
                ) : (
                  <>
                    <Printer className="w-5 h-5" />
                    Etikett drucken
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const QRCodeImage = ({ orderId, orderNumber }: { orderId: string; orderNumber: string }) => {
  const [dataUrl, setDataUrl] = useState<string>("");
  
  useEffect(() => {
    import("qrcode").then(QRCode => {
      const link = `https://app.kreile.local/orders/${orderId}`;
      QRCode.default.toDataURL(link, { margin: 1, width: 150 })
        .then(url => setDataUrl(url))
        .catch(e => console.error("QR Code Error:", e));
    });
  }, [orderId]);

  if (!dataUrl) {
    return <div className="w-16 h-16 bg-slate-100 flex items-center justify-center rounded"><Loader2 className="animate-spin text-kreile-muted w-4 h-4" /></div>;
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUrl} alt={`QR Code for ${orderNumber}`} className="w-[80px] h-[80px] object-contain" />
      <span className="font-mono text-[8px] font-bold text-black">{orderNumber}</span>
    </div>
  );
};
