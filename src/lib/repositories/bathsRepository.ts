import { BathStatus, BathTargetValues, BathMeasurement } from "@/lib/baths/computeBathStatus";
import {
  getBathsDb,
  getBathByIdDb,
  getBathMeasurementsDb,
  recordBathMeasurementDb,
  updateBathDb,
  type BathMeasurementRecord,
} from "@/app/actions/baths.actions";

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
  measuredBy?: string;
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

const BATH_STATUSES: readonly BathStatus[] = ["critical", "watch", "stable", "not_evaluated"];

function bathStatus(value: string | null): BathStatus {
  return BATH_STATUSES.includes(value as BathStatus) ? value as BathStatus : "not_evaluated";
}

function mapMeasurement(row: BathMeasurementRecord): BathMeasurementLog {
  return {
    id: row.id,
    bathId: row.badId,
    measuredAt: new Date(row.measuredAt).toISOString(),
    ...(row.measuredByDisplayName ? { measuredBy: row.measuredByDisplayName } : {}),
    statusAfterMeasurement: bathStatus(row.statusAfterMeasurement),
    temperature: row.temperature != null ? Number(row.temperature) : null,
    ph: row.phValue != null ? Number(row.phValue) : null,
    concentration: null,
    note: row.notes || undefined,
  };
}

export const bathsRepository = {
  async getAllBaths(): Promise<Bath[]> {
    const result = await getBathsDb();
    if (!result.ok) {
      console.error("bathsRepository.getAllBaths failed:", result.message);
      throw new Error(result.message);
    }

    return result.data.map(b => {
      let targetValues = b.targetValues && Object.keys(b.targetValues).length > 0 ? (b.targetValues as BathTargetValues) : undefined;
      if (!targetValues && (b.temperatureMin != null || b.temperatureMax != null || b.phMin != null || b.phMax != null)) {
        targetValues = {
          temperatureMin: b.temperatureMin != null ? Number(b.temperatureMin) : undefined,
          temperatureMax: b.temperatureMax != null ? Number(b.temperatureMax) : undefined,
          phMin: b.phMin != null ? Number(b.phMin) : undefined,
          phMax: b.phMax != null ? Number(b.phMax) : undefined,
        };
      }
      const configurationMissing = !targetValues;

      return {
        id: b.id,
        bathNumber: b.name.substring(0, 3).toUpperCase(),
        name: b.name,
        processType: b.processType || "unknown",
        status: bathStatus(b.status),
        stationId: b.stationId || undefined,
        targetValues: targetValues,
        lastMeasurementAt: b.letzteWartung ? new Date(b.letzteWartung).toISOString() : undefined,
        notes: b.notes || undefined,
        configurationMissing,
      };
    });
  },

  async getAllMeasurements(): Promise<BathMeasurementLog[]> {
    const result = await getBathMeasurementsDb();
    if (!result.ok) {
      console.error("bathsRepository.getAllMeasurements failed:", result.message);
      throw new Error(result.message);
    }

    return result.data.map(mapMeasurement);
  },

  async getAllAdditions(): Promise<BathAddition[]> {
    throw new Error("DATA_CAPABILITY_UNAVAILABLE: Badzugaben sind noch nicht an einen persistierten Buchungspfad angebunden.");
  },

  async getBathById(id: string): Promise<Bath | null> {
    const result = await getBathByIdDb(id);
    if (!result.ok) {
      console.error("bathsRepository.getBathById failed:", result.message);
      throw new Error(result.message);
    }
    if (!result.data) return null;
    const data = result.data;

    let targetValues = data.targetValues && Object.keys(data.targetValues).length > 0 ? (data.targetValues as BathTargetValues) : undefined;
    if (!targetValues && (data.temperatureMin != null || data.temperatureMax != null || data.phMin != null || data.phMax != null)) {
      targetValues = {
        temperatureMin: data.temperatureMin != null ? Number(data.temperatureMin) : undefined,
        temperatureMax: data.temperatureMax != null ? Number(data.temperatureMax) : undefined,
        phMin: data.phMin != null ? Number(data.phMin) : undefined,
        phMax: data.phMax != null ? Number(data.phMax) : undefined,
      };
    }
    const configurationMissing = !targetValues;

    return {
      id: data.id,
      bathNumber: data.name.substring(0, 3).toUpperCase(),
      name: data.name,
      processType: data.processType || "unknown",
        status: bathStatus(data.status),
      stationId: data.stationId || undefined,
      targetValues: targetValues,
      lastMeasurementAt: data.letzteWartung ? new Date(data.letzteWartung).toISOString() : undefined,
      notes: data.notes || undefined,
      configurationMissing,
    };
  },

  async getMeasurementsByBath(bathId: string): Promise<BathMeasurementLog[]> {
    const result = await getBathMeasurementsDb(bathId);
    if (!result.ok) throw new Error(result.message);
    return result.data.map(mapMeasurement);
  },

  async getAdditionsByBath(bathId: string): Promise<BathAddition[]> {
    void bathId;
    throw new Error("DATA_CAPABILITY_UNAVAILABLE: Badzugaben sind noch nicht an einen persistierten Buchungspfad angebunden.");
  },

  async addMeasurement(bathId: string, data: Omit<BathMeasurementLog, "id" | "bathId" | "measuredAt" | "statusAfterMeasurement">): Promise<BathMeasurementLog> {
    const res = await recordBathMeasurementDb({
      bathId,
      temperature: data.temperature ?? null,
      phValue: data.ph ?? null,
      notes: data.note || undefined,
    });
    if (!res.ok) throw new Error(res.message);
    return mapMeasurement(res.data.measurement);
  },

  async addAddition(bathId: string, data: Omit<BathAddition, "id" | "bathId" | "createdAt">): Promise<BathAddition> {
    void bathId;
    void data;
    throw new Error("addAddition not implemented in DB schema yet.");
  },

  async updateBathStatusManual(bathId: string, status: BathStatus, notes: string): Promise<Bath> {
    const res = await updateBathDb(bathId, { status, notes });
    if (!res.ok) throw new Error(res.message);

    const updated = await this.getBathById(bathId);
    if (!updated) throw new Error("Bath not found after update");
    return updated;
  },

  async hasCriticalBath(): Promise<boolean> {
    const result = await getBathsDb();
    if (!result.ok) throw new Error(result.message);
    return result.data.some(b => b.status === 'critical');
  }
};
