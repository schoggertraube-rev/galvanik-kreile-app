import React, { useState } from 'react';
import { Database, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';

interface DatenherkunftZeileProps {
  belege: number;
  rechnungen: number;
  zeitbuchungen: number;
  verbrauchsbuchungen: number;
  periodeLabel: string;
  periodeStatus: string;
}

export function DatenherkunftZeile({
  belege,
  rechnungen,
  zeitbuchungen,
  verbrauchsbuchungen,
  periodeLabel,
  periodeStatus
}: DatenherkunftZeileProps) {
  const [isOpen, setIsOpen] = useState(false);

  const totalCount = belege + rechnungen + zeitbuchungen + verbrauchsbuchungen;
  const hasData = totalCount > 0;

  let sourceText = "";
  if (hasData) {
    const parts = [];
    if (belege > 0) parts.push(`${belege} Belege`);
    if (rechnungen > 0) parts.push(`${rechnungen} Rechnungen`);
    if (zeitbuchungen > 0) parts.push(`${zeitbuchungen} Zeitbuchungen`);
    if (verbrauchsbuchungen > 0) parts.push(`${verbrauchsbuchungen} Verbrauch`);
    
    sourceText = parts.join(" • ") + ` • Periode ${periodeLabel} ${periodeStatus}`;
  } else {
    sourceText = "Noch keine Daten erfasst — Beleg hinzufügen";
  }

  return (
    <>
      <div 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: '1px solid var(--bd, rgba(255,255,255,0.09))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
        className="group"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Database className="w-3 h-3 text-neutral-400 group-hover:text-blue-500 transition-colors" />
          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--ink3, #6B7A91)' }} className="group-hover:text-blue-500 transition-colors">
            {hasData ? `Quelle: ${sourceText}` : sourceText}
          </span>
        </div>
        <ChevronRight className="w-3 h-3 text-neutral-500 group-hover:text-blue-500 transition-colors" />
      </div>

      {isOpen && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1e1b18] flex items-center gap-2">
                <Database className="w-5 h-5 text-neutral-400" /> Datenherkunft
              </h2>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-neutral-500">
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 text-black">
              {!hasData ? (
                <div className="text-center py-12 text-neutral-400 text-sm">
                  Noch keine Daten erfasst. <br /><br />
                  <a href="/buchhaltung/belege" className="text-blue-600 underline font-medium">Neuen Beleg hinzufügen</a>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-neutral-600 mb-6 leading-relaxed">
                    Diese Kennzahl basiert auf den folgenden Echtdaten aus der Datenbank:
                    <br />
                    <strong>{sourceText}</strong>
                  </p>
                  
                  <div className="border border-neutral-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-neutral-50 border-b border-neutral-200">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-neutral-600">Datum</th>
                          <th className="px-4 py-3 font-semibold text-neutral-600">Beleg / Datensatz</th>
                          <th className="px-4 py-3 font-semibold text-neutral-600 text-right">Wert</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-neutral-100 hover:bg-neutral-50">
                          <td className="px-4 py-3 text-neutral-500">Heute</td>
                          <td className="px-4 py-3 font-medium text-[#1e1b18]">System-Snapshot</td>
                          <td className="px-4 py-3 text-right">Aggregiert</td>
                        </tr>
                        <tr className="hover:bg-neutral-50">
                          <td className="px-4 py-3 text-neutral-500">Gestern</td>
                          <td className="px-4 py-3 font-medium text-[#1e1b18]">System-Snapshot</td>
                          <td className="px-4 py-3 text-right">Aggregiert</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="flex items-center justify-between mt-4 text-xs text-neutral-500">
                    <span>Zeige aggregierte Werte</span>
                    <div className="flex gap-1">
                      <button className="px-2 py-1 border border-neutral-200 rounded hover:bg-neutral-50 disabled:opacity-50" disabled>Zurück</button>
                      <button className="px-2 py-1 border border-neutral-200 rounded hover:bg-neutral-50 disabled:opacity-50" disabled>Weiter</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
