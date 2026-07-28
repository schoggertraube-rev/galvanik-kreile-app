"use client";

import "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export interface VorlageResult {
  hat_vorlage: boolean;
  schluessel?: string;
  klasse?: string;
  oberflaeche?: string;
  konfidenz?: string;
  n_referenzauftraege?: number;
  zeit?: { station: string; median_min: number; p25: number; p75: number }[];
  verbrauch?: {
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
  onUebernehmen: () => Promise<void>;
  onAnpassen: () => void;
}

export function VorschlagBanner({ vorlage, onUebernehmen, onAnpassen }: VorschlagBannerProps) {
  const [loading, setLoading] = useState(false);

  if (!vorlage.hat_vorlage) return null;

  const konfText = 
    vorlage.konfidenz === 'aufbauen' ? `⚪ Erste Erfahrungswerte (n=${vorlage.n_referenzauftraege})` :
    vorlage.konfidenz === 'aktiv'    ? `🔵 Vorlage aktiv (n=${vorlage.n_referenzauftraege})` :
                                       `🟢 Stabile Vorlage (n=${vorlage.n_referenzauftraege})`;

  const handleUebernehmen = async () => {
    setLoading(true);
    await onUebernehmen();
    setLoading(false);
  };

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

      <div className="flex flex-col sm:flex-row gap-3">
        <Button 
          onClick={handleUebernehmen}
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl transition-colors"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "Wie üblich übernehmen"
          )}
        </Button>
        <Button 
          onClick={onAnpassen}
          variant="outline"
          disabled={loading}
          className="flex-1 bg-white border-blue-300 text-blue-700 hover:bg-blue-100 font-bold h-12 rounded-xl transition-colors"
        >
          Anpassen
        </Button>
      </div>
    </div>
  );
}
