import { foundationUnavailableAction } from "@/lib/server/foundationGate";

export type BathMeasurementBase = {
  temperature?: number | null;
  ph?: number | null;
  concentration?: number | null;
  conductivity?: number | null;
  visualState?: "clean" | "cloudy" | "contaminated" | string | null;
};

export interface BathMeasurement extends BathMeasurementBase {
  id: string;
  bathId: string;
  statusAfterMeasurement: string;
  note?: string;
  measuredAt: string;
  measuredBy: string;
}

export type NewBathMeasurement = Omit<BathMeasurement, "id" | "measuredAt"> & {
  id?: string;
  measuredAt?: string;
};

/**
 * The historic in-memory fallback made this repository look operational even
 * though there is no verified tenant, receipt or measurement-data contract.
 * Keep the public type boundary for callers, but never manufacture or persist
 * bath data until that contract has passed the foundation gates.
 */
export const bathMeasurementsRepository = {
  async list(_bathId: string): Promise<BathMeasurement[]> {
    return foundationUnavailableAction("Bäder und Messwerte");
  },

  async add(_measurement: NewBathMeasurement): Promise<BathMeasurement> {
    return foundationUnavailableAction("Bäder und Messwerte");
  },

  async getLatest(_bathId: string): Promise<BathMeasurement | null> {
    return foundationUnavailableAction("Bäder und Messwerte");
  },
};
