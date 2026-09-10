// Live cost calculation from slider/material/extra values
// No mock data — pure math

export interface WorkEntry {
  step: string;
  minutes: number;
  costPerHour: number;
  benchmark?: number;
  sampleSize?: number;
}

export interface MaterialEntry {
  itemName: string;
  quantity: number;
  unitCostEur: number;
  inventoryItemId?: string;
  vorlageId?: string;
  benchmarkHint?: string;
}

export interface ExtraCostEntry {
  name: string;
  active: boolean;
  minutes: number;
  costEur: number;
  eventType: string; // maps to order_cost_events.event_type
  causedBy: string;  // maps to order_cost_events.caused_by
}

export function calcWorkCostEur(entries: WorkEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.minutes / 60) * e.costPerHour, 0);
}

export function calcMaterialCostEur(entries: MaterialEntry[]): number {
  return entries.reduce((sum, e) => sum + e.quantity * e.unitCostEur, 0);
}

export function calcExtraCostEur(entries: ExtraCostEntry[]): number {
  return entries.filter(e => e.active).reduce((sum, e) => sum + e.costEur, 0);
}

export function calcTotalMinutes(entries: WorkEntry[], extras: ExtraCostEntry[]): number {
  const workMin = entries.reduce((sum, e) => sum + e.minutes, 0);
  const extraMin = extras.filter(e => e.active).reduce((sum, e) => sum + e.minutes, 0);
  return workMin + extraMin;
}

export function calcStationTotal(work: WorkEntry[], material: MaterialEntry[], extras: ExtraCostEntry[]): number {
  return calcWorkCostEur(work) + calcMaterialCostEur(material) + calcExtraCostEur(extras);
}
