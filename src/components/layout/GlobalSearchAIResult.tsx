"use client";

import React, { useState, useEffect } from 'react';
import { Sparkles, FileText, Download, RefreshCw, MessageSquare } from 'lucide-react';
import { askGlobalAiAction } from '@/app/actions/aiSearch';

interface AIResultProps {
  query: string;
  onClose?: () => void;
}

export function GlobalSearchAIResult({ query, onClose }: AIResultProps) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<Record<string, any> | null>(null);
  
  useEffect(() => {
    let active = true;
    const fetchAi = async () => {
      setLoading(true);
      try {
        const data = await askGlobalAiAction(query);
        if (active) setResult(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchAi();
    return () => { active = false; };
  }, [query]);

  const handlePdfExport = () => {
    // F-SEARCH-07 PDF Export stub
    window.print();
  };

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-posbg flex items-center justify-center animate-pulse">
          <Sparkles className="w-6 h-6 text-pos animate-spin-slow" />
        </div>
        <div>
          <h3 className="font-bold text-navy-900 text-lg">Kreile KI analysiert...</h3>
          <p className="text-sm text-navy-500 mt-1">Sammle Daten zu &quot;{query}&quot;</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="p-6 text-center text-navy-500">
        Konnte keine Antwort generieren.
      </div>
    );
  }

  return (
    <div className="p-1 max-h-[60vh] overflow-y-auto">
      <div className="p-4 bg-linear-to-br from-teal-50 to-cyan-50 rounded-xl border border-teal-100">
        <div className="flex items-center gap-2 text-teal-800 font-bold mb-3 text-sm">
          <Sparkles className="w-4 h-4" />
          KI-Analyse für &quot;{query}&quot;
        </div>
        
        {/* Zusammenfassung */}
        <p className="text-sm text-navy-900 leading-relaxed font-medium mb-4">
          {result.zusammenfassung}
        </p>

        {/* Kernzahlen */}
        {result.kernzahlen && result.kernzahlen.length > 0 && (
          <div className="mb-4 bg-white rounded-lg border border-teal-100 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-teal-50/50 text-teal-800 border-b border-teal-100">
                <tr>
                  <th className="px-3 py-2 font-semibold">Metrik</th>
                  <th className="px-3 py-2 font-semibold text-right">Wert</th>
                  <th className="px-3 py-2 font-semibold text-right">Vergleich</th>
                </tr>
              </thead>
              <tbody>
                {result.kernzahlen.map((kz: Record<string, any>, i: number) => (
                  <tr key={i} className="border-b border-teal-50 last:border-0 hover:bg-teal-50/30 cursor-pointer transition-colors">
                    <td className="px-3 py-2.5 font-semibold text-navy-900">{kz.label}</td>
                    <td className="px-3 py-2.5 text-right font-bold">{kz.wert}</td>
                    <td className={`px-3 py-2.5 text-right font-medium ${kz.trend === 'positiv' ? 'text-pos' : kz.trend === 'negativ' ? 'text-neg' : 'text-navy-500'}`}>
                      {kz.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 mb-4">
          {/* Auffälligkeiten */}
          {result.auffaelligkeiten && result.auffaelligkeiten.length > 0 && (
            <div className="bg-white p-3 rounded-lg border border-orange-100 shadow-xs">
              <h4 className="text-xs font-bold text-orange-800 uppercase tracking-wider mb-2">Auffälligkeiten</h4>
              <ul className="space-y-1.5">
                {result.auffaelligkeiten.map((item: string, i: number) => (
                  <li key={i} className="text-xs text-navy-800 flex items-start gap-1.5">
                    <span className="text-orange-400 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Empfehlungen */}
          {result.empfehlungen && result.empfehlungen.length > 0 && (
            <div className="bg-white p-3 rounded-lg border border-pos/20 shadow-xs">
              <h4 className="text-xs font-bold text-pos uppercase tracking-wider mb-2">Empfehlungen</h4>
              <ul className="space-y-1.5">
                {result.empfehlungen.map((item: string, i: number) => (
                  <li key={i} className="text-xs text-navy-800 flex items-start gap-1.5">
                    <span className="text-pos mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-teal-100/50">
          <button onClick={handlePdfExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-teal-200 text-teal-800 rounded-md text-xs font-bold hover:bg-teal-50 transition-colors shadow-xs">
            <Download className="w-3.5 h-3.5" />
            PDF Export
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-teal-200 text-teal-800 rounded-md text-xs font-bold hover:bg-teal-50 transition-colors shadow-xs">
            <MessageSquare className="w-3.5 h-3.5" />
            Nachfragen
          </button>
        </div>

      </div>
    </div>
  );
}
