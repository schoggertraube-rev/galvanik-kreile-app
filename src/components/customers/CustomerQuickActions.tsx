import React from 'react';
import { Mail, Phone, PlusSquare, FileText, AlertCircle } from 'lucide-react';

export function CustomerQuickActions({ customerId }: { customerId: string }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg text-[var(--ci-ink)]">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2">
        <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm">
          <Mail className="w-4 h-4 text-gray-500" /> E-Mail
        </button>
        <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm">
          <Phone className="w-4 h-4 text-gray-500" /> Anrufen
        </button>
        <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm">
          <PlusSquare className="w-4 h-4 text-gray-500" /> Neuer Auftrag
        </button>
        <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm">
          <FileText className="w-4 h-4 text-gray-500" /> Rechnung
        </button>
        <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm col-span-2">
          <AlertCircle className="w-4 h-4 text-gray-500" /> Reklamation erfassen
        </button>
      </div>
    </div>
  );
}
