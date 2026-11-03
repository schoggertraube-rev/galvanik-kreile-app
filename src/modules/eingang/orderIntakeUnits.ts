export const ORDER_INTAKE_FREE_TEXT_UNITS = ["Stück", "kg", "dm²", "Satz", "Std."] as const;

export type OrderIntakeFreeTextUnit = typeof ORDER_INTAKE_FREE_TEXT_UNITS[number];

export function isOrderIntakeFreeTextUnit(value: string): value is OrderIntakeFreeTextUnit {
  return (ORDER_INTAKE_FREE_TEXT_UNITS as readonly string[]).includes(value);
}
