import type {
  MarketingMetricCoverage,
  MarketingMetricState,
} from "./marketingTypes";

export type StoredMarketingMeasurement = {
  value: unknown;
  status: string | null | undefined;
  measuredAt: Date | string | null | undefined;
};

export type MarketingMetricSummary = {
  value: number | null;
  dataState: MarketingMetricState;
  coverage: MarketingMetricCoverage;
};

function validMeasurementTime(value: StoredMarketingMeasurement["measuredAt"]): boolean {
  if (value instanceof Date) return Number.isFinite(value.getTime());
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function measuredMarketingNumber(
  measurement: StoredMarketingMeasurement,
): number | null {
  if (measurement.status !== "measured" || !validMeasurementTime(measurement.measuredAt)) {
    return null;
  }
  if (
    measurement.value === null
    || measurement.value === undefined
    || measurement.value === ""
  ) {
    return null;
  }
  const value = typeof measurement.value === "number"
    ? measurement.value
    : Number(measurement.value);
  return Number.isFinite(value) ? value : null;
}

export function summarizeMarketingMeasurements(
  rows: StoredMarketingMeasurement[],
): MarketingMetricSummary {
  const values = rows.flatMap((row) => {
    const value = measuredMarketingNumber(row);
    return value === null ? [] : [value];
  });
  const coverage: MarketingMetricCoverage = {
    sourceCount: rows.length,
    measuredCount: values.length,
    missingCount: rows.length - values.length,
  };

  if (rows.length === 0) {
    return { value: 0, dataState: "confirmed_empty", coverage };
  }
  if (values.length === 0) {
    return { value: null, dataState: "not_measured", coverage };
  }
  return {
    value: values.reduce((sum, value) => sum + value, 0),
    dataState: values.length === rows.length ? "ready" : "partial",
    coverage,
  };
}

export function summarizeMarketingIdentifiers(
  values: Array<string | null | undefined>,
): MarketingMetricSummary {
  const measured = values.filter((value): value is string => Boolean(value?.trim()));
  const coverage: MarketingMetricCoverage = {
    sourceCount: values.length,
    measuredCount: measured.length,
    missingCount: values.length - measured.length,
  };
  if (values.length === 0) {
    return { value: 0, dataState: "confirmed_empty", coverage };
  }
  if (measured.length === 0) {
    return { value: null, dataState: "not_measured", coverage };
  }
  return {
    value: new Set(measured).size,
    dataState: measured.length === values.length ? "ready" : "partial",
    coverage,
  };
}

export function exactMarketingCount(value: number): MarketingMetricSummary {
  return {
    value,
    dataState: value === 0 ? "confirmed_empty" : "ready",
    coverage: {
      sourceCount: value,
      measuredCount: value,
      missingCount: 0,
    },
  };
}
