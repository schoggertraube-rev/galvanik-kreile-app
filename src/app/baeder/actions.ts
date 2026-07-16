"use server";

import { getBathMeasurementsDb, getBathsDb } from "@/app/actions/baths.actions";

export type BaederOverviewItem = {
  id: string;
  name: string;
  status: string;
  lastMeasuredAt: string | null;
  messwerte: Array<{
    id: string;
    measuredAt: string | null;
    statusAfterMeasurement: string;
  }>;
};

export async function getBaederListAction() {
  const bathsResult = await getBathsDb();
  if (!bathsResult.ok) return bathsResult;
  const measurementsResult = await getBathMeasurementsDb();
  if (!measurementsResult.ok) return measurementsResult;

  const measurementsByBath = new Map<string, BaederOverviewItem["messwerte"]>();
  for (const measurement of measurementsResult.data) {
    const current = measurementsByBath.get(measurement.badId) || [];
    current.push({
      id: measurement.id,
      measuredAt: measurement.measuredAt?.toISOString() || null,
      statusAfterMeasurement: measurement.statusAfterMeasurement,
    });
    measurementsByBath.set(measurement.badId, current);
  }

  return {
    ok: true as const,
    data: bathsResult.data.map((bath): BaederOverviewItem => ({
      id: bath.id,
      name: bath.name,
      status: bath.status,
      lastMeasuredAt: bath.letzteWartung?.toISOString() || null,
      messwerte: measurementsByBath.get(bath.id) || [],
    })),
  };
}
