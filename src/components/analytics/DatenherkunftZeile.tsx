import React, { useState } from 'react';
import { Database, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

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
                  <Link href="/buchhaltung/belege" className="text-blue-600 underline font-medium">Neuen Beleg hinzufügen</Link>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-neutral-600 mb-6 leading-relaxed">
                    Diese Kennzahl basiert auf den folgenden Echtdaten aus der Datenbank:
                    <br />
                    <strong>{sourceText}</strong>
                  </p>
                  
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                    Diese Ansicht bestätigt ausschließlich die oben genannten aggregierten Zähler. Eine Einzelbeleg-Liste ist hier nicht angebunden; deshalb werden keine erfundenen Snapshot-Zeilen oder Zeitpunkte dargestellt.
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
