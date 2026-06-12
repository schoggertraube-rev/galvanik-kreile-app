"use client";

import { useState, useEffect } from "react";
import { Plus, CheckCircle2 } from "lucide-react";
import { DuplicateWarning } from "../shared/DuplicateWarning";

export function CustomerSection({ customer, onChange, onCreateNew }: { customer: any, onChange: (c: any) => void, onCreateNew?: (name: string) => void }) {
  const [search, setSearch] = useState(customer?.name || customer?.companyName || "");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  useEffect(() => {
    if (!search || search.length < 2 || customer?.id) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/erfassung/customer-search?q=${encodeURIComponent(search)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, customer?.id]);

  const handleSelect = (c: any) => {
    onChange(c);
    setSearch(c.companyName || c.name);
    setResults([]);
    setShowDuplicateWarning(false);
  };

  if (customer?.id || customer?.isNew) {
    return (
      <div className="space-y-1.5">
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide">Kunde suchen oder neu anlegen</label>
        <div className="w-full px-4 py-2.5 bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg text-sm text-gray-900">
           {customer.companyName || customer.name}
        </div>
        <div className="mt-2 flex items-center gap-2 bg-[#eaf4eb] text-[#2c6e39] px-4 py-2.5 rounded-lg text-xs font-medium border border-[#c3e2c6]">
          <CheckCircle2 className="w-4 h-4" />
          <span>Gefunden: {customer.companyName || customer.name} · {customer.customerNumber || "K-NEU"}{typeof customer.ordersCount === 'number' ? ` · ${customer.ordersCount} Aufträge` : ''}</span>
          <button onClick={() => { onChange(null); setSearch(""); }} className="ml-auto underline">Ändern</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-1.5">
      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide">Kunde suchen oder neu anlegen</label>
      <div className="relative">
        <input
          type="text"
          placeholder="Galvanik-Bürkle"
          className="w-full px-4 py-2.5 bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg focus:bg-white focus:ring-2 focus:ring-[#e5dcd0] focus:border-[#e5dcd0] transition-colors outline-none text-sm placeholder:text-gray-400"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#e5dcd0] border-t-[#1a1c23] rounded-full animate-spin" />
        )}
      </div>

      {results.length > 0 && !showDuplicateWarning && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e5dcd0] shadow-lg rounded-lg overflow-hidden z-20">
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c)}
              className="w-full text-left px-4 py-3 hover:bg-[#fcfaf6] border-b border-[#e5dcd0] last:border-0"
            >
              <div className="font-medium text-gray-900">{c.companyName || c.name}</div>
              <div className="text-sm text-gray-500 mt-0.5">{c.customerNumber} · {c.city || "Unbekannter Ort"}</div>
            </button>
          ))}
          <button
            onClick={() => onCreateNew ? onCreateNew(search) : onChange({ isNew: true, name: search })}
            className="w-full text-left px-4 py-3 bg-[#fcfaf6] hover:bg-gray-100 text-[#1a1c23] font-medium flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Als neuen Kunden "{search}" anlegen
          </button>
        </div>
      )}

      {search.length > 2 && results.length === 0 && !isSearching && !showDuplicateWarning && (
        <div className="mt-3">
          <button
            onClick={() => onCreateNew ? onCreateNew(search) : onChange({ isNew: true, name: search })}
            className="w-full py-3 bg-[#fcfaf6] border-2 border-dashed border-[#e5dcd0] hover:border-gray-400 hover:bg-white rounded-lg text-gray-600 font-medium flex items-center justify-center gap-2 transition-all"
          >
            <Plus className="w-5 h-5" />
            Neuen Kunden "{search}" anlegen
          </button>
        </div>
      )}

      {showDuplicateWarning && (
        <DuplicateWarning
          duplicates={results}
          onSelect={handleSelect}
          onIgnore={() => {
            if (onCreateNew) {
              onCreateNew(search);
            } else {
              onChange({ isNew: true, name: search });
            }
            setShowDuplicateWarning(false);
            setResults([]);
          }}
        />
      )}
    </div>
  );
}
