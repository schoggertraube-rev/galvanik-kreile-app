function normalizedLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function monthsInclusive(von: string, bis: string): number {
  const from = new Date(`${von}T00:00:00Z`);
  const to = new Date(`${bis}T00:00:00Z`);
  return Math.max(
    1,
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12
      + to.getUTCMonth()
      - from.getUTCMonth()
      + 1,
  );
}

export function parseCostKind(value: string): "fix" | "variabel" {
  const kind = normalizedLabel(value);
  if (kind !== "fix" && kind !== "variabel") throw new Error("FINANCE_COST_KIND_INVALID");
  return kind;
}

export function recurringCostInRange(
  item: { betrag: string; intervall: string; giltAb: string | null; giltBis: string | null },
  von: string,
  bis: string,
): number {
  if (item.giltAb && item.giltAb > bis) return 0;
  if (item.giltBis && item.giltBis < von) return 0;

  const amount = Number(item.betrag);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("FINANCE_COST_AMOUNT_INVALID");
  const interval = normalizedLabel(item.intervall);
  if (interval === "einmalig") {
    return item.giltAb && item.giltAb >= von && item.giltAb <= bis ? amount : 0;
  }

  const months = monthsInclusive(
    item.giltAb && item.giltAb > von ? item.giltAb : von,
    item.giltBis && item.giltBis < bis ? item.giltBis : bis,
  );
  if (interval === "monatlich") return amount * months;
  if (interval === "jaehrlich" || interval === "jahrlich") return amount * (months / 12);
  if (interval === "vierteljaehrlich" || interval === "vierteljahrlich") return amount * (months / 3);
  throw new Error("FINANCE_COST_INTERVAL_INVALID");
}
