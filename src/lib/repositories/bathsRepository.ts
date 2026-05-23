import { createId } from "@paralleldrive/cuid2";
import { computeBathStatus, BathStatus, BathTargetValues, BathMeasurement } from "@/lib/baths/computeBathStatus";

export interface Bath {
  id: string;
  bathNumber: string;
  name: string;
  processType: "nickel" | "chrome" | "degreasing" | "stripping";
  status: BathStatus;
  stationId: "beschichtung" | "entmetallisierung";
  targetValues: BathTargetValues;
  lastMeasurementAt?: string;
  nextMeasurementDueAt?: string;
  notes?: string;
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

const INITIAL_BATHS: Bath[] = [
  {
    id: "bath-1",
    bathNumber: "B1",
    name: "Nickelbad 1",
    processType: "nickel",
    status: "stable",
    stationId: "beschichtung",
    targetValues: { temperatureMin: 52, temperatureMax: 58, phMin: 3.8, phMax: 4.5, concentrationMin: 90, concentrationMax: 105 },
    lastMeasurementAt: "2026-05-21T07:15:00Z",
    nextMeasurementDueAt: "2026-05-21T15:00:00Z",
    notes: "Premium Nickelbad für Automobil-Restaurierungen."
  },
  {
    id: "bath-2",
    bathNumber: "B2",
    name: "Chrombad 1",
    processType: "chrome",
    status: "stable",
    stationId: "beschichtung",
    targetValues: { temperatureMin: 40, temperatureMax: 50, phMin: 1.0, phMax: 2.2, concentrationMin: 200, concentrationMax: 250 },
    lastMeasurementAt: "2026-05-21T08:00:00Z",
    nextMeasurementDueAt: "2026-05-21T16:00:00Z",
    notes: "Hexavalentes Glanzchrombad."
  },
  {
    id: "bath-3",
    bathNumber: "B3",
    name: "Entfettung 1",
    processType: "degreasing",
    status: "critical", // Temperature under 60°C target
    stationId: "entmetallisierung",
    targetValues: { temperatureMin: 60, temperatureMax: 75, phMin: 11.0, phMax: 13.5, concentrationMin: 80, concentrationMax: 120 },
    lastMeasurementAt: "2026-05-21T09:30:00Z",
    nextMeasurementDueAt: "2026-05-21T13:30:00Z",
    notes: "Alkalische Heißentfettung."
  },
  {
    id: "bath-4",
    bathNumber: "B4",
    name: "Entmetallisierung 1",
    processType: "stripping",
    status: "stable",
    stationId: "entmetallisierung",
    targetValues: { temperatureMin: 20, temperatureMax: 30, phMin: 5.5, phMax: 7.0, concentrationMin: 50, concentrationMax: 80 },
    lastMeasurementAt: "2026-05-21T06:45:00Z",
    nextMeasurementDueAt: "2026-05-21T14:45:00Z",
    notes: "Schonende Elektrolytische Entkupferung / Entnickelungsbad."
  }
];

const INITIAL_MEASUREMENTS: BathMeasurementLog[] = [
  { id: "bm-1", bathId: "bath-1", measuredAt: "2026-05-21T07:15:00Z", measuredBy: "meister@kreile.de", temperature: 55, ph: 4.1, concentration: 98, visualState: "clean", statusAfterMeasurement: "stable", note: "Messwerte voll im Soll." },
  { id: "bm-2", bathId: "bath-2", measuredAt: "2026-05-21T08:00:00Z", measuredBy: "werkstatt1@kreile.de", temperature: 42, ph: 1.8, concentration: 210, visualState: "clean", statusAfterMeasurement: "stable" },
  { id: "bm-3", bathId: "bath-3", measuredAt: "2026-05-21T09:30:00Z", measuredBy: "werkstatt2@kreile.de", temperature: 58, ph: 11.5, concentration: 90, visualState: "cloudy", statusAfterMeasurement: "critical", note: "Heizung kontrollieren – Temperatur zu niedrig!" }
];

const INITIAL_ADDITIONS: BathAddition[] = [
  { id: "ba-1", bathId: "bath-1", inventoryItemId: "inv-2", inventoryItemName: "Nickelzusatz Typ S", quantity: 5, unit: "l", reason: "Standarddosierung nach Messung", createdBy: "meister@kreile.de", createdAt: "2026-05-20T10:00:00Z" }
];

export const bathsRepository = {
  async getAllBaths(): Promise<Bath[]> {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kreile_baths");
      if (saved) return JSON.parse(saved);
      localStorage.setItem("kreile_baths", JSON.stringify(INITIAL_BATHS));
    }
    return INITIAL_BATHS;
  },

  async getAllMeasurements(): Promise<BathMeasurementLog[]> {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kreile_bath_measurements");
      if (saved) return JSON.parse(saved);
      localStorage.setItem("kreile_bath_measurements", JSON.stringify(INITIAL_MEASUREMENTS));
    }
    return INITIAL_MEASUREMENTS;
  },

  async getAllAdditions(): Promise<BathAddition[]> {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kreile_bath_additions");
      if (saved) return JSON.parse(saved);
      localStorage.setItem("kreile_bath_additions", JSON.stringify(INITIAL_ADDITIONS));
    }
    return INITIAL_ADDITIONS;
  },

  async getBathById(id: string): Promise<Bath | null> {
    const all = await this.getAllBaths();
    return all.find(b => b.id === id) || null;
  },

  async getMeasurementsByBath(bathId: string): Promise<BathMeasurementLog[]> {
    const all = await this.getAllMeasurements();
    return all
      .filter(m => m.bathId === bathId)
      .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());
  },

  async getAdditionsByBath(bathId: string): Promise<BathAddition[]> {
    const all = await this.getAllAdditions();
    return all
      .filter(a => a.bathId === bathId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async addMeasurement(bathId: string, data: Omit<BathMeasurementLog, "id" | "bathId" | "measuredAt" | "statusAfterMeasurement">): Promise<BathMeasurementLog> {
    const baths = await this.getAllBaths();
    const bathIndex = baths.findIndex(b => b.id === bathId);
    
    if (bathIndex === -1) {
      throw new Error(`Bath ${bathId} not found.`);
    }

    const bath = baths[bathIndex];
    // Compute new status using worst-status-wins rules
    const newStatus = computeBathStatus(data, bath.targetValues);
    
    // Update bath status
    bath.status = newStatus;
    bath.lastMeasurementAt = new Date().toISOString();
    
    // Set next measurement 8 hours later
    const nextDue = new Date();
    nextDue.setHours(nextDue.getHours() + 8);
    bath.nextMeasurementDueAt = nextDue.toISOString();

    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_baths", JSON.stringify(baths));
    }

    // Add measurement log
    const logs = await this.getAllMeasurements();
    const newLog: BathMeasurementLog = {
      ...data,
      id: createId(),
      bathId,
      measuredAt: new Date().toISOString(),
      statusAfterMeasurement: newStatus
    };
    
    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_bath_measurements", JSON.stringify([newLog, ...logs]));
      
      // Dispatch custom event to notify components
      window.dispatchEvent(new Event("storage"));
    }

    return newLog;
  },

  async addAddition(bathId: string, data: Omit<BathAddition, "id" | "bathId" | "createdAt">): Promise<BathAddition> {
    const additions = await this.getAllAdditions();
    const newAddition: BathAddition = {
      ...data,
      id: createId(),
      bathId,
      createdAt: new Date().toISOString()
    };

    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_bath_additions", JSON.stringify([newAddition, ...additions]));
      
      // Dispatch custom event
      window.dispatchEvent(new Event("storage"));
    }

    return newAddition;
  },

  async updateBathStatusManual(bathId: string, status: BathStatus, notes: string): Promise<Bath> {
    const baths = await this.getAllBaths();
    const bathIndex = baths.findIndex(b => b.id === bathId);
    if (bathIndex === -1) {
      throw new Error(`Bath ${bathId} not found.`);
    }

    baths[bathIndex].status = status;
    if (notes) {
      baths[bathIndex].notes = notes;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_baths", JSON.stringify(baths));
      
      // Dispatch custom event
      window.dispatchEvent(new Event("storage"));
    }

    return baths[bathIndex];
  },

  async hasCriticalBath(): Promise<boolean> {
    const baths = await this.getAllBaths();
    return baths.some(b => b.status === "critical");
  }
};
