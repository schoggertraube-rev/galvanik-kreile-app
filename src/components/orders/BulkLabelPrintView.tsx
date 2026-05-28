"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { customersRepository } from "@/lib/repositories/customersRepository";

interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName?: string;
  title: string;
  task?: string;
  parts: any[];
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
    let active = true;
    async function loadCustomers() {
      const newMap: Record<string, string> = {};
      const uniqueCustomerIds = Array.from(new Set(orders.map(o => o.customerId).filter(Boolean)));
      
      for (const cid of uniqueCustomerIds) {
        try {
          const cust = await customersRepository.getById(cid);
          if (cust) newMap[cid] = cust.name;
        } catch (e) {
          console.error(e);
        }
      }
      if (active) setCustomerMap(newMap);
    }
    loadCustomers();
    return () => { active = false; };
  }, [orders]);

  useEffect(() => {
    import("qrcode").then(QRCode => {
      orders.forEach(order => {
        const link = `https://app.kreile.local/orders/${order.id}`;
        QRCode.default.toDataURL(link, { margin: 1, width: 150 })
          .then(url => setQrCodes(prev => ({ ...prev, [order.id]: url })))
          .catch(e => console.error("QR Code Error:", e));
      });
    });
  }, [orders]);

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
      if (onPrintComplete) onPrintComplete();
    }, 500);
  };

  if (!mounted || orders.length === 0) return null;

  const labelContent = (
    <div className="hidden print:block w-full">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .bulk-print-area, .bulk-print-area * { visibility: visible; }
          .bulk-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .print-page { page-break-after: always; height: 148mm; width: 105mm; }
          @page { size: A6 portrait; margin: 0; }
        }
      `}} />
      <div className="bulk-print-area">
        {orders.map((order) => {
          const cName = customerMap[order.customerId] || order.customerName || "Unbekannt";
          const dStr = order.intakeDate || (order.createdAt ? new Date(order.createdAt).toLocaleDateString("de-DE") : new Date().toLocaleDateString("de-DE"));
          
          return (
            <div key={order.id} className="print-page font-sans text-black flex flex-col justify-between p-6 bg-white overflow-hidden border-b border-gray-200">
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-black pb-2">
                  <span className="font-extrabold text-[13px] tracking-[0.15em] uppercase">KREILE GALVANIK</span>
                  <span className="text-[10px] font-medium tracking-wider">A6 ETIKETT</span>
                </div>

                <div className="text-center py-4 border-b border-black border-dashed">
                  <div className="text-[12px] font-bold text-gray-500 uppercase tracking-widest">AUFTRAGSNUMMER</div>
                  <div className="text-[44px] font-black tracking-tight leading-none my-1">{order.orderNumber}</div>
                  <div className="text-[14px] font-bold mt-1 text-black">{order.task || order.title}</div>
                </div>

                <div className="grid grid-cols-2 gap-y-3 text-[12px] py-2 border-b border-black">
                  <div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase">KUNDE</div>
                    <div className="font-black text-[13px]">{cName}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase">DATUM</div>
                    <div className="font-bold">{dStr}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[10px] font-bold text-gray-500 uppercase">BAUTEILE</div>
                    <div className="space-y-1 mt-1 font-bold">
                      {order.parts?.slice(0, 8).map((p: any, i: number) => (
                        <div key={i} className="flex justify-between text-[11px] border-b border-gray-100 last:border-0 py-0.5">
                          <span>{String(p.quantity)}x {String(p.name)}</span>
                          {!!p.surfaceRequested && <span className="font-mono text-[9px] bg-gray-100 px-1 rounded">{String(p.surfaceRequested)}</span>}
                        </div>
                      ))}
                      {(order.parts?.length || 0) > 8 && <div className="text-[9px] italic text-gray-500">+ weitere Positionen...</div>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 border-t border-black pt-4">
                {qrCodes[order.id] ? (
                  <div className="flex flex-col items-center gap-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCodes[order.id]} alt="QR" className="w-[80px] h-[80px] object-contain" />
                    <span className="font-mono text-[8px] font-bold text-black">{order.orderNumber}</span>
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-gray-100 flex flex-col items-center justify-center">QR Code</div>
                )}
                <div className="text-[9px] text-gray-600 font-bold uppercase tracking-wider mt-1">
                  Nächste Station: WARENEINGANG
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {createPortal(labelContent, document.body)}

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
