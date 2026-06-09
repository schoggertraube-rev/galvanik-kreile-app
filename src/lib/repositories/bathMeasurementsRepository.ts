import { createId } from "@paralleldrive/cuid2";
import {
  getBathMeasurementsDb,
  createBathMeasurementDb
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
  measuredBy: string;
}

export type NewBathMeasurement = Omit<BathMeasurement, "id" | "measuredAt"> & { id?: string, measuredAt?: string };

const isSupabase = process.env.NEXT_PUBLIC_DATA_PROVIDER === 'supabase';

// In-Memory Mock Store
const measurementsStore = new Map<string, BathMeasurement[]>();

export const bathMeasurementsRepository = {
  async list(bathId: string): Promise<BathMeasurement[]> {
    if (isSupabase) {
      const result = await getBathMeasurementsDb(bathId);
      if (!result.ok) {
        console.error("Supabase bathMeasurementsRepository.list error:", result.message);
        throw new Error(result.message);
      }

      return result.data.map(row => ({
        id: row.id,
        bathId: row.badId,
        temperature: row.temperature != null ? Number(row.temperature) : null,
        ph: row.phValue != null ? Number(row.phValue) : null,
        concentration: null,
        conductivity: null,
        statusAfterMeasurement: "stable", // Default fallback if not computed on server yet
        note: row.notes || undefined,
        measuredAt: row.measuredAt ? new Date(row.measuredAt).toISOString() : new Date().toISOString(),
        measuredBy: 'System'
      })) as BathMeasurement[];
    }

    // --- Mock Fallback ---
    return measurementsStore.get(bathId) || [];
  },

  async add(measurement: NewBathMeasurement): Promise<BathMeasurement> {
    const newId = measurement.id || createId();
    const measuredAt = measurement.measuredAt || new Date().toISOString();

    if (isSupabase) {
      const res = await createBathMeasurementDb({
        bathId: measurement.bathId,
        temperature: measurement.temperature || null,
        phValue: measurement.ph || null,
        notes: measurement.note || undefined,
        measuredAt
      });
      if (!res.ok) {
        console.error("Supabase bathMeasurementsRepository.add error:", res.message);
        throw new Error(res.message);
      }

      return {
        ...measurement,
        id: newId,
        measuredAt
      } as BathMeasurement;
    }

    // --- Mock Fallback ---
    const newMeasurement: BathMeasurement = {
      ...measurement,
      id: newId,
      measuredAt
    };

    const existing = measurementsStore.get(measurement.bathId) || [];
    measurementsStore.set(measurement.bathId, [newMeasurement, ...existing]);

    return newMeasurement;
  },

  async getLatest(bathId: string): Promise<BathMeasurement | null> {
    if (isSupabase) {
      const result = await getBathMeasurementsDb(bathId);
      if (!result.ok) {
        console.error("Supabase bathMeasurementsRepository.getLatest error:", result.message);
        throw new Error(result.message);
      }
      
      if (result.data.length === 0) return null;
      const data = result.data[0];

      return {
        id: data.id,
        bathId: data.badId,
        temperature: data.temperature != null ? Number(data.temperature) : null,
        ph: data.phValue != null ? Number(data.phValue) : null,
        concentration: null,
        conductivity: null,
        statusAfterMeasurement: "stable",
        note: data.notes || undefined,
        measuredAt: data.measuredAt ? new Date(data.measuredAt).toISOString() : new Date().toISOString(),
        measuredBy: 'System'
      } as BathMeasurement;
    }

    // --- Mock Fallback ---
    const existing = measurementsStore.get(bathId) || [];
    if (existing.length === 0) return null;
    
    return existing[0];
  }
};
