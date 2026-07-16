const DAY_MS = 24 * 60 * 60 * 1000;

export type TrendOrder = {
  intakeDate?: string;
  rawIntakeDate?: string;
};

export function getLast7DaysOrderTrend(
  orders: readonly TrendOrder[],
  now = new Date(),
): number[] {
  const trend = [0, 0, 0, 0, 0, 0, 0];
  const nowMs = now.getTime();

  for (const order of orders) {
    const rawDate = order.intakeDate || order.rawIntakeDate;
    if (!rawDate) continue;
    const orderMs = new Date(rawDate).getTime();
    if (!Number.isFinite(orderMs)) continue;

    const ageMs = nowMs - orderMs;
    if (ageMs < 0) continue;
    const ageDays = Math.floor(ageMs / DAY_MS);
    if (ageDays < 7) trend[6 - ageDays] += 1;
  }

  return trend;
}
