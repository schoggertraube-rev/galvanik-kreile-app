import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("active finance routes use server truth", () => {
  it("builds the cockpit snapshot from authenticated finance actions", () => {
    const page = source("src/app/buchhaltung/page.tsx");
    expect(page).toContain("getCockpitMetricsAction");
    expect(page).toContain("getSteuerprofilAction");
    expect(page).toContain("listOffenePostenAction");
    expect(page).toContain("invoice.offenerBetrag");
    expect(page).not.toContain("hasPermission");
  });

  it("renders no fixed cockpit KPIs or imaginary integration state", () => {
    const cockpit = source("src/app/buchhaltung/BuchhaltungCockpitClient.tsx");
    expect(cockpit).not.toContain("HeroBand");
    expect(cockpit).not.toContain("BelegeKachel");
    expect(cockpit).not.toContain("12.450");
    expect(cockpit).not.toContain("68.400");
    expect(cockpit).not.toContain("Automatik aktiv");
    expect(cockpit).not.toContain("alles funktioniert");
    expect(cockpit).toContain("Nicht angebunden");
    expect(cockpit).toContain("snapshot.openAmount");
  });

  it("uses persisted processing assumptions in the server metrics", () => {
    const actions = source("src/app/buchhaltung/actions.ts");
    expect(actions).toContain(".from(bhEinstellungen)");
    expect(actions).toContain("settings?.ocrConfidenceSchwelle");
    expect(actions).toContain("settings?.beraterStundensatz");
    expect(actions).toContain("settings?.minutenProBeleg");
    expect(actions).toContain("reviewCount");
  });

  it("keeps receipt filters allowlisted and removes invented advice and totals", () => {
    const page = source("src/app/buchhaltung/belege/page.tsx");
    const client = source("src/app/buchhaltung/belege/BelegeClient.tsx");
    expect(page).toContain("const STATUSES");
    expect(page).toContain("const TYPES");
    expect(page).toContain("UUID.test(category)");
    expect(page).not.toContain("as any");
    expect(client).not.toContain("68.400");
    expect(client).not.toContain("49.200");
    expect(client).not.toContain("Was die KI dir rät");
    expect(client).not.toContain("VERIFIZIERT");
    expect(client).not.toContain("MassenzuordnungModal");
    expect(client).toContain("initialBelege");
    expect(client).toContain("createBelegAction");
  });

  it("requires an explicit write-capable finance role for mutations", () => {
    const authorization = source("src/lib/server/financeAuthorization.ts");
    const actions = source("src/app/buchhaltung/actions.ts");
    expect(authorization).toContain("requireFinanceWrite");
    expect(authorization).toContain('actor.role !== "buero"');
    expect(actions).toMatch(/createBelegAction[\s\S]*?requireFinanceWrite\(\)/);
    expect(actions).toMatch(/freigebenBelegAction[\s\S]*?requireFinanceWrite\(\)/);
    expect(actions).toMatch(/stornoBelegAction[\s\S]*?requireFinanceWrite\(\)/);
  });
});
