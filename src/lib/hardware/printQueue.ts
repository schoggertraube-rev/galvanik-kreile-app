// src/lib/hardware/printQueue.ts
// PrintJob-Queue mit Retry-Logik und Warning Engine Integration
import type { PrintJob, PrintJobType } from "@/types/hardware";
import { hardwareRegistry } from "./registry";
import { warningStore } from "@/lib/warnings/store";

const STORAGE_KEY = "kreile_print_queue";

function load(): PrintJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(jobs: PrintJob[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.slice(-100)));
  } catch {
    // ignore
  }
}

let idCounter = 0;

export const printQueue = {
  getAll: () => load(),

  enqueue: async (jobType: PrintJobType, payload: Record<string, unknown>): Promise<PrintJob> => {
    const device = hardwareRegistry.getDefault(jobType);
    const job: PrintJob = {
      id: `pj_${Date.now()}_${++idCounter}`,
      deviceId: device?.id ?? "no-device",
      jobType,
      payload,
      status: "queued",
      attempts: 0,
      createdAt: new Date().toISOString(),
    };

    const jobs = load();
    jobs.push(job);
    save(jobs);

    // Simulate async print
    setTimeout(() => printQueue.process(job.id), 500);

    return job;
  },

  process: (id: string): void => {
    const jobs = load();
    const job = jobs.find((j) => j.id === id);
    if (!job) return;

    job.status = "printing";
    job.attempts++;
    save(jobs);

    // Mock: always succeed unless no device
    setTimeout(() => {
      const updatedJobs = load();
      const updatedJob = updatedJobs.find((j) => j.id === id);
      if (!updatedJob) return;

      if (updatedJob.deviceId === "no-device") {
        updatedJob.status = "failed";
        updatedJob.errorMessage = "Kein Drucker konfiguriert";
        // Trigger warning
        warningStore.add({
          id: `we_print_${Date.now()}`,
          ruleId: "hardware-01",
          ruleCode: "PRINTER_JOB_FAILED",
          domain: "hardware",
          severity: "warn",
          message: `Druckauftrag fehlgeschlagen: ${updatedJob.jobType}`,
          proposedAction: "Drucker in Einstellungen konfigurieren",
          routeOnClick: "/settings",
          detectedAt: new Date().toISOString(),
          acknowledgedAt: null,
          resolvedAt: null,
        });
      } else {
        updatedJob.status = "success";
        updatedJob.finishedAt = new Date().toISOString();
        // Mock print output
        if (typeof window !== "undefined") {
          console.log(`[PrintQueue] Druck erfolgreich: ${updatedJob.jobType}`, updatedJob.payload);
        }
      }

      save(updatedJobs);
    }, 1000);
  },
};
