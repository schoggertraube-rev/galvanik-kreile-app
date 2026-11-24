import { describe, expect, it, vi } from "vitest";
vi.mock("@/db", () => ({ db: {} }));
import { readLagerEinstellungen } from "../server/s16dSpurDSettingsPort";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const stand = {
  offline_max_stunden: 24,
  geraetefreigabe_aktiv: true,
  automatische_inventur_aktiv: false,
  material_aufschlag_prozent: null,
  lager_regelversion: null,
  entnahme_regel_je_rubrik: {},
  bezugskosten_einbeziehen: false,
  bilanzbewertung_methode: "hoechster_ek",
} as const;

function syntheticRead(rows: readonly { stand: unknown }[]): PrivilegedTenantTransaction {
  return { execute: async () => rows } as unknown as PrivilegedTenantTransaction;
}

describe("H2/H4 Lager-Einstellungen (isolierter synthetischer Porttest)", () => {
  it("liefert ungesetzten Aufschlag und Regelversion als null und den freigegebenen H4-Standard", async () => {
    expect(await readLagerEinstellungen("synthetischer-mandant", syntheticRead([{ stand }]))).toEqual(stand);
  });

  it.each(["letzter_ek", "gleitender_durchschnitt", "hoechster_ek"] as const)(
    "gibt die gespeicherte Bilanzmethode %s ohne zweite Auswahl zurück",
    async (bilanzbewertung_methode) => {
      const gespeicherterStand = { ...stand, material_aufschlag_prozent: 17, lager_regelversion: "regel-a", bilanzbewertung_methode };
      expect(await readLagerEinstellungen("synthetischer-mandant", syntheticRead([{ stand: gespeicherterStand }]))).toEqual(gespeicherterStand);
    },
  );

  it("meldet einen fehlenden qualifizierten Lesestand statt eines Ersatzwerts", async () => {
    await expect(readLagerEinstellungen("synthetischer-mandant", syntheticRead([]))).rejects.toThrow("S16D_FIRMENDATEN_NICHT_EINDEUTIG");
  });
});
