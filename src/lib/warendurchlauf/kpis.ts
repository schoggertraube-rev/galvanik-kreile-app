import {
  isCompletedOrderStatus,
  isTerminalOrderStatus,
  normalizeStoredOrderStatus,
} from "@/lib/orders/orderMutationContract";

export type WarendurchlaufOrderSnapshot = {
  status: string;
  dueDate?: string;
  promisedDueDate?: string;
  completedDate?: string;
  intakeDate?: string;
  currentStationId?: string | null;
};

export type WarendurchlaufMetrics = {
  termintreue: number | null;
  abgeschlosseneAuftraege: number;
  termintreueMessbar: number;
  termintreueOhneMessdaten: number;
  durchlaufzeitTage: number | null;
  durchlaufzeitMessbar: number;
  durchlaufzeitOhneMessdaten: number;
  engpassStation: string;
  engpassCount: number;
  offeneAuftraege: number;
  offeneOhneStation: number;
  unbekannteStatuswerte: number;
};

function timestamp(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateWarendurchlaufMetrics(
  orders: readonly WarendurchlaufOrderSnapshot[],
): WarendurchlaufMetrics {
  const normalized = orders.map((order) => ({
    order,
    status: normalizeStoredOrderStatus(order.status),
  }));
  const unknownStatusCount = normalized.filter(({ status }) => status === "unknown").length;
  const completed = normalized.filter(
    ({ status }) => status !== "unknown" && isCompletedOrderStatus(status),
  );
  const open = normalized.filter(
    ({ status }) => status !== "unknown" && !isTerminalOrderStatus(status),
  );

  const termintreueRows = completed.flatMap(({ order }) => {
    const dueAt = timestamp(order.promisedDueDate);
    const completedAt = timestamp(order.completedDate);
    return dueAt === null || completedAt === null ? [] : [{ dueAt, completedAt }];
  });
  const deliveredOnTime = termintreueRows.filter((row) => row.completedAt <= row.dueAt).length;
  const termintreue = termintreueRows.length > 0
    ? Math.round((deliveredOnTime / termintreueRows.length) * 1_000) / 10
    : null;

  const durationDays = completed.flatMap(({ order }) => {
    const intakeAt = timestamp(order.intakeDate);
    const completedAt = timestamp(order.completedDate);
    if (intakeAt === null || completedAt === null || completedAt < intakeAt) return [];
    return [(completedAt - intakeAt) / (1_000 * 60 * 60 * 24)];
  });
  const durchlaufzeitTage = durationDays.length > 0
    ? Math.round((durationDays.reduce((sum, days) => sum + days, 0) / durationDays.length) * 10) / 10
    : null;

  const stations: Record<string, number> = {};
  let openWithoutStation = 0;
  open.forEach(({ order }) => {
    const station = order.currentStationId?.trim();
    if (!station) {
      openWithoutStation += 1;
      return;
    }
    stations[station] = (stations[station] || 0) + 1;
  });

  let engpassStation = "Kein Engpass";
  let engpassCount = 0;
  for (const [station, count] of Object.entries(stations)) {
    if (count > engpassCount) {
      engpassCount = count;
      engpassStation = station;
    }
  }

  return {
    termintreue,
    abgeschlosseneAuftraege: completed.length,
    termintreueMessbar: termintreueRows.length,
    termintreueOhneMessdaten: completed.length - termintreueRows.length,
    durchlaufzeitTage,
    durchlaufzeitMessbar: durationDays.length,
    durchlaufzeitOhneMessdaten: completed.length - durationDays.length,
    engpassStation,
    engpassCount,
    offeneAuftraege: open.length,
    offeneOhneStation: openWithoutStation,
    unbekannteStatuswerte: unknownStatusCount,
  };
}
