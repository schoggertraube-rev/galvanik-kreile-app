import {
  getBathMeasurementsDb,
  recordBathMeasurementDb,
  type BathMeasurementRecord,
} from "@/app/actions/baths.actions";

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
  measuredBy?: string;
}

export type NewBathMeasurement = Omit<BathMeasurement, "id" | "measuredAt"> & { id?: string, measuredAt?: string };

function mapMeasurement(row: BathMeasurementRecord): BathMeasurement {
  return {
    id: row.id,
    bathId: row.badId,
    temperature: row.temperature != null ? Number(row.temperature) : null,
    ph: row.phValue != null ? Number(row.phValue) : null,
    concentration: null,
    conductivity: null,
    statusAfterMeasurement: row.statusAfterMeasurement,
    note: row.notes || undefined,
    measuredAt: new Date(row.measuredAt).toISOString(),
    measuredBy: row.measuredByDisplayName || undefined,
  };
}

export const bathMeasurementsRepository = {
  async list(bathId: string): Promise<BathMeasurement[]> {
    const result = await getBathMeasurementsDb(bathId);
    if (!result.ok) {
      throw new Error(`DATA_ERROR: Badmesswerte laden: ${result.message}`);
    }
    return result.data.map(mapMeasurement);
  },

  async add(measurement: NewBathMeasurement): Promise<BathMeasurement> {
    const measuredAt = measurement.measuredAt || new Date().toISOString();
    const result = await recordBathMeasurementDb({
      bathId: measurement.bathId,
      temperature: measurement.temperature ?? null,
      phValue: measurement.ph ?? null,
      notes: measurement.note || undefined,
      measuredAt,
    });
    if (!result.ok) {
      throw new Error(`DATA_ERROR: Badmesswert speichern: ${result.message}`);
    }
    return mapMeasurement(result.data.measurement);
  },

  async getLatest(bathId: string): Promise<BathMeasurement | null> {
    const result = await getBathMeasurementsDb(bathId);
    if (!result.ok) {
      throw new Error(`DATA_ERROR: Letzten Badmesswert laden: ${result.message}`);
    }
    return result.data.length > 0 ? mapMeasurement(result.data[0]) : null;
  }
};
