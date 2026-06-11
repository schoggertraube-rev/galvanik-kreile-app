"use client";

import { useState, useEffect } from "react";
import { Search, Plus } from "lucide-react";
import { DuplicateWarning } from "../shared/DuplicateWarning";
import { AiBadge } from "../shared/AiBadge";

export function CustomerSection({ customer, onChange }: { customer: any, onChange: (c: any) => void }) {
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
          
          // If the user types a lot and we find exactly 1-2 very close matches, we might warn them later
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

  const handleCreateNew = () => {
    if (results.length > 0 && !showDuplicateWarning) {
      setShowDuplicateWarning(true);
      return;
    }
    onChange({ isNew: true, name: search });
    setShowDuplicateWarning(false);
    setResults([]);
  };

  if (customer?.id || customer?.isNew) {
    return (
      <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg p-4">
        <div>
          <div className="text-sm font-bold text-blue-900">
            {customer.companyName || customer.name}
            {customer.isNew && <span className="ml-2 px-2 py-0.5 bg-blue-200 text-blue-800 text-xs rounded uppercase">Neu</span>}
          </div>
          <div className="text-sm text-blue-700 mt-1">
            {customer.city ? `${customer.city}` : "Keine Adresse hinterlegt"}
          </div>
        </div>
        <button
          onClick={() => {
            onChange(null);
            setSearch("");
          }}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2"
        >
          Ändern
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Name, Firma oder Kundennummer suchen..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        )}
      </div>

      {results.length > 0 && !showDuplicateWarning && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 shadow-lg rounded-lg overflow-hidden z-20">
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
            >
              <div className="font-medium text-gray-900">{c.companyName || c.name}</div>
              <div className="text-sm text-gray-500 mt-0.5">{c.customerNumber} • {c.city || "Unbekannter Ort"}</div>
            </button>
          ))}
          <button
            onClick={handleCreateNew}
            className="w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Als neuen Kunden "{search}" anlegen
          </button>
        </div>
      )}

      {search.length > 2 && results.length === 0 && !isSearching && !showDuplicateWarning && (
        <div className="mt-3">
          <button
            onClick={handleCreateNew}
            className="w-full py-3 bg-white border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50 rounded-lg text-blue-600 font-medium flex items-center justify-center gap-2 transition-all"
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
            onChange({ isNew: true, name: search });
            setShowDuplicateWarning(false);
            setResults([]);
          }}
        />
      )}
    </div>
  );
}
