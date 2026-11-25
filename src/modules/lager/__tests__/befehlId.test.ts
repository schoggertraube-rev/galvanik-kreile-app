import { describe, expect, it } from "vitest";
import { lagerBefehlId } from "../befehlId";

describe("Lager-Befehls-ID", () => {
  it("ist stabil, UUID-förmig und trennt Positionszeilen", () => {
    const erste = lagerBefehlId("TEST-OPERATION", 0);
    expect(erste).toBe(lagerBefehlId("TEST-OPERATION", 0));
    expect(erste).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/u);
    expect(lagerBefehlId("TEST-OPERATION", 1)).not.toBe(erste);
  });

  it("weist negative oder gebrochene Positionsnummern ab", () => {
    expect(() => lagerBefehlId("TEST-OPERATION", -1)).toThrow("LAGER_BEFEHL_INDEX_UNGUELTIG");
    expect(() => lagerBefehlId("TEST-OPERATION", 1.5)).toThrow("LAGER_BEFEHL_INDEX_UNGUELTIG");
  });
});
