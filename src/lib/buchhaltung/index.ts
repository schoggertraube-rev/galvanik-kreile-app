/**
 * Buchhaltung Provider Factory
 * Gibt den aktiven Provider basierend auf Konfiguration zurück.
 */

import type { BuchhaltungDataProvider } from "./providers/BuchhaltungDataProvider";
import { MockBuchhaltungProvider } from "./providers/MockBuchhaltungProvider";
import { SupabaseBuchhaltungProvider } from "./providers/SupabaseBuchhaltungProvider";

let instance: BuchhaltungDataProvider | null = null;

/**
 * Gibt die aktive BuchhaltungDataProvider-Instanz zurück.
 * Aktiviert: SupabaseBuchhaltungProvider mit Fallback auf MockBuchhaltungProvider
 */
export function getBuchhaltungProvider(): BuchhaltungDataProvider {
  if (!instance) {
    const fallback = new MockBuchhaltungProvider();
    instance = new SupabaseBuchhaltungProvider(fallback);
  }
  return instance;
}

// Re-exports für bequemen Zugriff
export type { BuchhaltungDataProvider } from "./providers/BuchhaltungDataProvider";
export { MockBuchhaltungProvider } from "./providers/MockBuchhaltungProvider";
export { SupabaseBuchhaltungProvider } from "./providers/SupabaseBuchhaltungProvider";
