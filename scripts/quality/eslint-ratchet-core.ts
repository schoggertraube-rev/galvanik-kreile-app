import { createHash } from "node:crypto";
import path from "node:path";

export const ESLINT_RATCHET_SCHEMA_VERSION = 1 as const;
export const LINT_DEPENDENCY_ROOTS = [
  "eslint",
  "eslint-config-next",
  "typescript",
  "tsx",
  "next",
  "react",
] as const;

export type LockPackageMetadata = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
};

export type PackageLockLike = {
  packages?: Record<string, LockPackageMetadata>;
};

export type ProjectedLockPackage = {
  packagePath: string;
  metadata: LockPackageMetadata;
};

export type RatchetIssue = {
  file: string;
  ruleId: string | null;
  severity: number;
  messageId: string | null;
  message: string;
  count: number;
};

export type IgnoredCodeFile = {
  file: string;
  contentHash: string;
};

export type RatchetSnapshot = {
  schemaVersion: typeof ESLINT_RATCHET_SCHEMA_VERSION;
  eslintVersion: string;
  lintContractHash: string;
  judgeContractHash: string;
  totals: {
    filesWithIssues: number;
    errors: number;
    warnings: number;
  };
  issues: RatchetIssue[];
  ignoredCodeFiles: IgnoredCodeFile[];
};

type IssueWithoutCount = Omit<RatchetIssue, "count">;

export type SnapshotDifference = {
  regressions: RatchetIssue[];
  improvements: RatchetIssue[];
};

export type LintResultLike = {
  filePath: string;
  errorCount: number;
  warningCount: number;
  messages: ReadonlyArray<{
    ruleId: string | null;
    severity: number;
    messageId?: string;
    message: string;
  }>;
};

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function issueKey(issue: IssueWithoutCount): string {
  return JSON.stringify([
    issue.file,
    issue.ruleId,
    issue.severity,
    issue.messageId,
    issue.message,
  ]);
}

function compareIssues(left: RatchetIssue, right: RatchetIssue): number {
  return compareText(issueKey(left), issueKey(right));
}

function isWindowsPath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("\\\\");
}

function normalizeFilePath(filePath: string, cwd: string): string {
  const pathApi = isWindowsPath(filePath) || isWindowsPath(cwd) ? path.win32 : path.posix;
  return pathApi
    .relative(pathApi.resolve(cwd), pathApi.resolve(filePath))
    .replaceAll("\\", "/");
}

function normalizeMessage(message: string, cwd: string): string {
  const absoluteRoot = path.resolve(cwd);
  const rootVariants = new Set([
    cwd,
    absoluteRoot,
    cwd.replaceAll("\\", "/"),
    absoluteRoot.replaceAll("\\", "/"),
    cwd.replaceAll("/", "\\"),
    absoluteRoot.replaceAll("/", "\\"),
  ]);
  return [...rootVariants]
    .filter((root) => root.length > 1)
    .sort((left, right) => right.length - left.length)
    .reduce((normalized, root) => normalized.replaceAll(root, "<repo>"), message)
    .replaceAll("\\", "/");
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, entry]) => [key, canonicalizeJson(entry)]),
    );
  }
  return value;
}

export function stableJsonStringify(value: unknown): string {
  return JSON.stringify(canonicalizeJson(value));
}

function parentPackagePath(packagePath: string): string | null {
  if (packagePath.length === 0) return null;
  const parts = packagePath.split("/");
  const lastNodeModules = parts.lastIndexOf("node_modules");
  if (lastNodeModules <= 0) return "";
  return parts.slice(0, lastNodeModules).join("/");
}

function resolvePackagePath(
  packages: Record<string, LockPackageMetadata>,
  fromPackagePath: string,
  dependencyName: string,
): string | null {
  let ancestor: string | null = fromPackagePath;
  while (ancestor !== null) {
    const candidate = ancestor.length > 0
      ? `${ancestor}/node_modules/${dependencyName}`
      : `node_modules/${dependencyName}`;
    if (packages[candidate]) return candidate;
    ancestor = parentPackagePath(ancestor);
  }
  return null;
}

export function projectDependencyClosure(
  packages: Record<string, LockPackageMetadata>,
  rootNames: readonly string[] = LINT_DEPENDENCY_ROOTS,
): ProjectedLockPackage[] {
  const queue = rootNames.map((name) => {
    const packagePath = `node_modules/${name}`;
    if (!packages[packagePath]) {
      throw new Error(`package-lock.json is missing lint dependency root ${packagePath}.`);
    }
    return packagePath;
  });
  const visited = new Set<string>();

  while (queue.length > 0) {
    const packagePath = queue.shift();
    if (!packagePath || visited.has(packagePath)) continue;
    const metadata = packages[packagePath];
    if (!metadata) {
      throw new Error(`package-lock.json is missing required package ${packagePath}.`);
    }
    visited.add(packagePath);

    const dependencyGroups = [
      { dependencies: metadata.dependencies ?? {}, required: true },
      { dependencies: metadata.optionalDependencies ?? {}, required: false },
      { dependencies: metadata.peerDependencies ?? {}, required: false },
    ];
    for (const group of dependencyGroups) {
      for (const dependencyName of Object.keys(group.dependencies).sort(compareText)) {
        const resolved = resolvePackagePath(packages, packagePath, dependencyName);
        if (resolved) {
          if (!visited.has(resolved)) queue.push(resolved);
        } else if (group.required) {
          throw new Error(
            `package-lock.json cannot resolve ${dependencyName} required by ${packagePath}.`,
          );
        }
      }
    }
  }

  return [...visited]
    .sort(compareText)
    .map((packagePath) => ({ packagePath, metadata: packages[packagePath]! }));
}

export function lintDependencyContract(
  lock: PackageLockLike,
  rootNames: readonly string[] = LINT_DEPENDENCY_ROOTS,
): {
  rootSpecifications: Record<string, Record<string, string | null>>;
  packages: ProjectedLockPackage[];
} {
  const packages = lock.packages;
  if (!packages || !packages[""]) {
    throw new Error("package-lock.json has no packages metadata or root package entry.");
  }
  const root = packages[""];
  const specificationGroups = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ] as const;
  const rootSpecifications = Object.fromEntries(
    [...rootNames].sort(compareText).map((name) => [
      name,
      Object.fromEntries(
        specificationGroups.map((group) => [group, root[group]?.[name] ?? null]),
      ),
    ]),
  );

  return {
    rootSpecifications,
    packages: projectDependencyClosure(packages, rootNames),
  };
}

export function computeLintContractHash(
  config: string,
  lock: PackageLockLike,
  rootNames: readonly string[] = LINT_DEPENDENCY_ROOTS,
): string {
  return createHash("sha256")
    .update(config)
    .update("\0")
    .update(stableJsonStringify(lintDependencyContract(lock, rootNames)))
    .digest("hex");
}

export function judgeInvocationContract(packageJson: {
  scripts?: Record<string, string>;
  engines?: { node?: string };
}): {
  lintRatchet: string | null;
  lintRatchetUpdate: string | null;
  nodeEngine: string | null;
  nodeFallback: "24";
} {
  return {
    lintRatchet: packageJson.scripts?.["lint:ratchet"] ?? null,
    lintRatchetUpdate: packageJson.scripts?.["lint:ratchet:update"] ?? null,
    nodeEngine: packageJson.engines?.node ?? null,
    nodeFallback: "24",
  };
}

export function snapshotFromLintResults(
  results: ReadonlyArray<LintResultLike>,
  cwd: string,
  eslintVersion: string,
  lintContractHash: string,
  judgeContractHash: string,
  ignoredCodeFiles: IgnoredCodeFile[],
): RatchetSnapshot {
  const issuesByKey = new Map<string, RatchetIssue>();
  let filesWithIssues = 0;
  let errors = 0;
  let warnings = 0;

  for (const result of results) {
    if (result.messages.length > 0) filesWithIssues += 1;
    errors += result.errorCount;
    warnings += result.warningCount;

    for (const message of result.messages) {
      const identity: IssueWithoutCount = {
        file: normalizeFilePath(result.filePath, cwd),
        ruleId: message.ruleId ?? null,
        severity: message.severity,
        messageId: message.messageId ?? null,
        message: normalizeMessage(message.message, cwd),
      };
      const key = issueKey(identity);
      const existing = issuesByKey.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        issuesByKey.set(key, { ...identity, count: 1 });
      }
    }
  }

  return {
    schemaVersion: ESLINT_RATCHET_SCHEMA_VERSION,
    eslintVersion,
    lintContractHash,
    judgeContractHash,
    totals: { filesWithIssues, errors, warnings },
    issues: [...issuesByKey.values()].sort(compareIssues),
    ignoredCodeFiles,
  };
}

export function assertRatchetSnapshot(value: unknown): asserts value is RatchetSnapshot {
  if (!value || typeof value !== "object") {
    throw new Error("ESLint ratchet baseline must be an object.");
  }
  const snapshot = value as Partial<RatchetSnapshot>;
  if (snapshot.schemaVersion !== ESLINT_RATCHET_SCHEMA_VERSION) {
    throw new Error(`Unsupported ESLint ratchet schema: ${String(snapshot.schemaVersion)}`);
  }
  if (typeof snapshot.eslintVersion !== "string" || snapshot.eslintVersion.length === 0) {
    throw new Error("ESLint ratchet baseline has no eslintVersion.");
  }
  if (
    typeof snapshot.lintContractHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(snapshot.lintContractHash)
  ) {
    throw new Error("ESLint ratchet baseline has no valid lintContractHash.");
  }
  if (
    typeof snapshot.judgeContractHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(snapshot.judgeContractHash)
  ) {
    throw new Error("ESLint ratchet baseline has no valid judgeContractHash.");
  }
  if (
    !snapshot.totals ||
    !Array.isArray(snapshot.issues) ||
    !Array.isArray(snapshot.ignoredCodeFiles)
  ) {
    throw new Error("ESLint ratchet baseline is incomplete.");
  }
  for (const key of ["filesWithIssues", "errors", "warnings"] as const) {
    if (!Number.isInteger(snapshot.totals[key]) || snapshot.totals[key] < 0) {
      throw new Error(`Invalid ESLint ratchet total: ${key}`);
    }
  }
  const seenIssueKeys = new Set<string>();
  let expectedErrors = 0;
  let expectedWarnings = 0;
  const expectedFiles = new Set<string>();
  for (const issue of snapshot.issues) {
    if (
      typeof issue.file !== "string" ||
      issue.file.length === 0 ||
      (issue.ruleId !== null && typeof issue.ruleId !== "string") ||
      (issue.severity !== 1 && issue.severity !== 2) ||
      (issue.messageId !== null && typeof issue.messageId !== "string") ||
      typeof issue.message !== "string" ||
      !Number.isInteger(issue.count) ||
      issue.count < 1
    ) {
      throw new Error("Invalid ESLint ratchet issue entry.");
    }
    const key = issueKey(issue);
    if (seenIssueKeys.has(key)) {
      throw new Error("Duplicate ESLint ratchet issue entry.");
    }
    seenIssueKeys.add(key);
    expectedFiles.add(issue.file);
    if (issue.severity === 2) expectedErrors += issue.count;
    if (issue.severity === 1) expectedWarnings += issue.count;
  }
  if (
    snapshot.totals.filesWithIssues !== expectedFiles.size ||
    snapshot.totals.errors !== expectedErrors ||
    snapshot.totals.warnings !== expectedWarnings
  ) {
    throw new Error("ESLint ratchet totals do not match the issue inventory.");
  }
  const ignoredPaths = new Set<string>();
  for (const ignored of snapshot.ignoredCodeFiles) {
    if (
      typeof ignored.file !== "string" ||
      ignored.file.length === 0 ||
      typeof ignored.contentHash !== "string" ||
      !/^[a-f0-9]{64}$/.test(ignored.contentHash) ||
      ignoredPaths.has(ignored.file)
    ) {
      throw new Error("Invalid ESLint ignored-code inventory entry.");
    }
    ignoredPaths.add(ignored.file);
  }
}

function countByKey(snapshot: RatchetSnapshot): Map<string, RatchetIssue> {
  return new Map(snapshot.issues.map((issue) => [issueKey(issue), issue]));
}

export function compareSnapshots(
  current: RatchetSnapshot,
  baseline: RatchetSnapshot,
): SnapshotDifference {
  const currentByKey = countByKey(current);
  const baselineByKey = countByKey(baseline);
  const regressions: RatchetIssue[] = [];
  const improvements: RatchetIssue[] = [];
  const keys = new Set([...currentByKey.keys(), ...baselineByKey.keys()]);

  for (const key of keys) {
    const currentIssue = currentByKey.get(key);
    const baselineIssue = baselineByKey.get(key);
    const currentCount = currentIssue?.count ?? 0;
    const baselineCount = baselineIssue?.count ?? 0;
    if (currentCount > baselineCount && currentIssue) {
      regressions.push({ ...currentIssue, count: currentCount - baselineCount });
    }
    if (baselineCount > currentCount && baselineIssue) {
      improvements.push({ ...baselineIssue, count: baselineCount - currentCount });
    }
  }

  return {
    regressions: regressions.sort(compareIssues),
    improvements: improvements.sort(compareIssues),
  };
}

export function baselineRegressions(
  candidate: RatchetSnapshot,
  base: RatchetSnapshot,
): string[] {
  const differences = compareSnapshots(candidate, base);
  const violations: string[] = [];
  // Contract migration (D-QA-001, 2026-09-06): a changed eslintVersion / lintContractHash /
  // judgeContractHash is NOT a base violation any more. Under enforce_admins=true the old
  // rule made every ESLint-rule or judge change unmergeable for anyone (no in-band path;
  // #36/#55 needed owner overrides). The migration stays explicit and reviewable: the
  // candidate baseline MUST carry the hashes of the candidate's own config/judge (checked
  // before this function runs), so a config change is always a visible baseline diff.
  // Debt cannot be hidden by changing the config: both CI runs (quality.yml and the
  // protected eslint-ratchet.yml) lint the candidate with the BASE config and compare the
  // result against the baselines below.
  const baseIgnored = new Map(
    base.ignoredCodeFiles.map((ignored) => [ignored.file, ignored.contentHash]),
  );
  for (const ignored of candidate.ignoredCodeFiles) {
    const baseHash = baseIgnored.get(ignored.file);
    if (baseHash === undefined) {
      violations.push(`${ignored.file}: newly tracked code is ignored by ESLint`);
    } else if (baseHash !== ignored.contentHash) {
      violations.push(`${ignored.file}: tracked ESLint-ignored code changed`);
    }
  }
  for (const key of ["filesWithIssues", "errors", "warnings"] as const) {
    if (candidate.totals[key] > base.totals[key]) {
      violations.push(
        `${key} increased from ${base.totals[key]} to ${candidate.totals[key]}`,
      );
    }
  }
  for (const issue of differences.regressions) {
    violations.push(
      `${issue.file}: ${issue.ruleId ?? "fatal"} added ${issue.count} occurrence(s)`,
    );
  }
  return violations;
}

export function formatIssue(issue: RatchetIssue): string {
  return `${issue.file}: ${issue.ruleId ?? "fatal"} x${issue.count} - ${issue.message}`;
}
