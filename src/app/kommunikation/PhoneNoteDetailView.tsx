"use client";

import { useState, useEffect } from "react";
import { 
  Phone, User, CheckCircle2, AlertOctagon, Link as LinkIcon, 
  ExternalLink, FileText, Banknote, MapPin
} from "lucide-react";
import Link from "next/link";
import { smartMatchText, MatchResult } from "./smartMatcher";
import { updatePhoneNote } from "@/app/actions/phoneNotes.actions";
import type { getRecentPhoneNotes } from "@/app/actions/phoneNotes.actions";
import { OrderModalTrigger } from "@/components/orders/OrderModalTrigger";
import { ordersRepository, type Order } from "@/lib/repositories/ordersRepository";
import { customersRepository } from "@/lib/repositories/customersRepository";
import { type Customer } from "@/lib/types/customer";

type PhoneNote = Awaited<ReturnType<typeof getRecentPhoneNotes>>[number];

export function PhoneNoteDetailView({ note, onUpdate, onClose }: { note: PhoneNote, onUpdate: () => void, onClose: () => void }) {
  const [matchData, setMatchData] = useState<MatchResult | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignForm, setAssignForm] = useState({ customerId: "", orderId: "" });
  const [assignStatus, setAssignStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [showLogisticsModal, setShowLogisticsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    ordersRepository.getAll().then(setAllOrders).catch(() => setAllOrders([]));
    customersRepository.getAll().then(setAllCustomers).catch(() => setAllCustomers([]));
  }, []);

  useEffect(() => {
    if (note && note.rawText) {
      const data = smartMatchText(note.rawText, allCustomers, allOrders);
      setMatchData(data);
      setAssignForm({
        customerId: note.customerId || data.matchedCustomer?.id || "",
        orderId: note.orderId || data.matchedOrder?.id || ""
      });
    }
  }, [note, allCustomers, allOrders]);

  const handleAssign = async () => {
    setAssignStatus("saving");
    try {
      const result = await updatePhoneNote(note.id, {
        customerId: assignForm.customerId,
        orderId: assignForm.orderId,
        status: "open"
      });
      if (result.success) {
        setAssignStatus("success");
        onUpdate();
        setTimeout(() => setIsAssigning(false), 1500);
      } else {
        setAssignStatus("error");
      }
    } catch (err) {
      console.error(err);
      setAssignStatus("error");
    }
  };

  if (!note || !matchData) return null;

  return (
    <div className="flex flex-col h-full bg-white relative">
      <div className="p-6 border-b border-neutral-gray-100 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold font-serif mb-1 flex items-center gap-2">
            <Phone className="w-5 h-5 text-accent-orange" />
            Telefonnotiz Detail
          </h2>
          <div className="flex items-center gap-3 text-sm text-text-muted">
            <span className="font-medium text-navy-900">{note.callerName || "Unbekannter Anrufer"}</span>
            <span>•</span>
            <span>{new Date(note.createdAt ?? 0).toLocaleString()}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="bg-blue-100 text-blue-700 text-xs font-black uppercase px-2 py-1 rounded">
            {note.status === "open" ? "In Bearbeitung" : "Neu"}
          </span>
          <button onClick={onClose} className="px-3 py-1 bg-neutral-gray-100 hover:bg-neutral-gray-200 rounded-lg text-sm font-bold text-navy-900 transition">
            Schließen
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Rohtext und Antwort */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-text-muted">Rohtext</h3>
            <div className="bg-gray-50 rounded-xl p-4 text-sm leading-relaxed border border-neutral-gray-200 whitespace-pre-wrap">
              {note.rawText}
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-text-muted">Empfohlene Antwort</h3>
            <div className="bg-navy-900 text-white rounded-xl p-4 text-sm leading-relaxed shadow-inner">
              „{matchData.suggestedAnswer}“
            </div>
          </div>
        </div>

        {/* Erkannte Kontexte / Badges */}
        <div>
          <h3 className="font-bold text-xs uppercase tracking-wider text-text-muted mb-3">Erkannte Kontexte</h3>
          <div className="flex flex-wrap gap-2">
            {matchData.matchedCustomer && (
              <Link href={`/customers/${matchData.matchedCustomer.id}`} target="_blank" className="bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-100 transition group">
                <User className="w-4 h-4" /> {matchData.matchedCustomer.name}
                <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100" />
              </Link>
            )}
            {matchData.matchedOrder && (
              <OrderModalTrigger orderId={matchData.matchedOrder.id} className="bg-purple-50 text-purple-800 border border-purple-200 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-purple-100 transition group">
                <FileText className="w-4 h-4" /> Auftrag {matchData.matchedOrder.id}
                <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100" />
              </OrderModalTrigger>
            )}
            {matchData.matchedMaterial && (
              <span className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg text-sm font-bold capitalize">
                {matchData.matchedMaterial}
              </span>
            )}
            {matchData.matchedKeywords.map(kw => {
              if (kw === "Termin/Logistik") {
                return (
                  <button key={kw} onClick={() => setShowLogisticsModal(true)} className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-100 transition">
                    <MapPin className="w-4 h-4" /> Logistik prüfen
                  </button>
                );
              }
              if (kw === "Buchhaltung/Zahlung") {
                return (
                  <button key={kw} onClick={() => setShowPaymentModal(true)} className="bg-green-50 text-green-800 border border-green-200 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-green-100 transition">
                    <Banknote className="w-4 h-4" /> Zahlung prüfen
                  </button>
                );
              }
              if (kw === "Reklamation") {
                return (
                  <span key={kw} className="bg-red-50 text-red-800 border border-red-200 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1">
                    <AlertOctagon className="w-4 h-4" /> Reklamation
                  </span>
                );
              }
              return (
                <span key={kw} className="bg-gray-100 text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg text-sm font-bold">
                  {kw}
                </span>
              );
            })}
          </div>
        </div>

        {/* Smarter Auftragsfinder Ergebnisse */}
        {matchData.scoredOrders.length > 0 && (
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
              <LinkIcon className="w-4 h-4" /> Mögliche passende Aufträge
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {matchData.scoredOrders.map(({ order, score, reasons }) => (
                <div key={order.id} className={`border p-3 rounded-xl \${matchData.matchedOrder?.id === order.id ? 'bg-purple-50 border-purple-300' : 'bg-white border-neutral-gray-200'}`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-sm text-navy-900">{order.id}</span>
                    <span className="text-[10px] font-bold bg-gray-100 px-1.5 py-0.5 rounded text-text-muted">Score: {score}</span>
                  </div>
                  <div className="text-xs text-text-muted mb-2 line-clamp-1">{order.customerName} - {order.task}</div>
                  <div className="space-y-1">
                    {reasons.map((r, i) => <div key={i} className="text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded inline-block mr-1">{r}</div>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Zuordnungs-Formular */}
        <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-sm text-navy-900">Manuelle Zuordnung</h3>
            <button onClick={() => setIsAssigning(!isAssigning)} className="text-xs font-bold text-accent-orange hover:underline">
              {isAssigning ? "Abbrechen" : "Zuordnung bearbeiten"}
            </button>
          </div>
          
          {isAssigning ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Kunden ID</label>
                <input value={assignForm.customerId} onChange={e => setAssignForm({...assignForm, customerId: e.target.value})} className="w-full border border-neutral-gray-200 rounded p-2 text-sm outline-none focus:border-navy-900" placeholder="z.B. cust_123" />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Auftrags ID</label>
                <input value={assignForm.orderId} onChange={e => setAssignForm({...assignForm, orderId: e.target.value})} className="w-full border border-neutral-gray-200 rounded p-2 text-sm outline-none focus:border-navy-900" placeholder="z.B. A-2026-..." />
              </div>
              <div className="sm:col-span-2 flex items-center gap-3">
                <button onClick={handleAssign} disabled={assignStatus === 'saving'} className="bg-navy-900 text-white font-bold px-4 py-2 rounded-lg text-sm hover:bg-navy-800 disabled:opacity-50">
                  {assignStatus === 'saving' ? 'Speichert...' : 'Zuordnung speichern'}
                </button>
                {assignStatus === 'success' && <span className="text-sm font-bold text-success-green flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> Gespeichert</span>}
                {assignStatus === 'error' && <span className="text-sm font-bold text-error-red">Fehler beim Speichern</span>}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 text-sm">
              <div><span className="text-text-muted">Zugeordneter Kunde:</span> <span className="font-bold">{note.customerId || matchData.matchedCustomer?.id || "Keiner"}</span></div>
              <div><span className="text-text-muted">Zugeordneter Auftrag:</span> <span className="font-bold">{note.orderId || matchData.matchedOrder?.id || "Keiner"}</span></div>
            </div>
          )}
        </div>

      </div>

      {/* OVERLAYS FOR CONTEXT */}
      {showLogisticsModal && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-navy-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
            <button onClick={() => setShowLogisticsModal(false)} className="absolute top-4 right-4 text-text-muted hover:text-navy-900">Schließen</button>
            <h3 className="text-lg font-bold font-serif mb-2 flex items-center gap-2"><MapPin className="w-5 h-5 text-indigo-500" /> Logistik-Check</h3>
            <p className="text-sm text-text-muted mb-4">Live-Abfrage für {matchData.matchedOrder?.id || "den Kunden"} in Vorbereitung.</p>
            {matchData.matchedOrder ? (
               <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-4 text-sm text-indigo-900">
                 Status laut DB: <strong>{matchData.matchedOrder.statusText}</strong><br/>
                 Standort: Warenausgang (simuliert)
               </div>
            ) : (
               <div className="bg-gray-100 p-4 rounded-xl mb-4 text-sm text-gray-600">Kein Auftrag fest zugeordnet.</div>
            )}
            <Link href="/warendurchlauf/warenausgang" target="_blank" className="text-indigo-600 font-bold text-sm flex items-center gap-1 hover:underline">
              Zum Warenausgang <ExternalLink className="w-3 h-3"/>
            </Link>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-navy-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-4 right-4 text-text-muted hover:text-navy-900">Schließen</button>
            <h3 className="text-lg font-bold font-serif mb-2 flex items-center gap-2"><Banknote className="w-5 h-5 text-green-500" /> Zahlungs-Check</h3>
            <p className="text-sm text-text-muted mb-4">Diese Instanz verfügt aktuell über keine aktive DATEV/Payment-Schnittstelle.</p>
            <div className="bg-green-50 p-4 rounded-xl border border-green-100 mb-4 text-sm text-green-900">
              Bitte im externen Buchhaltungssystem für {matchData.matchedCustomer?.name || "den Kunden"} nachsehen.
            </div>
            <Link href="/finanzen" target="_blank" className="text-green-600 font-bold text-sm flex items-center gap-1 hover:underline">
              Zum Finanzen-Dashboard <ExternalLink className="w-3 h-3"/>
            </Link>
          </div>
        </div>
      )}

    </div>
  );
}
