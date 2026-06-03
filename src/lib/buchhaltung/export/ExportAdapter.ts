/**
 * ExportAdapter — Interface für DATEV, Lexware, Steuerberater-Paket
 */

import type { Beleg, Zeitraum, ExportDatei, Steuerprofil } from "../types";

export interface ExportAdapter {
  build(zeitraum: Zeitraum, belege: Beleg[], profil: Steuerprofil): Promise<ExportDatei>;
}
