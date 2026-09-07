import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";
import {
  assertRatchetSnapshot,
  baselineRegressions,
  compareSnapshots,
  computeLintContractHash,
  formatIssue,
  judgeInvocationContract,
  snapshotFromLintResults,
  type IgnoredCodeFile,
  type RatchetSnapshot,
} from "./eslint-ratchet-core";

const BASELINE_PATH = "quality/eslint-baseline.json";
const MAX_DISPLAYED_DIFFERENCES = 25;

type Args = {
  base?: string;
  baseBaseline?: string;
  config?: string;
  root?: string;
  update: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { update: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--update") {
      args.update = true;
      continue;
    }
    if (token === "--base") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--base requires a Git revision.");
      }
      args.base = value;
      index += 1;
      continue;
    }
    if (token === "--base-baseline" || token === "--config" || token === "--root") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${token} requires a path.`);
      }
      if (token === "--base-baseline") args.baseBaseline = value;
      if (token === "--config") args.config = value;
      if (token === "--root") args.root = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function parseSnapshot(raw: string, source: string): RatchetSnapshot {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Cannot parse ESLint ratchet baseline from ${source}.`, {
      cause: error,
    });
  }
  assertRatchetSnapshot(value);
  return value;
}

function readWorkingBaseline(root: string): RatchetSnapshot {
  const baselinePath = path.join(root, BASELINE_PATH);
  if (!existsSync(baselinePath)) {
    throw new Error(
      `Missing ${BASELINE_PATH}. Run npm run lint:ratchet:update and commit the result.`,
    );
  }
  return parseSnapshot(readFileSync(baselinePath, "utf8"), BASELINE_PATH);
}

function readBaseBaseline(root: string, base: string): RatchetSnapshot | null {
  try {
    const raw = execFileSync("git", ["-C", root, "show", `${base}:${BASELINE_PATH}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return parseSnapshot(raw, `${base}:${BASELINE_PATH}`);
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error
        ? String(error.stderr)
        : "";
    if (stderr.includes("does not exist in") || stderr.includes("exists on disk, but not in")) {
      return null;
    }
    throw error;
  }
}

function readBaselineFile(filePath: string): RatchetSnapshot {
  return parseSnapshot(readFileSync(filePath, "utf8"), filePath);
}

// D-QA-001: a contract migration is allowed but never silent — it is announced so the
// reviewer sees that eslint.config.mjs / lint dependencies / the judge changed in this PR.
function noteContractMigration(candidate: RatchetSnapshot, base: RatchetSnapshot): void {
  const notes: string[] = [];
  if (candidate.eslintVersion !== base.eslintVersion) notes.push(`eslintVersion ${base.eslintVersion} -> ${candidate.eslintVersion}`);
  if (candidate.lintContractHash !== base.lintContractHash) notes.push("lintContractHash (eslint.config.mjs or lint dependencies)");
  if (candidate.judgeContractHash !== base.judgeContractHash) notes.push("judgeContractHash (ratchet scripts/workflows)");
  if (notes.length > 0) {
    console.log(`NOTICE ratchet contract migration in this candidate (reviewed change expected): ${notes.join("; ")}. Debt is judged with the BASE config.`);
  }
}

function printDifferences(label: string, issues: ReturnType<typeof compareSnapshots>["regressions"]): void {
  console.error(label);
  for (const issue of issues.slice(0, MAX_DISPLAYED_DIFFERENCES)) {
    console.error(`- ${formatIssue(issue)}`);
  }
  if (issues.length > MAX_DISPLAYED_DIFFERENCES) {
    console.error(`- ... ${issues.length - MAX_DISPLAYED_DIFFERENCES} more`);
  }
}

// quality.yml materialises the base revision's eslint.config.mjs under this name inside the
// workspace (bare-specifier imports must resolve). It is a judge artefact, never measured.
const JUDGE_CONFIG_COPY = "eslint.config.ratchet-base.mjs";

async function collectSnapshot(root: string, config?: string): Promise<RatchetSnapshot> {
  const eslint = new ESLint({
    cwd: root,
    ...(config ? { overrideConfigFile: config } : {}),
    overrideConfig: [{ ignores: [JUDGE_CONFIG_COPY] }],
  });
  const results = await eslint.lintFiles(["."]);
  const ignoredCodeFiles = await collectIgnoredCodeFiles(root, eslint);
  return snapshotFromLintResults(
    results,
    root,
    ESLint.version,
    lintContractHash(root),
    judgeContractHash(root),
    ignoredCodeFiles,
  );
}

async function collectIgnoredCodeFiles(root: string, eslint: ESLint): Promise<IgnoredCodeFile[]> {
  const raw = execFileSync(
    "git",
    [
      "-C",
      root,
      "ls-files",
      "-z",
      "--",
      "*.js",
      "*.jsx",
      "*.mjs",
      "*.cjs",
      "*.ts",
      "*.tsx",
      "*.mts",
      "*.cts",
    ],
    { encoding: "utf8" },
  );
  const files = raw.split("\0").filter(Boolean).sort();
  const ignored = await Promise.all(
    files.map(async (file): Promise<IgnoredCodeFile | null> => {
      const absolutePath = path.join(root, file);
      if (!(await eslint.isPathIgnored(absolutePath))) return null;
      const stat = lstatSync(absolutePath);
      const content = stat.isSymbolicLink()
        ? `symlink:${readlinkSync(absolutePath)}`
        : readFileSync(absolutePath);
      return {
        file: file.replaceAll("\\", "/"),
        contentHash: createHash("sha256").update(content).digest("hex"),
      };
    }),
  );
  return ignored.filter((entry): entry is IgnoredCodeFile => entry !== null);
}

function ignoredInventoryMatches(
  left: RatchetSnapshot["ignoredCodeFiles"],
  right: RatchetSnapshot["ignoredCodeFiles"],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function lintContractHash(root: string): string {
  const config = readFileSync(path.join(root, "eslint.config.mjs"), "utf8");
  const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
  return computeLintContractHash(config, lock);
}

function judgeContractHash(root: string): string {
  const judgeFiles = [
    ".github/workflows/eslint-ratchet.yml",
    ".github/workflows/quality.yml",
    "scripts/quality/check-eslint-ratchet.ts",
    "scripts/quality/eslint-ratchet-core.ts",
  ];
  const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
    engines?: { node?: string };
  };
  const invocation = judgeInvocationContract(packageJson);
  const hash = createHash("sha256");
  for (const file of judgeFiles) {
    hash.update(file).update("\0");
    hash.update(readFileSync(path.join(root, file), "utf8")).update("\0");
  }
  return hash.update(JSON.stringify(invocation)).digest("hex");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.base && args.baseBaseline) {
    throw new Error("Use either --base or --base-baseline, not both.");
  }
  const root = path.resolve(args.root ?? process.cwd());
  // `current` = the candidate linted with its OWN config (consistency with the committed
  // candidate baseline). `--config` names the JUDGE config (the base revision's
  // eslint.config.mjs in CI): the candidate is linted with it a second time and that
  // snapshot is what the base comparison uses, so a config change can never lower debt
  // (D-QA-001). Without `--config` the judge is the candidate's own config.
  const judgeConfig = args.config ? path.resolve(args.config) : undefined;
  const current = await collectSnapshot(root);
  const judge = judgeConfig ? await collectSnapshot(root, judgeConfig) : current;
  const baselinePath = path.join(root, BASELINE_PATH);

  if (args.update) {
    mkdirSync(path.dirname(baselinePath), { recursive: true });
    writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
    console.log(
      `Updated ${BASELINE_PATH}: ${current.totals.errors} errors, ${current.totals.warnings} warnings in ${current.totals.filesWithIssues} files.`,
    );
    return;
  }

  const candidate = readWorkingBaseline(root);
  if (candidate.eslintVersion !== current.eslintVersion) {
    console.error(
      `ESLint version drifted from ${candidate.eslintVersion} to ${current.eslintVersion}; refresh the baseline with npm run lint:ratchet:update.`,
    );
    process.exitCode = 1;
    return;
  }
  if (candidate.lintContractHash !== current.lintContractHash) {
    console.error(
      "ESLint configuration or lint dependencies drifted; the ratchet contract requires an explicit reviewed migration.",
    );
    process.exitCode = 1;
    return;
  }
  if (candidate.judgeContractHash !== current.judgeContractHash) {
    console.error(
      "The ratchet implementation or invocation drifted; a protected judge-contract migration is required.",
    );
    process.exitCode = 1;
    return;
  }
  if (!ignoredInventoryMatches(candidate.ignoredCodeFiles, current.ignoredCodeFiles)) {
    console.error(
      "Tracked ESLint-ignored code changed; refresh the baseline only when ignored code was removed or moved into a linted path.",
    );
    process.exitCode = 1;
    return;
  }
  const currentDifference = compareSnapshots(current, candidate);
  if (currentDifference.regressions.length > 0) {
    printDifferences("New ESLint debt is not allowed:", currentDifference.regressions);
    process.exitCode = 1;
    return;
  }
  if (currentDifference.improvements.length > 0) {
    printDifferences(
      "ESLint debt was reduced; refresh and commit the lower baseline with npm run lint:ratchet:update:",
      currentDifference.improvements,
    );
    process.exitCode = 1;
    return;
  }

  if (args.base) {
    const base = readBaseBaseline(root, args.base);
    if (base) {
      noteContractMigration(candidate, base);
      const violations = baselineRegressions(candidate, base, judge);
      if (violations.length > 0) {
        console.error("The committed ESLint baseline regresses relative to the base revision:");
        for (const violation of violations.slice(0, MAX_DISPLAYED_DIFFERENCES)) {
          console.error(`- ${violation}`);
        }
        if (violations.length > MAX_DISPLAYED_DIFFERENCES) {
          console.error(`- ... ${violations.length - MAX_DISPLAYED_DIFFERENCES} more`);
        }
        process.exitCode = 1;
        return;
      }
    } else {
      console.log(`Initializing ESLint ratchet; ${args.base} has no ${BASELINE_PATH}.`);
    }
  }
  if (args.baseBaseline) {
    const base = readBaselineFile(path.resolve(args.baseBaseline));
    noteContractMigration(candidate, base);
    const violations = baselineRegressions(candidate, base, judge);
    if (violations.length > 0) {
      console.error("The committed ESLint baseline regresses relative to the protected base:");
      for (const violation of violations.slice(0, MAX_DISPLAYED_DIFFERENCES)) {
        console.error(`- ${violation}`);
      }
      if (violations.length > MAX_DISPLAYED_DIFFERENCES) {
        console.error(`- ... ${violations.length - MAX_DISPLAYED_DIFFERENCES} more`);
      }
      process.exitCode = 1;
      return;
    }
  }

  console.log(
    `ESLint ratchet passed: ${candidate.totals.errors} errors, ${candidate.totals.warnings} warnings in ${candidate.totals.filesWithIssues} files; no increase allowed.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
