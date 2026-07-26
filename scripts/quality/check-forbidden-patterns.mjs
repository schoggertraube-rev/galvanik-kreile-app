import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function changedFiles(base, head) {
  const stdout = execFileSync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMR", base, head],
    { encoding: "utf8" },
  );
  return stdout
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
}

function readLines(filePath) {
  const absolutePath = path.resolve(filePath);
  if (!existsSync(absolutePath)) return [];
  return readFileSync(absolutePath, "utf8").split(/\r?\n/);
}

function isTestOnlyPath(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  return (
    /(^|\/)(__tests__|__mocks__|mocks?)\//.test(normalized) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(normalized)
  );
}

function isProductionPath(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  if (!/^(src|supabase\/functions)\//.test(normalized)) return false;
  if (isTestOnlyPath(filePath)) return false;
  if (/\.(bak|disabled)$/.test(normalized)) return false;
  return true;
}

function isClientFacingPath(filePath, lines) {
  const normalized = filePath.replaceAll("\\", "/");
  if (isTestOnlyPath(filePath)) return false;
  if (/^src\/components\//.test(normalized)) return true;
  if (/^src\/app\/.+\.(tsx|jsx)$/.test(normalized)) return true;
  if (normalized.toLowerCase().includes("dto")) return true;
  return lines.some((line) => /^\s*["']use client["']/.test(line));
}

function addViolations(violations, filePath, lines, predicate, message) {
  lines.forEach((line, index) => {
    if (!predicate(line)) return;
    violations.push(`${filePath}:${index + 1} ${message}`);
  });
}

const args = parseArgs(process.argv.slice(2));

if (!args.base || !args.head) {
  console.error("Usage: node scripts/quality/check-forbidden-patterns.mjs --base <sha> --head <sha>");
  process.exit(1);
}

const files = changedFiles(args.base, args.head);
if (files.length === 0) {
  console.log("No changed files to inspect.");
  process.exit(0);
}

const violations = [];
const privateBuckets = [
  "attachments",
  "belege",
  "customer-images",
  "intake-photos",
  "item-photos",
  "scans",
];

for (const filePath of files) {
  const normalizedPath = filePath.replaceAll("\\", "/");
  if (normalizedPath === "scripts/quality/check-forbidden-patterns.mjs") {
    continue;
  }

  const lines = readLines(filePath);
  const content = lines.join("\n");
  const productionPath = isProductionPath(filePath);
  const clientFacingPath = isClientFacingPath(filePath, lines);
  const containsPrivateBucket = privateBuckets.some((bucket) =>
    content.includes(`from("${bucket}")`) || content.includes(`from('${bucket}')`)
  );

  addViolations(
    violations,
    filePath,
    lines,
    (line) => line.includes("FOR ALL TO public USING (true)"),
    "forbidden prototype RLS policy",
  );

  if (containsPrivateBucket) {
    addViolations(
      violations,
      filePath,
      lines,
      (line) => line.includes("getPublicUrl("),
      "forbidden getPublicUrl on private file bucket",
    );
  }

  if (clientFacingPath) {
    addViolations(
      violations,
      filePath,
      lines,
      (line) => /\bpinHash\b/.test(line),
      "forbidden pinHash handoff to client-facing code",
    );
    addViolations(
      violations,
      filePath,
      lines,
      (line) => line.includes("SUPABASE_SERVICE_ROLE_KEY"),
      "forbidden service-role key reference in client-facing code",
    );
  }

  if (productionPath) {
    addViolations(
      violations,
      filePath,
      lines,
      (line) => line.includes("Math.random("),
      "forbidden Math.random in production path",
    );
    addViolations(
      violations,
      filePath,
      lines,
      (line) => /\b(mock|fake|dummy)\b.*\b\d{2,}\b/i.test(line),
      "forbidden mock or fake numeric value in production path",
    );
  }
}

if (violations.length > 0) {
  console.error("Forbidden patterns detected:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(`Forbidden pattern gate passed for ${files.length} changed file(s).`);
