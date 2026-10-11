import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  checkAuthorityHashPins,
  checkAuthorityRepository,
  runSelftest,
} from "../../scripts/quality/check-authoritative-sources.mjs";

describe("D-GOV-001 authority gate", () => {
  it("accepts the repository authority and provider contract", () => {
    expect(checkAuthorityRepository(process.cwd())).toEqual([]);
  });

  it("fails closed for every isolated negative contract class", () => {
    expect(runSelftest()).toBe(true);
  });

  it("binds the candidate authority checker and schema to the ratchet pins", () => {
    const checkerBytes = readFileSync("scripts/quality/check-authoritative-sources.mjs");
    const schemaBytes = readFileSync("quality/authoritative-sources.json");
    const workflowText = readFileSync(".github/workflows/eslint-ratchet.yml", "utf8");
    expect(checkAuthorityHashPins({ checkerBytes, schemaBytes, workflowText })).toEqual([]);
    const corrupted = workflowText.replace(
      /AUTHORITY_CHECKER_SHA256:\s*"[0-9a-f]{64}"/i,
      `AUTHORITY_CHECKER_SHA256: "${"0".repeat(64)}"`,
    );
    expect(checkAuthorityHashPins({ checkerBytes, schemaBytes, workflowText: corrupted }))
      .toContainEqual(expect.stringMatching(/^AUTHORITY_CHECKER_PIN_MISMATCH:/));
  });
});
