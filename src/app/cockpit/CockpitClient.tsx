"use client";

import { AlertCircle, Target, TrendingUp, BarChart } from "lucide-react";
import { KpiKachel } from "./components/KpiKachel";
import { PlaceholderKachel } from "./components/PlaceholderKachel";
import { TopKundenKachel } from "./components/TopKundenKachel";
import { EngpassKachel } from "./components/EngpassKachel";
import { AgingKachel } from "./components/AgingKachel";
import { DbRankingKachel } from "./components/DbRankingKachel";

export function CockpitClient() {
  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto">
      
      {/* Reihe 1: KPI-Leiste */}
      <div className="w-full">
        <KpiKachel />
      </div>

      {/* Reihe 2: Top-Kunden | Engpass-Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <TopKundenKachel />
        </div>
        <div className="lg:col-span-2">
          <EngpassKachel />
        </div>
      </div>

      {/* Reihe 3: Forderungen-Aging | Auftrags-DB-Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AgingKachel />
        <DbRankingKachel />
      </div>

      {/* Reihe 4: Frühwarnungen | What-If-Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlaceholderKachel title="Frühwarnungen (KI)" icon={<AlertCircle className="w-5 h-5 text-danger-red" />} height="h-[250px]" />
        <PlaceholderKachel title="What-If-Studio" icon={<BarChart className="w-5 h-5 text-navy-500" />} height="h-[250px]" />
      </div>

    </div>
  );
}
