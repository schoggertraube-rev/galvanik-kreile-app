import { describe, expect, it } from "vitest";
import { leseInventurZaehlauftrag } from "../inventurZaehlauftrag";

const grund = {
  befehlId: "00000000-0000-4000-8000-000000000081",
  sessionId: "00000000-0000-4000-8000-000000000082",
  artikelId: "TEST-ARTIKEL-8",
  ortId: "00000000-0000-4000-8000-000000000083",
  version: 0,
  countedAt: "2026-11-25T11:00:00.000Z",
  einheit: "stk",
  menge: "10",
  mengenqualitaet: "exakt",
} as const;

describe("Inventur-Zählauftrag für B1a-4", () => {
  it("übernimmt ein gültiges Offline-Zähloriginal unverändert", () => {
    expect(leseInventurZaehlauftrag(grund)).toBe(grund);
  });

  it("weist zusätzliche, unvollständige und geratene Zähloriginale ab", () => {
    expect(leseInventurZaehlauftrag({ ...grund, loginId: "nicht-im-fachoriginal" })).toBeNull();
    expect(leseInventurZaehlauftrag({ ...grund, countedAt: "25.11.2026" })).toBeNull();
    expect(leseInventurZaehlauftrag({ ...grund, version: -1 })).toBeNull();
    expect(leseInventurZaehlauftrag({ ...grund, bewegungRevision: "A".repeat(64) })).toBeNull();
  });
});
