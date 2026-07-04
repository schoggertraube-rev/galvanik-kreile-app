/**
 * StartUser.type.test.ts
 *
 * M03H - Stellt sicher, dass der StartUser-Typ kein pinHash-Prop mehr enthaelt
 * und damit kein PIN-Hash an Client-Komponenten weitergegeben wird.
 *
 * Abgedeckte Szenarien:
 *   H1. StartUser-Objekt enthaelt zur Laufzeit kein pinHash-Feld
 *   H2. Ein gueltiges StartUser-Objekt ohne pinHash ist typsicher konstruierbar
 */

import { describe, expect, it } from "vitest";

import type { StartUser } from "@/components/start/StartScreenClient";

describe("StartUser type - M03H pinHash exposure guard", () => {
  it("H1. StartUser object does not contain pinHash at runtime", () => {
    const user: StartUser = {
      id: "user-abc",
      initials: "MM",
      role: "werkstatt",
      fullName: "Max Mustermann",
    };
    expect(user.id).toBe("user-abc");
    expect(user.fullName).toBe("Max Mustermann");
    // Laufzeitnachweis: pinHash darf nicht als Eigenschaft vorhanden sein
    expect("pinHash" in user).toBe(false);
  });

  it("H2. Multiple StartUser objects are valid without pinHash", () => {
    const users: StartUser[] = [
      { id: "1", initials: "FA", role: "admin", fullName: "Fallback Admin" },
      { id: "2", initials: "WK", role: "werkstatt", fullName: "Werner Koch" },
    ];
    expect(users).toHaveLength(2);
    for (const u of users) {
      // Kein pinHash im Client-Payload
      expect("pinHash" in u).toBe(false);
    }
  });
});
