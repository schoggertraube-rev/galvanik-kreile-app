import React from 'react';
import { Mail, Phone, MapPin, ExternalLink, Calendar, PlusCircle, AlertTriangle } from 'lucide-react';
import { useOverlayStore } from '@/lib/overlayStore';

export function CustomerOverviewTab({ customerId, customerData }: { customerId: string, customerData: any }) {
  void customerId;
  const openOrder = useOverlayStore(state => state.openOrder);

  if (!customerData) return <div className="p-4 text-gray-500">Lade Übersicht...</div>;

  const { openOrders = [] } = customerData;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stammdaten & Nächste Aktion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Kontaktdaten</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4 text-[var(--ci-orange)]" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-gray-900">{customerData.phone || 'Keine Telefonnummer'}</p>
                <p className="text-xs text-gray-500">Zentrale</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-[var(--ci-blue)]" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-gray-900">{customerData.email || 'Keine E-Mail'}</p>
                <p className="text-xs text-gray-500">Allgemein</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-sm">
                <p className="font-medium text-gray-900">{customerData.address || 'Keine Adresse'}</p>
                {customerData.city && <p className="text-xs text-gray-500">{customerData.zipCode} {customerData.city}</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[var(--ci-blue)] text-white rounded-xl p-6 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-10">
            <Calendar className="w-32 h-32" />
          </div>
          <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-4 relative z-10">Nächste Schritte</h3>
          
          {openOrders.length > 0 ? (
            <div className="relative z-10">
              <p className="font-semibold mb-2">Aktive Aufträge in Bearbeitung ({openOrders.length})</p>
              <div className="space-y-2 mt-4">
                {openOrders.slice(0, 2).map((order: any) => (
                  <button 
                    key={order.id}
                    onClick={() => openOrder(order.id)}
                    className="w-full text-left bg-white/10 hover:bg-white/20 transition-colors p-3 rounded-lg text-sm border border-white/20 flex justify-between items-center"
                  >
                    <div>
                      <span className="font-bold">{order.orderNumber}</span>
                      <span className="opacity-80 ml-2">{order.task}</span>
                    </div>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                ))}
                {openOrders.length > 2 && (
                  <p className="text-xs text-center text-white/60 pt-2">... und {openOrders.length - 2} weitere (siehe Tab Aufträge)</p>
                )}
              </div>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-center justify-center text-center py-4">
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-3">
                <AlertTriangle className="w-6 h-6 text-white/80" />
              </div>
              <p className="font-semibold">Keine offenen Aufträge.</p>
              <p className="text-sm opacity-80 mt-1">Es stehen derzeit keine Maßnahmen an.</p>
              <button className="mt-4 bg-white text-[var(--ci-blue)] px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-gray-50 transition-colors">
                <PlusCircle className="w-4 h-4" />
                Neuen Auftrag anlegen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
