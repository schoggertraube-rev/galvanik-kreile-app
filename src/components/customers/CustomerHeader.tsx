import React from 'react';
import { CustomerKpi } from './useCustomerKpi';
import { Mail, Phone, PlusSquare, FileText, AlertCircle } from 'lucide-react';
import { useOverlayStore } from '@/lib/overlayStore';

export function CustomerHeader({ data }: { data: CustomerKpi }) {
  const openOrder = useOverlayStore(state => state.openOrder);

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full pr-12">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-[var(--ci-ink)]">{data.kunde}</h2>
          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
            Klasse {data.classification || 'B'}
          </span>
        </div>
        <p className="text-[var(--ci-ink-3)] text-sm">
          Kunde seit {new Date(data.kunde_seit).toLocaleDateString('de-DE')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button 
          onClick={() => { console.log('Email to:', data.kunde); }}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-semibold transition-colors"
          title="E-Mail schreiben"
        >
          <Mail className="w-4 h-4 text-gray-500" /> <span className="hidden sm:inline">E-Mail</span>
        </button>
        <button 
          onClick={() => { console.log('Call:', data.kunde); }}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-semibold transition-colors"
          title="Anrufen"
        >
          <Phone className="w-4 h-4 text-gray-500" /> <span className="hidden sm:inline">Anrufen</span>
        </button>
        <button 
          onClick={() => openOrder('new')}
          className="flex items-center gap-2 px-3 py-1.5 bg-[var(--ci-orange)] text-white border border-[var(--ci-orange)] rounded-lg hover:bg-orange-600 text-sm font-semibold transition-colors"
          title="Neuer Auftrag"
        >
          <PlusSquare className="w-4 h-4" /> <span className="hidden sm:inline">Neuer Auftrag</span>
        </button>
        <button 
          onClick={() => { console.log('New invoice for:', data.kunde); }}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-semibold transition-colors"
          title="Neue Rechnung"
        >
          <FileText className="w-4 h-4 text-gray-500" />
        </button>
        <button 
          onClick={() => { console.log('New complaint for:', data.kunde); }}
          className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 text-sm font-semibold transition-colors"
          title="Reklamation erfassen"
        >
          <AlertCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
