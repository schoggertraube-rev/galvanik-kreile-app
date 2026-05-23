export type RiskLevel = "green" | "yellow" | "orange" | "red" | "blocked";

export interface RiskConfig {
  risk: RiskLevel;
  label: string;
  badgeClass: string;
  cardClass: string;
  leftBorderClass: string;
  textColor: string;
  accentColor: string;
}

export const RISK_LEVEL_CONFIGS: Record<RiskLevel, RiskConfig> = {
  red: {
    risk: "red",
    label: "Kritisch / Überfällig",
    badgeClass: "bg-red-100 text-red-700 border-red-200 animate-pulse",
    cardClass: "border-red-400 bg-red-50/70 shadow-lg hover:shadow-xl border-l-[12px] transform transition-all duration-200 relative overflow-hidden ring-2 ring-red-500/25",
    leftBorderClass: "border-l-red-650",
    textColor: "text-red-650",
    accentColor: "#dc2626"
  },
  orange: {
    risk: "orange",
    label: "Gefährdet",
    badgeClass: "bg-orange-100 text-orange-700 border-orange-200",
    cardClass: "border-orange-300 bg-orange-50/30 hover:shadow-md border-l-[8px] hover:border-orange-400 transition-all",
    leftBorderClass: "border-l-orange-500",
    textColor: "text-orange-600",
    accentColor: "#f97316"
  },
  yellow: {
    risk: "yellow",
    label: "Leicht Kritisch",
    badgeClass: "bg-yellow-100 text-yellow-750 border-yellow-200",
    cardClass: "border-yellow-250 bg-yellow-50/20 hover:shadow-md border-l-[6px] transition-all",
    leftBorderClass: "border-l-yellow-500",
    textColor: "text-yellow-600",
    accentColor: "#eab308"
  },
  blocked: {
    risk: "blocked",
    label: "Wartet auf Freigabe",
    badgeClass: "bg-slate-200 text-slate-700 border-slate-350",
    cardClass: "border-slate-355 bg-slate-100/60 hover:shadow-md border-l-4 opacity-85 transition-all",
    leftBorderClass: "border-l-slate-600",
    textColor: "text-slate-600",
    accentColor: "#475569"
  },
  green: {
    risk: "green",
    label: "Im Plan",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    cardClass: "border-slate-200 bg-white hover:bg-slate-50/40 hover:shadow-md border-l-4 transition-all",
    leftBorderClass: "border-l-emerald-500",
    textColor: "text-emerald-600",
    accentColor: "#10b981"
  }
};

export function getRiskConfig(risk: RiskLevel | string): RiskConfig {
  const norm = (risk || "green").toLowerCase() as RiskLevel;
  return RISK_LEVEL_CONFIGS[norm] || RISK_LEVEL_CONFIGS.green;
}
