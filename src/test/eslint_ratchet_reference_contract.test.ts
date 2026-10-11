import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

import {
  baselineRegressions,
  isPinnedNonExecutableCodeReference,
  type RatchetSnapshot,
} from "../../scripts/quality/eslint-ratchet-core";

function emptySnapshot(): RatchetSnapshot {
  return {
    schemaVersion: 1,
    eslintVersion: "9.0.0",
    lintContractHash: "a".repeat(64),
    judgeContractHash: "b".repeat(64),
    totals: { filesWithIssues: 0, errors: 0, warnings: 0 },
    issues: [],
    ignoredCodeFiles: [],
  };
}

describe("ESLint pinned non-executable references", () => {
  it("forbids product code from importing a pinned reference tree", async () => {
    const [result] = await new ESLint({ cwd: process.cwd() }).lintText(
      'import { Button } from "../../../docs/project/linie/ui/designsystem_v1_1/components/Button";\n' +
        "export const probe = Button;\n",
      { filePath: "src/lib/quality/reference-import-probe.ts" },
    );

    expect(result?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "no-restricted-imports",
          message: expect.stringContaining("Produktcode darf bytegebundene Referenzen"),
        }),
      ]),
    );
  });

  it("admits only the two closed evidence trees during their explicit migration", () => {
    expect(isPinnedNonExecutableCodeReference("docs/project/history/old-check.ts")).toBe(true);
    expect(
      isPinnedNonExecutableCodeReference(
        "docs/project/linie/ui/designsystem_v1_1/components/Button.tsx",
      ),
    ).toBe(true);
    expect(isPinnedNonExecutableCodeReference("src/hidden.ts")).toBe(false);

    const base = emptySnapshot();
    const candidate = emptySnapshot();
    candidate.ignoredCodeFiles = [
      {
        file: "docs/project/history/old-check.ts",
        contentHash: "c".repeat(64),
      },
      {
        file: "docs/project/linie/ui/designsystem_v1_1/components/Button.tsx",
        contentHash: "d".repeat(64),
      },
    ];

    expect(baselineRegressions(candidate, base)).toEqual([]);
  });

  it("still rejects runtime ignores and any later mutation of a pinned reference", () => {
    const base = emptySnapshot();
    base.ignoredCodeFiles = [
      {
        file: "docs/project/history/old-check.ts",
        contentHash: "c".repeat(64),
      },
    ];
    const candidate = emptySnapshot();
    candidate.ignoredCodeFiles = [
      {
        file: "docs/project/history/old-check.ts",
        contentHash: "d".repeat(64),
      },
      { file: "src/hidden.ts", contentHash: "e".repeat(64) },
    ];

    expect(baselineRegressions(candidate, base)).toEqual([
      "docs/project/history/old-check.ts: tracked ESLint-ignored code changed",
      "src/hidden.ts: newly tracked code is ignored by ESLint",
    ]);
  });
});
