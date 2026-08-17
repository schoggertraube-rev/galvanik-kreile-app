import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const ports = {
  createAuthorizedDataClient: vi.fn(() => {
    throw new Error("createAuthorizedDataClient must not be called by denied writers");
  }),
};

vi.mock("@/lib/supabase/server", () => ({
  createAuthorizedDataClient: ports.createAuthorizedDataClient,
}));

const denial = {
  ok: false,
  error: "CONFLICT",
  message: "NOT_AVAILABLE: Periodenabschluss benötigt den W3-Command-Vertrag.",
} as const;

const actionsPath = "src/app/buchhaltung/periodenabschluss/actions.ts";
const clientPath = "src/app/buchhaltung/periodenabschluss/PeriodenabschlussClient.tsx";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function writerBody(actions: string, name: string) {
  const match = actions.match(new RegExp(`export async function ${name}[^\\{]*\\{([\\s\\S]*?)\\n\\}`, "m"));
  expect(match, `${name} must remain exported`).not.toBeNull();
  return match![1];
}

function openingButtonFor(client: string, label: string) {
  const buttonBlocks = client.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
  const matches = buttonBlocks.filter((block) => block.includes(label));
  expect(matches, `${label} button must be present exactly once`).toHaveLength(1);

  const openingTag = matches[0].match(/^<button\b[^>]*>/);
  expect(openingTag, `${label} opening button tag must be present`).not.toBeNull();
  return openingTag![0];
}

describe("W2C-B2M5H Periodenabschluss fail-closed", () => {
  it("denies every financial writer before every authorized data port", async () => {
    const actions = await import("../actions");

    await expect(actions.runEnergieVerteilungAction(2026, 8)).resolves.toEqual(denial);
    await expect(actions.schliessePeriodeAction("periode-1")).resolves.toEqual(denial);
    await expect(actions.finalSchliessePeriodeAction("periode-1")).resolves.toEqual(denial);

    expect(ports.createAuthorizedDataClient).not.toHaveBeenCalled();
  });

  it("source-locks each writer to void parameters and the exact denial", () => {
    const actions = source(actionsPath);
    const writers = [
      ["runEnergieVerteilungAction", ["void jahr;", "void monat;"]],
      ["schliessePeriodeAction", ["void periodeId;"]],
      ["finalSchliessePeriodeAction", ["void periodeId;"]],
    ] as const;

    for (const [name, voidParameters] of writers) {
      const body = writerBody(actions, name);
      for (const statement of voidParameters) expect(body).toContain(statement);
      expect(body).toContain('return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Periodenabschluss benötigt den W3-Command-Vertrag." };');
      expect(body).not.toMatch(/createAuthorizedDataClient|\.rpc\b|\.from\b|\.update\b|APP_TENANT_ID|\bDate\b|console\b/);
    }
  });

  it("retains the status read and its authorized read port", () => {
    const actions = source(actionsPath);
    expect(actions).toContain("export async function getPeriodenabschlussStatusAction");
    expect(actions).toMatch(/createAuthorizedDataClient\('read'\)/);
    expect(actions).toContain(".from('v_periodenabschluss_status')");
  });

  it("removes client write and tracking paths and disables exactly the six controls", () => {
    const client = source(clientPath);
    expect(client).not.toMatch(/runEnergieVerteilungAction|schliessePeriodeAction|finalSchliessePeriodeAction|handleEnergie|handleAbschluss|handleFinalAbschluss|useRouter|router\.refresh|isProcessing|alert\(|setStatus|usePageView|trackUiEvent|logUiEvent/);
    expect(client).toContain("NOT_AVAILABLE: Periodenabschluss benötigt den W3-Command-Vertrag.");

    const actionLabels = ["Kosten verteilen", "DATEV Export", "Lexware Export", "UStVA XML generieren", "vorläufig schließen", "Endgültig schließen"];
    const buttonBlocks = client.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
    const matchedActionButtons = buttonBlocks.filter((block) => actionLabels.some((label) => block.includes(label)));
    expect(matchedActionButtons).toHaveLength(6);

    for (const label of actionLabels) {
      const tag = openingButtonFor(client, label);
      expect(tag).toMatch(/\sdisabled(?=\s|>)/);
      expect(tag).not.toMatch(/\sonClick\s*=/);
    }
  });
});
