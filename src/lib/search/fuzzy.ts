// src/lib/search/fuzzy.ts
// Token-Overlap-basierte Fuzzy-Suche + Fallback-Vorschläge
import type { SearchAction, SearchSuggestion } from "@/types/search";

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const tb = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : inter / union;
}

export function findActions(
  input: string,
  actions: SearchAction[]
): SearchSuggestion[] {
  const normalized = input.toLowerCase().trim();
  if (!normalized) return [];

  const scored = actions
    .map((a) => {
      const candidates = [
        a.label.toLowerCase(),
        ...a.synonyms.map((s) => s.toLowerCase()),
      ];
      // Check substring match first (higher weight)
      const substringMatch = candidates.some((c) => c.includes(normalized) || normalized.includes(c.split(" ")[0]));
      const bestOverlap = Math.max(...candidates.map((c) => tokenOverlap(c, normalized)));
      const score = substringMatch ? Math.max(bestOverlap, 0.6) : bestOverlap;
      return { action: a, score };
    })
    .filter((x) => x.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scored.map(({ action, score }) => ({
    type: "action" as const,
    label: `${action.icon ?? "🔹"} ${action.label}`,
    secondary: action.description,
    routeOnSelect: action.routeOnSelect,
    score,
    source: "action" as const,
  }));
}

export function buildFallbackSuggestion(input: string): SearchSuggestion[] {
  const normalized = input.toLowerCase();

  const modules = [
    {
      keys: ["rechnung", "abrechnen", "faktur"],
      route: "/buchhaltung/rechnungen/neu",
      label: "📄 Rechnung anlegen",
      secondary: "Zum angebundenen Rechnungsformular",
    },
    {
      keys: ["kunde", "anlegen"],
      route: "/customers/new",
      label: "👤 Neuen Kunden anlegen",
      secondary: "Direkt zur Kundenanlage",
    },
    {
      keys: ["auftrag", "neu", "bestellen"],
      route: "/orders/new",
      label: "📋 Neuen Auftrag anlegen",
      secondary: "Wareneingang-Wizard starten",
    },
    {
      keys: ["scan", "barcode", "foto"],
      route: "/scan",
      label: "📷 Scan starten",
      secondary: "Kamera und OCR-Erfassung",
    },
    {
      keys: ["mahnung", "offen", "überfällig"],
      route: "/buchhaltung/rechnungen?ueberfaellig=1",
      label: "⚠️ Überfällige Rechnungen",
      secondary: "Serverseitig gefilterte Rechnungen",
    },
    {
      keys: ["lager", "material", "bestand", "chemikalien"],
      route: "/items",
      label: "📦 Lager & Material",
      secondary: "Kanonische Bestände und Materialbewegungen",
    },
    {
      keys: ["bad", "bäder", "labor", "badanalyse"],
      route: "/baeder",
      label: "🧪 Bäder & Laboranalyse",
      secondary: "Badwerte und Laboranalysen",
    },
  ];

  for (const m of modules) {
    if (m.keys.some((k) => normalized.includes(k))) {
      return [
        {
          type: "fuzzy",
          label: m.label,
          secondary: m.secondary,
          routeOnSelect: m.route,
          score: 0.5,
        },
      ];
    }
  }

  // Ultimate fallback: ErfassungGate
  return [
    {
      type: "fuzzy",
      label: "✨ Neu anlegen",
      secondary: `Erfassung für "${input}" starten`,
      routeOnSelect: `?erfassung_gate=${encodeURIComponent(input)}`,
      score: 0.1,
    },
  ];
}
