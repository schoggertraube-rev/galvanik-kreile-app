import { createId } from "@paralleldrive/cuid2";
import { computeBathStatus, BathStatus, BathTargetValues, BathMeasurement } from "@/lib/baths/computeBathStatus";
import { createClient } from "@/lib/supabase/client";

export interface Bath {
  id: string;
  bathNumber: string;
  name: string;
  processType: string;
  status: BathStatus;
  stationId?: string;
  targetValues?: BathTargetValues;
  lastMeasurementAt?: string;
  nextMeasurementDueAt?: string;
  notes?: string;
  configurationMissing?: boolean;
}

export interface BathMeasurementLog extends BathMeasurement {
  id: string;
  bathId: string;
  measuredAt: string;
  measuredBy: string;
  statusAfterMeasurement: BathStatus;
  note?: string;
}

export interface BathAddition {
  id: string;
  bathId: string;
  inventoryItemId: string;
  inventoryItemName: string;
  quantity: number;
  unit: string;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export const bathsRepository = {
  async getAllBaths(): Promise<Bath[]> {
    const supabase = createClient();
    const { data, error } = await supabase.from('baeder').select('*').order('name', { ascending: true });

    if (error) {
      console.error("Supabase getAllBaths error:", error);
      throw error;
    }

    return data.map(b => {
      const targetValues = b.target_values && Object.keys(b.target_values).length > 0 ? (b.target_values as BathTargetValues) : undefined;
      const configurationMissing = !targetValues;

      return {
        id: b.id,
        bathNumber: b.name.substring(0, 3).toUpperCase(),
        name: b.name,
        processType: b.process_type || "unknown",
        status: (b.status as BathStatus) || "stable",
        stationId: b.station_id || undefined,
        targetValues: targetValues,
        lastMeasurementAt: b.letzte_wartung || undefined,
        configurationMissing
      };
    });
  },

  async getAllMeasurements(): Promise<BathMeasurementLog[]> {
    const supabase = createClient();
    const { data, error } = await supabase.from('bad_messwerte').select('*').order('timestamp', { ascending: false });

    if (error) {
      console.error("Supabase getAllMeasurements error:", error);
      throw error;
    }

    const grouped = new Map<string, any>();
    for (const row of data) {
      const key = `${row.bad_id}_${row.timestamp}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: row.id,
          bathId: row.bad_id,
          measuredAt: row.timestamp,
          measuredBy: row.gemessen_von || "Unbekannt",
          statusAfterMeasurement: "stable" as BathStatus,
          temperature: null,
          ph: null,
          concentration: null
        });
      }
      const entry = grouped.get(key);
      if (row.wert_typ === 'temperatur') entry.temperature = Number(row.wert);
      if (row.wert_typ === 'ph') entry.ph = Number(row.wert);
      if (row.wert_typ === 'chemie') entry.concentration = Number(row.wert);
    }

    return Array.from(grouped.values());
  },

  async getAllAdditions(): Promise<BathAddition[]> {
    return [];
  },

  async getBathById(id: string): Promise<Bath | null> {
    const supabase = createClient();
    const { data, error } = await supabase.from('baeder').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    if (!data) return null;

    const targetValues = data.target_values && Object.keys(data.target_values).length > 0 ? (data.target_values as BathTargetValues) : undefined;
    const configurationMissing = !targetValues;

    return {
      id: data.id,
      bathNumber: data.name.substring(0, 3).toUpperCase(),
      name: data.name,
      processType: data.process_type || "unknown",
      status: (data.status as BathStatus) || "stable",
      stationId: data.station_id || undefined,
      targetValues: targetValues,
      lastMeasurementAt: data.letzte_wartung || undefined,
      configurationMissing
    };
  },

  async getMeasurementsByBath(bathId: string): Promise<BathMeasurementLog[]> {
    const all = await this.getAllMeasurements();
    return all
      .filter(m => m.bathId === bathId)
      .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());
  },

  async getAdditionsByBath(bathId: string): Promise<BathAddition[]> {
    return [];
  },

  async addMeasurement(bathId: string, data: Omit<BathMeasurementLog, "id" | "bathId" | "measuredAt" | "statusAfterMeasurement">): Promise<BathMeasurementLog> {
    const supabase = createClient();
    const ts = new Date().toISOString();

    if (data.temperature) {
      await supabase.from('bad_messwerte').insert({
        bad_id: bathId,
        wert_typ: 'temperatur',
        wert: data.temperature,
        gemessen_von: data.measuredBy || 'System',
        timestamp: ts
      });
    }
    if (data.ph) {
      await supabase.from('bad_messwerte').insert({
        bad_id: bathId,
        wert_typ: 'ph',
        wert: data.ph,
        gemessen_von: data.measuredBy || 'System',
        timestamp: ts
      });
    }
    if (data.concentration) {
      await supabase.from('bad_messwerte').insert({
        bad_id: bathId,
        wert_typ: 'chemie',
        wert: data.concentration,
        gemessen_von: data.measuredBy || 'System',
        timestamp: ts
      });
    }

    const bath = await this.getBathById(bathId);
    let newStatus = bath?.status || "stable";

    // Only compute if target values exist
    if (bath && bath.targetValues) {
      newStatus = computeBathStatus(data, bath.targetValues);
    }

    await supabase.from('baeder').update({
      letzte_wartung: ts,
      status: newStatus
    }).eq('id', bathId);

    return {
      ...data,
      id: createId(),
      bathId,
      measuredAt: ts,
      statusAfterMeasurement: newStatus
    };
  },

  async addAddition(bathId: string, data: Omit<BathAddition, "id" | "bathId" | "createdAt">): Promise<BathAddition> {
    throw new Error("addAddition not implemented in DB schema yet.");
  },

  async updateBathStatusManual(bathId: string, status: BathStatus, notes: string): Promise<Bath> {
    const supabase = createClient();
    const { error } = await supabase.from('baeder').update({ status }).eq('id', bathId);
    if (error) throw error;

    const updated = await this.getBathById(bathId);
    if (!updated) throw new Error("Bath not found after update");
    return updated;
  },

  async hasCriticalBath(): Promise<boolean> {
    const supabase = createClient();
    const { data, error } = await supabase.from('baeder').select('id').eq('status', 'critical').limit(1);
    if (error) throw error;
    return (data && data.length > 0);
  }
};
