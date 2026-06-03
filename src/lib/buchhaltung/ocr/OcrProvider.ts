/**
 * OcrProvider — Interface für Beleg-OCR (nicht Auftrags-OCR!)
 * Anbindung hinter Adapter-Interface, damit der Dienst austauschbar bleibt.
 * API-Key serverseitig, nie im Client.
 */

import type { BelegFile, OcrResult } from "../types";

export interface OcrProvider {
  /**
   * Extrahiert strukturierte Daten aus einem Beleg-Bild oder -PDF.
   * E-Rechnungs-XML wird NICHT durch OCR geschickt, sondern direkt geparst.
   */
  extract(file: BelegFile): Promise<OcrResult>;
}
