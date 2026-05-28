import { createId } from "@paralleldrive/cuid2";
import { createClient } from "@/lib/supabase/client";

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
      const supabase = createClient();
      const { data, error } = await supabase
        .from('bath_measurements')
        .select('*')
        .eq('bath_id', bathId)
        .order('measured_at', { ascending: false });

      if (error) {
        console.error("Supabase bathMeasurementsRepository.list error:", error);
        throw error;
      }

      return data.map(m => ({
        id: m.id,
        bathId: m.bath_id,
        temperature: m.temperature,
        ph: m.ph,
        concentration: m.concentration,
        conductivity: m.conductivity,
        statusAfterMeasurement: m.status_after_measurement,
        note: m.note || undefined,
        measuredAt: m.measured_at,
        measuredBy: m.measured_by || 'unknown'
      })) as BathMeasurement[];
    }

    // --- Mock Fallback ---
    return measurementsStore.get(bathId) || [];
  },

  async add(measurement: NewBathMeasurement): Promise<BathMeasurement> {
    const newId = measurement.id || createId();
    const measuredAt = measurement.measuredAt || new Date().toISOString();

    if (isSupabase) {
      const supabase = createClient();
      const dbMeasurement = {
        id: newId,
        bath_id: measurement.bathId,
        temperature: measurement.temperature || null,
        ph: measurement.ph || null,
        concentration: measurement.concentration || null,
        conductivity: measurement.conductivity || null,
        status_after_measurement: measurement.statusAfterMeasurement,
        note: measurement.note || null,
        measured_at: measuredAt,
        measured_by: measurement.measuredBy || null
      };

      const { error } = await supabase.from('bath_measurements').insert(dbMeasurement);
      if (error) {
        console.error("Supabase bathMeasurementsRepository.add error:", error);
        throw error;
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
      const supabase = createClient();
      const { data, error } = await supabase
        .from('bath_measurements')
        .select('*')
        .eq('bath_id', bathId)
        .order('measured_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows found
        console.error("Supabase bathMeasurementsRepository.getLatest error:", error);
        throw error;
      }
      
      if (!data) return null;

      return {
        id: data.id,
        bathId: data.bath_id,
        temperature: data.temperature,
        ph: data.ph,
        concentration: data.concentration,
        conductivity: data.conductivity,
        statusAfterMeasurement: data.status_after_measurement,
        note: data.note || undefined,
        measuredAt: data.measured_at,
        measuredBy: data.measured_by || 'unknown'
      } as BathMeasurement;
    }

    // --- Mock Fallback ---
    const existing = measurementsStore.get(bathId) || [];
    if (existing.length === 0) return null;
    
    // They are inserted unshifted, so index 0 is latest
    return existing[0];
  }
};
