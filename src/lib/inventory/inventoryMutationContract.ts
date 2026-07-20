export const INVENTORY_QUANTITY_SCALE = 10_000;
export const INVENTORY_MAX_MOVEMENT_QUANTITY = 1_000_000;
const INVENTORY_MAX_STOCK = 9_999_999_999.9999;

function toScaledInteger(value: number): number | null {
  const scaled = value * INVENTORY_QUANTITY_SCALE;
  const rounded = Math.round(scaled);
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
  return Math.abs(scaled - rounded) <= tolerance ? rounded : null;
}

export function parseInventoryMovementQuantity(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) return null;
  if (Math.abs(value) > INVENTORY_MAX_MOVEMENT_QUANTITY) return null;
  const scaled = toScaledInteger(value);
  return scaled === null || scaled === 0 ? null : scaled / INVENTORY_QUANTITY_SCALE;
}

export function fitsInventoryQuantityDecimals(value: number, decimals: number): boolean {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 4 || !Number.isFinite(value)) return false;
  const factor = 10 ** decimals;
  const scaled = value * factor;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
  return Math.abs(scaled - Math.round(scaled)) <= tolerance;
}

export function parseStoredInventoryStock(value: unknown): number | null {
  if ((typeof value !== "number" && typeof value !== "string") || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > INVENTORY_MAX_STOCK) return null;
  const scaled = toScaledInteger(parsed);
  return scaled === null ? null : scaled / INVENTORY_QUANTITY_SCALE;
}

export function calculateNextInventoryStock(currentStock: unknown, delta: number): number | null {
  const current = parseStoredInventoryStock(currentStock);
  const normalizedDelta = parseInventoryMovementQuantity(delta);
  if (current === null || normalizedDelta === null) return null;

  const currentScaled = Math.round(current * INVENTORY_QUANTITY_SCALE);
  const deltaScaled = Math.round(normalizedDelta * INVENTORY_QUANTITY_SCALE);
  const nextScaled = currentScaled + deltaScaled;
  const maximumScaled = Math.round(INVENTORY_MAX_STOCK * INVENTORY_QUANTITY_SCALE);
  if (!Number.isSafeInteger(nextScaled) || nextScaled < 0 || nextScaled > maximumScaled) return null;
  return nextScaled / INVENTORY_QUANTITY_SCALE;
}
