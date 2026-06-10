import React from 'react';
import { WerkstattPulsTile } from './kacheln/werkstatt-puls/WerkstattPulsTile';

export default function AnalysePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analyse & Steuerung</h1>
        <p className="mt-1 text-sm text-gray-500">
          Zentrale Übersicht aller Leistungskennzahlen (KPIs)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <WerkstattPulsTile />
        {/* Platzhalter für kommende Kacheln */}
        <div className="border border-dashed border-gray-300 rounded-xl bg-gray-50 flex items-center justify-center h-48 text-gray-400 text-sm">
          Umsatz & Marge (nächste Spec)
        </div>
        <div className="border border-dashed border-gray-300 rounded-xl bg-gray-50 flex items-center justify-center h-48 text-gray-400 text-sm">
          Qualität & Risiko (folgt)
        </div>
      </div>
    </div>
  );
}
