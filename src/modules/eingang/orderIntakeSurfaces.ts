export const ORDER_INTAKE_SURFACES = [
  { label: "Verchromen", key: "verchromen" },
  { label: "Vernickeln", key: "vernickeln" },
  { label: "Verzinken", key: "verzinken" },
  { label: "Entchromen / prüfen", key: "entchromen_pruefen" },
  { label: "noch zu klären", key: "offen" },
] as const;

export function orderIntakeSurfaceKey(value: string): string {
  return ORDER_INTAKE_SURFACES.find((entry) => entry.label === value || entry.key === value)?.key ?? value;
}

export function orderIntakeSurfaceLabel(value: string): string {
  return ORDER_INTAKE_SURFACES.find((entry) => entry.key === value || entry.label === value)?.label ?? value;
}
