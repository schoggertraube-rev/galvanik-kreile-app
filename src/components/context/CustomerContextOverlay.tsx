"use client";

import React, { useEffect } from "react";
import { X, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Customer } from "@/lib/repositories/customersRepository";

export type CustomerContextType = "zahlungen" | "rechnungen" | "auftraege" | "kommunikation" | null;

interface CustomerContextOverlayProps {
  type: CustomerContextType;
  customer: Customer;
  onClose: () => void;
}

export function CustomerContextOverlay({ type, customer, onClose }: CustomerContextOverlayProps) {
  // Prevent background scrolling
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  let title = "";
  let content = null;
  let globalLinkHref = "";
  let globalLinkLabel = "";

  switch (type) {
    case "zahlungen":
    case "rechnungen":
      title = `Finanzen: ${customer.name}`;
      globalLinkHref = "/buchhaltung";
      globalLinkLabel = "Zur vollständigen Buchhaltung";
      content = (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-bg-app-soft p-4 rounded-xl">
              <span className="text-xs text-text-muted font-bold uppercase block mb-1">Offene Rechnungen</span>
              <span className="text-2xl font-black text-navy-900">2</span>
            </div>
            <div className="bg-error-red/10 p-4 rounded-xl border border-error-red/20">
              <span className="text-xs text-error-red font-bold uppercase block mb-1">Überfällig</span>
              <span className="text-2xl font-black text-error-red">1</span>
            </div>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <h4 className="font-bold text-navy-900 mb-2">Zahlungsverhalten</h4>
            <p className="text-sm text-text-muted">
              {customer.trustLevel === "needs_attention" 
                ? "Der Kunde zahlt aktuell sehr unzuverlässig und wird gemahnt." 
                : "Zahlungseingänge erfolgen in der Regel pünktlich innerhalb von 14 Tagen."}
            </p>
          </div>
        </div>
      );
      break;
    
    case "auftraege":
      title = `Aufträge: ${customer.name}`;
      globalLinkHref = "/warendurchlauf";
      globalLinkLabel = "Zum kompletten Warendurchlauf";
      content = (
        <div className="space-y-4">
          <div className="bg-bg-app-soft p-4 rounded-xl">
            <h4 className="font-bold text-navy-900 mb-2">Aktuell im Umlauf</h4>
            <ul className="text-sm space-y-2">
              <li className="flex justify-between"><span>#8102 (Verchromen)</span> <span className="font-bold">Galvanik</span></li>
              <li className="flex justify-between"><span>#8105 (Verzinken)</span> <span className="font-bold">Warenausgang</span></li>
            </ul>
          </div>
        </div>
      );
      break;

    case "kommunikation":
      title = `Kommunikation: ${customer.name}`;
      globalLinkHref = "/kommunikation";
      globalLinkLabel = "Zur gesamten Kommunikation";
      content = (
        <div className="space-y-4">
          <div className="bg-bg-app-soft p-4 rounded-xl">
            <h4 className="font-bold text-navy-900 mb-2">Letzte Kontakte</h4>
            <ul className="text-sm space-y-2">
              <li className="border-b pb-2">
                <span className="text-xs text-text-muted block">Gestern, 14:30 Uhr (Telefon)</span>
                Frage zur Fertigstellung von Auftrag #8102.
              </li>
              <li>
                <span className="text-xs text-text-muted block">Vor 3 Tagen (E-Mail)</span>
                Angebot bestätigt.
              </li>
            </ul>
          </div>
        </div>
      );
      break;

    default:
      content = <p>Keine Daten verfügbar.</p>;
  }

  return (
    <div className="fixed inset-0 z-9999 flex flex-col">
      <div 
        className="absolute inset-0 bg-navy-900/40 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />
      
      <div className="relative mt-auto md:m-auto w-full max-w-2xl bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-200">
        <div className="p-6 md:p-8">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-text-muted mb-1 block">Kontextfenster</span>
              <h2 className="text-xl md:text-2xl font-black font-serif text-navy-900">{title}</h2>
            </div>
            <button 
              onClick={onClose}
              className="bg-neutral-gray-200 hover:bg-error-red hover:text-white text-navy-900 p-2 rounded-full transition-colors self-start"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mb-8">
            {content}
          </div>

          <div className="flex justify-between items-center bg-bg-app-soft p-4 -mx-6 md:-mx-8 -mb-6 md:-mb-8 border-t">
            <button onClick={onClose} className="text-sm font-bold text-navy-900 hover:underline">
              Zurück zur Kundenakte
            </button>
            {globalLinkHref && (
              <Link 
                href={globalLinkHref} 
                className="text-sm font-bold text-accent-orange hover:text-accent-orange/80 flex items-center gap-1 transition-colors"
              >
                {globalLinkLabel} <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
