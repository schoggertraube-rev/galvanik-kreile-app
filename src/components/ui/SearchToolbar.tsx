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
    <div className="flex flex-col sm:flex-row gap-3 bg-white border border-kreile-border rounded-2xl p-3 shadow-sm">
      {/* Suchfeld */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-kreile-muted pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2 bg-kreile-bg border border-kreile-border rounded-xl text-sm text-kreile-navy placeholder-kreile-muted focus:outline-none focus:border-kreile-border-strong transition-colors"
        />
        {value && (
          <button
            onClick={() => onChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-kreile-muted hover:text-kreile-navy transition-colors"
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
                  ? "bg-kreile-navy text-white border-kreile-navy shadow-sm"
                  : "bg-kreile-bg text-kreile-muted border-kreile-border hover:bg-white hover:text-kreile-navy hover:border-kreile-border-strong",
              ].join(" ")}
            >
              {f.label}
              {f.count !== undefined && f.count > 0 && (
                <span className={`rounded-full px-1.5 py-px text-[10px] font-black ${
                  f.id === activeFilter ? "bg-white/20 text-white" : "bg-kreile-border text-kreile-navy"
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
