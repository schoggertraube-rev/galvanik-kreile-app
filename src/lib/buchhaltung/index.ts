/**
 * Buchhaltung Provider Factory
 * Gibt den aktiven Provider basierend auf Konfiguration zurück.
 */

import type { BuchhaltungDataProvider } from "./providers/BuchhaltungDataProvider";
import { SupabaseBuchhaltungProvider } from "./providers/SupabaseBuchhaltungProvider";

let instance: BuchhaltungDataProvider | null = null;

/**
 * Gibt die aktive BuchhaltungDataProvider-Instanz zurück.
 * Aktiviert: SupabaseBuchhaltungProvider
 */
export function getBuchhaltungProvider(): BuchhaltungDataProvider {
  if (!instance) {
    instance = new SupabaseBuchhaltungProvider();
  }
  return instance;
}

// Re-exports für bequemen Zugriff
export type { BuchhaltungDataProvider } from "./providers/BuchhaltungDataProvider";
export { SupabaseBuchhaltungProvider } from "./providers/SupabaseBuchhaltungProvider";
