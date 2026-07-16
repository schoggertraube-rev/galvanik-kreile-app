export const ROUTE_TEMPLATE_IDS = [
  "direct_galvanik",
  "grinding_galvanik",
  "full_preparation_galvanik",
] as const;

export type RouteTemplateId = (typeof ROUTE_TEMPLATE_IDS)[number];

export const ROUTE_TEMPLATES = {
  direct_galvanik: {
    label: "Direkt zur Galvanik",
    stations: ["wareneingang", "galvanik", "qualitaetssicherung", "warenausgang"],
  },
  grinding_galvanik: {
    label: "Schleiferei und Galvanik",
    stations: ["wareneingang", "schleiferei", "galvanik", "qualitaetssicherung", "warenausgang"],
  },
  full_preparation_galvanik: {
    label: "Entmetallisierung, Schleiferei und Galvanik",
    stations: ["wareneingang", "entmetallisierung", "schleiferei", "galvanik", "qualitaetssicherung", "warenausgang"],
  },
} as const satisfies Record<RouteTemplateId, { label: string; stations: readonly string[] }>;

export type RouteSnapshotV1 = {
  contractVersion: 1;
  templateId: RouteTemplateId;
  stations: string[];
};

export function isRouteTemplateId(value: unknown): value is RouteTemplateId {
  return typeof value === "string" && ROUTE_TEMPLATE_IDS.includes(value as RouteTemplateId);
}

export function createRouteSnapshot(templateId: RouteTemplateId): RouteSnapshotV1 {
  return {
    contractVersion: 1,
    templateId,
    stations: [...ROUTE_TEMPLATES[templateId].stations],
  };
}

export function parseRouteSnapshot(value: unknown): RouteSnapshotV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.contractVersion !== 1 || !isRouteTemplateId(candidate.templateId) || !Array.isArray(candidate.stations)) return null;
  if (Object.keys(candidate).some((key) => !["contractVersion", "templateId", "stations"].includes(key))) return null;
  const expected = ROUTE_TEMPLATES[candidate.templateId].stations;
  if (candidate.stations.length !== expected.length) return null;
  if (candidate.stations.some((station, index) => station !== expected[index])) return null;
  return createRouteSnapshot(candidate.templateId);
}

export function getRouteStepForStation(snapshot: RouteSnapshotV1, station: string): number | null {
  const step = snapshot.stations.indexOf(station);
  return step >= 0 ? step : null;
}
