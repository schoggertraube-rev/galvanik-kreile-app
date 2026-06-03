/**
 * Buchhaltung Provider Factory
 * Gibt den aktiven Provider basierend auf Konfiguration zurück.
 */

import type { BuchhaltungDataProvider } from "./providers/BuchhaltungDataProvider";
import { MockBuchhaltungProvider } from "./providers/MockBuchhaltungProvider";

let instance: BuchhaltungDataProvider | null = null;

/**
 * Gibt die aktive BuchhaltungDataProvider-Instanz zurück.
 * Aktuell: MockBuchhaltungProvider (Demo)
 * Später: SupabaseBuchhaltungProvider (per Feature-Flag umschaltbar)
 */
export function getBuchhaltungProvider(): BuchhaltungDataProvider {
  if (!instance) {
    // TODO: Feature-Flag-basiert umschalten auf SupabaseBuchhaltungProvider
    instance = new MockBuchhaltungProvider();
  }
  return instance;
}

// Re-exports für bequemen Zugriff
export type { BuchhaltungDataProvider } from "./providers/BuchhaltungDataProvider";
export { MockBuchhaltungProvider } from "./providers/MockBuchhaltungProvider";
