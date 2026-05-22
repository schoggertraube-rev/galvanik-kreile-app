import { DEFAULT_HOURLY_RATE_EUR } from "../../constants/pricing";
import { InventoryItem } from "../repositories/inventoryRepository";

export interface WorkTimeLog {
  id?: string;
  orderId?: string;
  stationId?: string;
  netMinutes?: number;
  minutes?: number;
  [key: string]: unknown;
}

export interface ConsumableUse {
  inventoryItemId: string;
  quantity: number;
  [key: string]: unknown;
}

function round2(num: number): number {
  return Math.round(num * 100) / 100;
}

export function computeStationCost(
  workTimeLogs: WorkTimeLog[],
  consumableUses: ConsumableUse[],
  inventoryItems: InventoryItem[],
  hourlyRate = DEFAULT_HOURLY_RATE_EUR,
  multiplier = 1
): { laborCost: number; materialCost: number; total: number } {
  const laborMinutes = workTimeLogs.reduce(
    (sum, w) => sum + (w.netMinutes ?? w.minutes ?? 0), 0
  );
  const laborCost = (laborMinutes / 60) * hourlyRate * multiplier;

  const materialCost = consumableUses.reduce((sum, use) => {
    const item = inventoryItems.find(i => i.id === use.inventoryItemId);
    const unitPrice = item?.pricePerUnit ?? 0;
    return sum + use.quantity * unitPrice;
  }, 0);

  return {
    laborCost: round2(laborCost),
    materialCost: round2(materialCost),
    total: round2(laborCost + materialCost)
  };
}
