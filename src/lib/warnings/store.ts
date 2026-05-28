// src/lib/warnings/store.ts
// In-memory store für WarningEvents, mit localStorage-Persistenz
import type { WarningEvent } from "@/types/warnings";

const STORAGE_KEY = "kreile_warning_events";

function loadFromStorage(): WarningEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(events: WarningEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    // Keep last 200 events max
    const trimmed = events.slice(-200);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore storage errors
  }
}

class WarningStore {
  private events: WarningEvent[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    if (typeof window !== "undefined") {
      this.events = loadFromStorage();
    }
  }

  getAll(): WarningEvent[] {
    return [...this.events];
  }

  getActive(): WarningEvent[] {
    return this.events.filter((e) => !e.resolvedAt);
  }

  getAcknowledged(): WarningEvent[] {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return this.events.filter(
      (e) =>
        e.acknowledgedAt &&
        !e.resolvedAt &&
        new Date(e.acknowledgedAt).getTime() > sevenDaysAgo
    );
  }

  getLastEventAt(ruleCode: string): string | undefined {
    const events = this.events
      .filter((e) => e.ruleCode === ruleCode)
      .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
    return events[0]?.detectedAt;
  }

  add(event: WarningEvent): void {
    this.events.push(event);
    saveToStorage(this.events);
    this.notify();
  }

  acknowledge(id: string, by: string, note?: string): void {
    const event = this.events.find((e) => e.id === id);
    if (event) {
      event.acknowledgedAt = new Date().toISOString();
      event.acknowledgedBy = by;
      if (note) event.acknowledgmentNote = note;
      saveToStorage(this.events);
      this.notify();
    }
  }

  resolve(id: string, by: string, resolution: WarningEvent["resolution"]): void {
    const event = this.events.find((e) => e.id === id);
    if (event) {
      event.resolvedAt = new Date().toISOString();
      event.resolvedBy = by;
      event.resolution = resolution;
      saveToStorage(this.events);
      this.notify();
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }
}

export const warningStore = new WarningStore();
