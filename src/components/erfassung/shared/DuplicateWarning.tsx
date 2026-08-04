import { AlertTriangle } from "lucide-react";
import type { CustomerSearchResult } from "../ManualFlow/CustomerSection";

interface DuplicateWarningProps {
  duplicates: CustomerSearchResult[];
  onSelect: (customer: CustomerSearchResult) => void;
  onIgnore: () => void;
}

export function DuplicateWarning({ duplicates, onSelect, onIgnore }: DuplicateWarningProps) {
  if (!duplicates || duplicates.length === 0) return null;

  return (
    <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-orange-800">
            Mögliche Dublette erkannt
          </h4>
          <p className="text-sm text-orange-700 mt-1">
            Es gibt bereits ähnliche Kunden. Möchten Sie stattdessen einen bestehenden wählen?
          </p>
          <div className="mt-3 space-y-2">
            {duplicates.map((d) => (
              <div key={d.id} className="flex items-center justify-between bg-white p-2 rounded border border-orange-100">
                <div className="text-sm">
                  <span className="font-medium text-gray-900">{d.name}</span>
                  {d.city && <span className="text-gray-500 ml-2">{d.city}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => onSelect(d)}
                  className="px-3 py-1 text-xs font-medium text-orange-700 bg-orange-100 rounded hover:bg-orange-200 transition-colors"
                >
                  Übernehmen
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onIgnore}
            className="mt-3 text-sm text-orange-600 hover:text-orange-800 font-medium underline underline-offset-2"
          >
            Trotzdem neu anlegen
          </button>
        </div>
      </div>
    </div>
  );
}
