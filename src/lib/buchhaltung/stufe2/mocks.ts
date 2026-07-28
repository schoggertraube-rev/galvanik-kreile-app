/**
 * Stufe-2-Mocks: BankProvider + SteuerUebermittlung
 * Werden per Feature-Flag aktiviert, sobald Zugänge vorhanden.
 */

import type { Zeitraum, Umsatz, UstvaWerte, Quittung } from "../types";

// ── Bank ─────────────────────────────────────────────────────────────────

export interface BankProvider {
  listUmsaetze(zeitraum: Zeitraum): Promise<Umsatz[]>;
}

export class MockBankProvider implements BankProvider {
  async listUmsaetze(_zeitraum: Zeitraum): Promise<Umsatz[]> {
void _zeitraum;
    return [
      { id: "u-001", datum: "2026-05-15", betrag: -87.50, verwendungszweck: "ARAL Tankstelle", gegenkonto: "DE89...", belegId: "bel-001" },
      { id: "u-002", datum: "2026-05-22", betrag: 3200.00, verwendungszweck: "R-2026-043 Schlosserei Weber", gegenkonto: "DE44...", belegId: undefined },
    ];
  }
}

// ── ELSTER ────────────────────────────────────────────────────────────────

export interface SteuerUebermittlung {
  sendeUstva(werte: UstvaWerte, zertifikat: ArrayBuffer): Promise<Quittung>;
}

export class MockSteuerUebermittlung implements SteuerUebermittlung {
  async sendeUstva(_werte: UstvaWerte, _zertifikat: ArrayBuffer): Promise<Quittung> {
void _werte;
void _zertifikat;
    return {
      transferTicket: "DEMO-TICKET-2026-05",
      zeitpunkt: new Date().toISOString(),
      status: "akzeptiert",
    };
  }
}
