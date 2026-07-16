type PriceLineAmount = {
  qty: string | null;
  unitPriceEur: string;
  unitTotalEur: string | null;
};

function parseFixed(value: string, scale: number): number {
  const normalized = value.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) throw new Error("INVALID_PAYMENT_AMOUNT");
  const fraction = (match[2] ?? "").padEnd(scale, "0");
  if (fraction.length > scale) throw new Error("INVALID_PAYMENT_AMOUNT");
  const result = Number(match[1]) * 10 ** scale + Number(fraction || "0");
  if (!Number.isSafeInteger(result)) throw new Error("INVALID_PAYMENT_AMOUNT");
  return result;
}

export function sumPriceLinesCents(lines: PriceLineAmount[]): number {
  let total = 0;
  for (const line of lines) {
    if (line.unitTotalEur !== null) {
      total += parseFixed(line.unitTotalEur, 2);
      continue;
    }
    const quantityHundredths = parseFixed(line.qty ?? "1", 2);
    const unitPriceCents = parseFixed(line.unitPriceEur, 2);
    const product = quantityHundredths * unitPriceCents;
    if (!Number.isSafeInteger(product)) throw new Error("INVALID_PAYMENT_AMOUNT");
    total += Math.round(product / 100);
  }
  if (!Number.isSafeInteger(total) || total <= 0) {
    throw new Error("INVALID_PAYMENT_AMOUNT");
  }
  return total;
}
