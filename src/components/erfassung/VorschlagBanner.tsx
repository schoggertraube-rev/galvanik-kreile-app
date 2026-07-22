"use client";

import { Button } from "@/components/ui/button";

export interface VorlageResult {
  hat_vorlage: boolean;
  schluessel?: string;
  klasse?: string;
  oberflaeche?: string;
  konfidenz?: string;
  n_referenzauftraege?: number;
  zeit?: { id: string; station: string; median_min: number; p25: number; p75: number }[];
  verbrauch?: {
    id: string;
    station: string;
    artikel_id: string;
    artikel_name: string;
    median_menge: number;
    einheit: string;
    haeufigkeit_prozent: number;
  }[];
  error?: string;
}

interface VorschlagBannerProps {
  vorlage: VorlageResult;
  onAnpassen: () => void;
}

export function VorschlagBanner({ vorlage, onAnpassen }: VorschlagBannerProps) {
  if (!vorlage.hat_vorlage) return null;

  const konfText = 
    vorlage.konfidenz === 'aufbauen' ? `⚪ Erste Erfahrungswerte (n=${vorlage.n_referenzauftraege})` :
    vorlage.konfidenz === 'aktiv'    ? `🔵 Vorlage aktiv (n=${vorlage.n_referenzauftraege})` :
                                       `🟢 Stabile Vorlage (n=${vorlage.n_referenzauftraege})`;

  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-bold text-blue-900 flex items-center gap-2">
            ✦ Vorschlag: Wie bei {vorlage.n_referenzauftraege} ähnlichen Aufträgen
          </h4>
          <p className="text-sm text-blue-800 mt-1 font-medium">
            {vorlage.klasse} · {vorlage.oberflaeche}
          </p>
        </div>
        <div className="text-sm font-bold text-blue-800 bg-white px-2 py-1 rounded-lg border border-blue-200">
          {konfText}
        </div>
      </div>

      <p className="mb-3 rounded-lg border border-blue-200 bg-white p-3 text-xs text-blue-900">
        Erfahrungswerte sind ausschließlich Vorschläge. Sie buchen niemals automatisch Zeiten oder Material für aktuelle oder zukünftige Stationen.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={onAnpassen}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl transition-colors"
        >
          Vorschlag prüfen · aktuelle Station erfassen
        </Button>
      </div>
    </div>
  );
}
