import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";
import {
  assertRatchetSnapshot,
  baselineRegressions,
  compareSnapshots,
  computeLintContractHash,
  judgeInvocationContract,
  LINT_DEPENDENCY_ROOTS,
  projectDependencyClosure,
  snapshotFromLintResults,
  type LintResultLike,
  type RatchetSnapshot,
} from "../../../../scripts/quality/eslint-ratchet-core";

function snapshot(issues: RatchetSnapshot["issues"]): RatchetSnapshot {
  const errors = issues
    .filter((issue) => issue.severity === 2)
    .reduce((sum, issue) => sum + issue.count, 0);
  const warnings = issues
    .filter((issue) => issue.severity === 1)
    .reduce((sum, issue) => sum + issue.count, 0);
  return {
    schemaVersion: 1,
    eslintVersion: "9.0.0",
    lintContractHash: "a".repeat(64),
    judgeContractHash: "b".repeat(64),
    totals: {
      filesWithIssues: new Set(issues.map((issue) => issue.file)).size,
      errors,
      warnings,
    },
    issues,
    ignoredCodeFiles: [],
  };
}

const existingIssue: RatchetSnapshot["issues"][number] = {
  file: "src/example.ts",
  ruleId: "example/rule",
  severity: 2,
  messageId: "badValue",
  message: "Bad value.",
  count: 1,
};

describe("ESLint repository ratchet", () => {
  it("does not allow inline directives to hide new lint debt", async () => {
    const [result] = await new ESLint({ cwd: process.cwd() }).lintText(
      "/* eslint-disable @typescript-eslint/no-explicit-any */\n" +
        "export const hiddenLintDebt: any = 1;\n",
      { filePath: "src/lib/quality/inline-ratchet-probe.ts" },
    );

    expect(result?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: null,
          message: expect.stringContaining("noInlineConfig"),
        }),
        expect.objectContaining({
          ruleId: "@typescript-eslint/no-explicit-any",
          severity: 2,
        }),
      ]),
    );
  });

  it("normalizes absolute paths and aggregates identical messages", () => {
    const lintResult = {
      filePath: "/repo/src/example.ts",
      errorCount: 2,
      warningCount: 0,
      messages: [
        {
          ruleId: "example/rule",
          severity: 2,
          message: "Bad value.",
          messageId: "badValue",
        },
        {
          ruleId: "example/rule",
          severity: 2,
          message: "Bad value.",
          messageId: "badValue",
        },
      ],
    } as LintResultLike;

    expect(
      snapshotFromLintResults(
        [lintResult],
        "/repo",
        "9.0.0",
        "a".repeat(64),
        "b".repeat(64),
        [],
      ),
    ).toEqual({
      schemaVersion: 1,
      eslintVersion: "9.0.0",
      lintContractHash: "a".repeat(64),
      judgeContractHash: "b".repeat(64),
      totals: { filesWithIssues: 1, errors: 2, warnings: 0 },
      issues: [{ ...existingIssue, count: 2 }],
      ignoredCodeFiles: [],
    });
  });

  it("canonicalizes checkout-specific Linux and Windows paths in messages", () => {
    const linux = snapshotFromLintResults(
      [
        {
          filePath: "/repo/src/example.ts",
          errorCount: 1,
          warningCount: 0,
          messages: [
            {
              ruleId: "example/rule",
              severity: 2,
              message: "Project /repo/tsconfig.json cannot be read.",
            },
          ],
        },
      ],
      "/repo",
      "9.0.0",
      "a".repeat(64),
      "b".repeat(64),
      [],
    );
    const windows = snapshotFromLintResults(
      [
        {
          filePath: "C:\\repo\\src\\example.ts",
          errorCount: 1,
          warningCount: 0,
          messages: [
            {
              ruleId: "example/rule",
              severity: 2,
              message: "Project C:\\repo\\tsconfig.json cannot be read.",
            },
          ],
        },
      ],
      "C:\\repo",
      "9.0.0",
      "a".repeat(64),
      "b".repeat(64),
      [],
    );

    expect(windows.issues).toEqual(linux.issues);
    expect(linux.issues[0]).toEqual(
      expect.objectContaining({
        file: "src/example.ts",
        message: "Project <repo>/tsconfig.json cannot be read.",
      }),
    );
  });

  it("binds transitive and nested lint dependencies into the contract hash", () => {
    expect(LINT_DEPENDENCY_ROOTS).toEqual([
      "eslint",
      "eslint-config-next",
      "typescript",
      "tsx",
      "next",
      "react",
    ]);
    const packages = {
      "": {
        devDependencies: { eslint: "^9", tsx: "^4" },
      },
      "node_modules/eslint": {
        version: "9.0.0",
        dependencies: { ignore: "^5", espree: "^10" },
      },
      "node_modules/eslint/node_modules/espree": {
        version: "10.0.0",
        dependencies: { acorn: "^8" },
      },
      "node_modules/eslint/node_modules/espree/node_modules/acorn": {
        version: "8.0.0",
      },
      "node_modules/ignore": { version: "5.3.2", integrity: "sha512-current" },
      "node_modules/tsx": { version: "4.0.0", peerDependencies: { node: ">=18" } },
    };
    const roots = ["eslint", "tsx"];

    expect(projectDependencyClosure(packages, roots).map(({ packagePath }) => packagePath))
      .toEqual([
        "node_modules/eslint",
        "node_modules/eslint/node_modules/espree",
        "node_modules/eslint/node_modules/espree/node_modules/acorn",
        "node_modules/ignore",
        "node_modules/tsx",
      ]);

    const current = computeLintContractHash("export default []", { packages }, roots);
    const driftedPackages = structuredClone(packages);
    driftedPackages["node_modules/ignore"].version = "5.3.1";
    driftedPackages["node_modules/ignore"].integrity = "sha512-drifted";
    expect(
      computeLintContractHash("export default []", { packages: driftedPackages }, roots),
    ).not.toBe(current);
  });

  it("binds the protected Node selector and fallback into the judge invocation", () => {
    expect(
      judgeInvocationContract({
        scripts: { "lint:ratchet": "node checker" },
        engines: { node: ">=24" },
      }),
    ).toEqual({
      lintRatchet: "node checker",
      lintRatchetUpdate: null,
      nodeEngine: ">=24",
      nodeFallback: "24",
    });
  });

  it("distinguishes regressions from improvements as a multiset", () => {
    const base = snapshot([{ ...existingIssue, count: 2 }]);
    const lower = snapshot([{ ...existingIssue, count: 1 }]);
    const higher = snapshot([{ ...existingIssue, count: 3 }]);

    expect(compareSnapshots(lower, base)).toEqual({
      regressions: [],
      improvements: [{ ...existingIssue, count: 1 }],
    });
    expect(compareSnapshots(higher, base)).toEqual({
      regressions: [{ ...existingIssue, count: 1 }],
      improvements: [],
    });
  });

  it("rejects a committed baseline that introduces a new issue key", () => {
    const base = snapshot([existingIssue]);
    const candidate = snapshot([
      existingIssue,
      {
        ...existingIssue,
        file: "src/new-file.ts",
        ruleId: "example/new-rule",
      },
    ]);

    expect(baselineRegressions(candidate, base)).toEqual([
      "filesWithIssues increased from 1 to 2",
      "errors increased from 1 to 2",
      "src/new-file.ts: example/new-rule added 1 occurrence(s)",
    ]);
  });

  it("allows a candidate baseline that only removes debt", () => {
    const base = snapshot([{ ...existingIssue, count: 2 }]);
    const candidate = snapshot([existingIssue]);

    expect(baselineRegressions(candidate, base)).toEqual([]);
  });

  it("rejects ESLint contract drift even when issue totals fall", () => {
    const base = snapshot([{ ...existingIssue, count: 2 }]);
    const candidate = snapshot([existingIssue]);
    candidate.lintContractHash = "b".repeat(64);

    expect(baselineRegressions(candidate, base)).toEqual([
      "lintContractHash changed; ESLint configuration or lint dependencies drifted",
    ]);
  });

  it("rejects judge contract drift even when issue totals fall", () => {
    const base = snapshot([{ ...existingIssue, count: 2 }]);
    const candidate = snapshot([existingIssue]);
    candidate.judgeContractHash = "c".repeat(64);

    expect(baselineRegressions(candidate, base)).toEqual([
      "judgeContractHash changed; the ratchet implementation or invocation drifted",
    ]);
  });

  it("rejects new or modified tracked code that ESLint ignores", () => {
    const base = snapshot([existingIssue]);
    base.ignoredCodeFiles = [
      { file: "build/legacy.ts", contentHash: "d".repeat(64) },
    ];
    const candidate = snapshot([existingIssue]);
    candidate.ignoredCodeFiles = [
      { file: "build/legacy.ts", contentHash: "e".repeat(64) },
      { file: "build/new.ts", contentHash: "f".repeat(64) },
    ];

    expect(baselineRegressions(candidate, base)).toEqual([
      "build/legacy.ts: tracked ESLint-ignored code changed",
      "build/new.ts: newly tracked code is ignored by ESLint",
    ]);
  });

  it("rejects baseline totals that hide issue inventory debt", () => {
    const invalid = snapshot([existingIssue]);
    invalid.totals.errors = 0;

    expect(() => assertRatchetSnapshot(invalid)).toThrow(
      "ESLint ratchet totals do not match the issue inventory.",
    );
  });

  it("rejects duplicate issue identities", () => {
    const invalid = snapshot([existingIssue, existingIssue]);

    expect(() => assertRatchetSnapshot(invalid)).toThrow(
      "Duplicate ESLint ratchet issue entry.",
    );
  });
});
