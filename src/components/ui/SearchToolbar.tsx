"use client";

import { Search, X } from "lucide-react";

interface FilterTab {
  id: string;
  label: string;
  count?: number;
}

interface SearchToolbarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  filters?: FilterTab[];
  activeFilter?: string;
  onFilterChange?: (id: string) => void;
}

export function SearchToolbar({
  value,
  onChange,
  placeholder = "Suchen...",
  filters,
  activeFilter,
  onFilterChange,
}: SearchToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 bg-white border border-neutral-gray-100 rounded-2xl p-3 shadow-sm">
      {/* Suchfeld */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2 bg-bg-app border border-neutral-gray-100 rounded-xl text-sm text-navy-900 placeholder-text-muted focus:outline-none focus:border-neutral-gray-300 transition-colors"
        />
        {value && (
          <button
            onClick={() => onChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-navy-900 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter-Pillen */}
      {filters && filters.length > 0 && onFilterChange && (
        <div className="flex gap-1.5 flex-wrap sm:flex-nowrap">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => onFilterChange(f.id)}
              className={[
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
                f.id === activeFilter
                  ? "bg-navy-900 text-white border-navy-900 shadow-sm"
                  : "bg-bg-app text-text-muted border-neutral-gray-100 hover:bg-white hover:text-navy-900 hover:border-neutral-gray-300",
              ].join(" ")}
            >
              {f.label}
              {f.count !== undefined && f.count > 0 && (
                <span className={`rounded-full px-1.5 py-px text-[10px] font-black ${
                  f.id === activeFilter ? "bg-white/20 text-white" : "bg-neutral-gray-100 text-navy-900"
                }`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
