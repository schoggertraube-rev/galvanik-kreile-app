/**
 * ERechnungParser — Interface für E-Rechnung (XRechnung / ZUGFeRD) Empfang
 * XML wird direkt geparst, NICHT durch OCR geschickt.
 */

import type { RechnungDaten } from "../types";

export interface ERechnungParser {
  parse(xml: string): Promise<RechnungDaten>;
}
