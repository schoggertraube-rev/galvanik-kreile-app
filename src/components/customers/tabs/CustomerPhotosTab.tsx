import React from 'react';
import { Camera, UploadCloud } from 'lucide-react';

export function CustomerPhotosTab({ customerId }: { customerId: string }) {
void customerId;
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold font-serif text-navy-900">Fotos & Dokumente</h3>
        <button className="bg-[var(--ci-blue)] text-white hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
          <UploadCloud className="w-4 h-4" /> Datei hochladen
        </button>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center text-gray-500 flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Camera className="w-8 h-8 text-gray-400" />
        </div>
        <p className="font-semibold text-gray-900">Keine Fotos oder Dokumente</p>
        <p className="text-sm mt-1 max-w-sm">
          Ziehen Sie Dateien hierher oder nutzen Sie den Button, um Fotos von Werkstücken oder PDFs hochzuladen.
        </p>
      </div>
    </div>
  );
}
