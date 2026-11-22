import { strict as assert } from "node:assert";
import { test } from "vitest";
import { hasLagerCapability, type AppRole } from "@/lib/auth/authorizationContract";

test("Lagerstammdaten folgen dem Loginrecht und seinem Standard je Rolle", () => {
  const erwartung: [AppRole, boolean][] = [
    ["admin", true], ["buero", true], ["meister", false],
    ["werkstatt", false], ["readonly", false], ["developer", false],
  ];
  for (const [role, darfSchreiben] of erwartung) {
    assert.equal(hasLagerCapability({ role, active: true }, "lager.stamm"), darfSchreiben, role);
  }
  assert.equal(hasLagerCapability({ role: "admin", active: true, areas: [] }, "lager.stamm"), false);
  assert.equal(hasLagerCapability({ role: "buero", active: true, areas: [] }, "lager.stamm"), false);
  assert.equal(hasLagerCapability({ role: "meister", active: true, areas: ["lager.stamm"] }, "lager.stamm"), true);
  assert.equal(hasLagerCapability({ role: "readonly", active: true, areas: ["lager.stamm"] }, "lager.stamm"), false);
  assert.equal(hasLagerCapability({ role: "admin", active: false, areas: ["lager.stamm"] }, "lager.stamm"), false);
});

test("Lagerlesen, Werkstattentwurf und Wertsicht haben verschiedene Rechte", () => {
  const readonly = { role: "readonly", active: true } as const;
  const werkstatt = { role: "werkstatt", active: true } as const;
  assert.equal(hasLagerCapability(readonly, "lager.lesen"), true);
  assert.equal(hasLagerCapability(readonly, "lager.werte"), false);
  assert.equal(hasLagerCapability(readonly, "lager.buchen"), false);
  assert.equal(hasLagerCapability(werkstatt, "lager.buchen"), true);
  assert.equal(hasLagerCapability(werkstatt, "lager.stamm"), false);
});
