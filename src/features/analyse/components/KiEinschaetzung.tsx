import React from 'react';
import { LeerzustandHinweis } from './LeerzustandHinweis';

export interface KiEinschaetzungProps {
  isLoading: boolean;
  error?: unknown;
  data?: {
    beobachtung: string;
    achtung?: string;
    empfehlung: string;
  };
}

export const KiEinschaetzung: React.FC<KiEinschaetzungProps> = ({ isLoading, error, data }) => {
  if (isLoading) {
    return (
      <div className="p-6 bg-blue-50/50 rounded-xl border border-blue-100 animate-pulse">
        <div className="h-4 bg-blue-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-2">
          <div className="h-3 bg-blue-100 rounded w-full"></div>
          <div className="h-3 bg-blue-100 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return <LeerzustandHinweis message="KI-Einschätzung gerade nicht verfügbar" />;
  }

  if (!data) {
    return null;
  }

  return (
    <div className="p-6 bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-100 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-blue-600 text-xl">✨</span>
        <h3 className="text-sm font-bold tracking-wide text-blue-900 uppercase">KI-Einschätzung</h3>
      </div>
      
      <div className="space-y-4 text-sm text-gray-700">
        <p><strong>Beobachtung:</strong> {data.beobachtung}</p>
        
        {data.achtung && (
          <div className="p-3 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-200">
            <strong>Achtung:</strong> {data.achtung}
          </div>
        )}
        
        <p className="p-3 bg-blue-600 text-white rounded-lg shadow-sm">
          <strong>Empfehlung:</strong> {data.empfehlung}
        </p>
      </div>
    </div>
  );
};
