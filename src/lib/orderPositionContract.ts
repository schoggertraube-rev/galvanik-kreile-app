/** BAUPLAN formulare.position: the one unit/surface contract for writes and labels. */
export const ORDER_POSITION_UNITS = [
  { key: "stueck", label: "Stück", whole: true },
  { key: "kg", label: "kg", whole: false },
  { key: "dm2", label: "dm²", whole: false },
  { key: "satz", label: "Satz", whole: true },
  { key: "stunde", label: "Std.", whole: false },
] as const;

export const ORDER_POSITION_SURFACES = [
  { key: "verchromen", label: "Verchromen" },
  { key: "vernickeln", label: "Vernickeln" },
  { key: "verzinken", label: "Verzinken" },
  { key: "entchromen_pruefen", label: "Entchromen / prüfen" },
  { key: "offen", label: "noch zu klären" },
] as const;

export type OrderPositionUnit = typeof ORDER_POSITION_UNITS[number]["key"];
export type OrderPositionSurface = typeof ORDER_POSITION_SURFACES[number]["key"];
export type OrderIntakeFreeTextUnit = OrderPositionUnit | typeof ORDER_POSITION_UNITS[number]["label"];
export const ORDER_INTAKE_FREE_TEXT_UNITS = ORDER_POSITION_UNITS.map(option => option.key);

export function normaliseOrderPositionUnit(value: unknown): OrderPositionUnit | null {
  if (typeof value !== "string") return null;
  return ORDER_POSITION_UNITS.find(option => option.key === value || option.label === value)?.key ?? null;
}

export function normaliseOrderPositionSurface(value: unknown): OrderPositionSurface | null {
  if (typeof value !== "string") return null;
  return ORDER_POSITION_SURFACES.find(option => option.key === value || option.label === value)?.key ?? null;
}

export function orderPositionUnitLabel(value: string | null | undefined): string {
  if (!value) return "fehlt";
  const option = ORDER_POSITION_UNITS.find(option => option.key === value || option.label === value);
  if (!option) throw new Error("ORDER_POSITION_UNIT_UNKNOWN");
  return option.label;
}

export function orderPositionSurfaceLabel(value: string | null | undefined): string {
  if (!value) return "fehlt";
  const option = ORDER_POSITION_SURFACES.find(option => option.key === value || option.label === value);
  if (!option) throw new Error("ORDER_POSITION_SURFACE_UNKNOWN");
  return option.label;
}

export function isOrderIntakeFreeTextUnit(value: string): value is OrderIntakeFreeTextUnit {
  return normaliseOrderPositionUnit(value) !== null;
}

export function orderPositionQuantityError(value: string | number, unit: string | null): string | null {
  if (typeof value === "string" && !value.trim()) return "Menge fehlt";
  const source = String(value).trim().replace(",", ".");
  const quantity = Number(source);
  const key = normaliseOrderPositionUnit(unit);
  const whole = key === null || ORDER_POSITION_UNITS.find(option => option.key === key)?.whole === true;
  if (!/^\d+(?:\.\d+)?$/.test(source) || !Number.isFinite(quantity) || quantity <= 0 || quantity > 99_999
    || (whole ? !Number.isSafeInteger(quantity) : (source.split(".")[1]?.length ?? 0) > 3)) {
    return whole ? "Menge 1–99 999 (ganze Zahl)" : "Menge größer 0, höchstens 3 Nachkommastellen";
  }
  return null;
}

export function orderPositionPriceError(cents: number | null, required: boolean): string | null {
  if (cents === null) return required ? "Preis fehlt" : null;
  return Number.isSafeInteger(cents) && cents >= 1 && cents <= 9_999_999 ? null : "Preis 0,01–99.999,99 €";
}

/** BAUPLAN A-71: entered free-text prices use 19%; legacy unpriced lines stay null. */
export const FREE_TEXT_VAT_RATE_BASIS_POINTS = 1900;
export function isOrderIntakeFreeTextPrice(cents: unknown, vat: unknown): boolean {
  return cents === null && vat === null
    || typeof cents === "number" && orderPositionPriceError(cents, false) === null && vat === FREE_TEXT_VAT_RATE_BASIS_POINTS;
}

/** The existing content command accepts a separate, nullable line VAT. Its
 * persisted events must be read under that same contract, not the intake one. */
export function isOrderContentPrice(cents: unknown, vat: unknown): boolean {
  return (cents === null || typeof cents === "number" && Number.isSafeInteger(cents) && cents >= 0 && cents <= 999_999_999)
    && (vat === null || [0, 700, 1900].includes(Number(vat)));
}

export function orderPositionEffortError(minutes: number | null, required: boolean): string | null {
  if (minutes === null) return required ? "Aufwand fehlt" : null;
  return Number.isSafeInteger(minutes) && minutes >= 0 && minutes <= 6000 && minutes % 5 === 0
    ? null : "Aufwand 0–6000 Min. in 5er-Schritten";
}
