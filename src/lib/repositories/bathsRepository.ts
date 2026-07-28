import type {
  BathMeasurement,
  BathStatus,
  BathTargetValues,
} from "@/lib/baths/computeBathStatus";
import { foundationUnavailableAction } from "@/lib/server/foundationGate";

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

/**
 * This source formerly combined a hard-coded tenant, in-memory data and
 * unverified database writes. It intentionally exposes no operational path
 * until the Bäder contract has tenant isolation, receipt semantics and W3
 * authorization proof.
 */
export const bathsRepository = {
  async getAllBaths(): Promise<Bath[]> {
    return foundationUnavailableAction("Bäder und Messwerte");
  },

  async getAllMeasurements(): Promise<BathMeasurementLog[]> {
    return foundationUnavailableAction("Bäder und Messwerte");
  },

  async getAllAdditions(): Promise<BathAddition[]> {
    return foundationUnavailableAction("Bäder und Messwerte");
  },

  async getBathById(_id: string): Promise<Bath | null> {
return foundationUnavailableAction("Bäder und Messwerte", _id);
  },

  async getMeasurementsByBath(_bathId: string): Promise<BathMeasurementLog[]> {
return foundationUnavailableAction("Bäder und Messwerte", _bathId);
  },

  async getAdditionsByBath(_bathId: string): Promise<BathAddition[]> {
return foundationUnavailableAction("Bäder und Messwerte", _bathId);
  },

  async addMeasurement(
    _bathId: string,
    _data: Omit<BathMeasurementLog, "id" | "bathId" | "measuredAt" | "statusAfterMeasurement">,
  ): Promise<BathMeasurementLog> {
return foundationUnavailableAction("Bäder und Messwerte", _bathId, _data);
  },

  async addAddition(
    _bathId: string,
    _data: Omit<BathAddition, "id" | "bathId" | "createdAt">,
  ): Promise<BathAddition> {
return foundationUnavailableAction("Bäder und Messwerte", _bathId, _data);
  },

  async updateBathStatusManual(
    _bathId: string,
    _status: BathStatus,
    _notes: string,
  ): Promise<Bath> {
return foundationUnavailableAction("Bäder und Messwerte", _bathId, _status, _notes);
  },

  async hasCriticalBath(): Promise<boolean> {
    return foundationUnavailableAction("Bäder und Messwerte");
  },
};
