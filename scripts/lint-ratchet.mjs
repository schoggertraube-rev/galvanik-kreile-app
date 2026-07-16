import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const baselinePath = path.join(repositoryRoot, "eslint-ratchet-baseline.json");
const updateBaseline = process.argv.includes("--update-baseline");

function messageKey(message) {
  const severity = message.severity === 2 ? "error" : "warning";
  const rule = message.ruleId ?? (message.fatal ? "<fatal>" : "<unclassified>");
  return `${severity}:${rule}`;
}

function summarize(results) {
  const entries = {};
  let errors = 0;
  let warnings = 0;

  for (const result of results) {
    const relativePath = path
      .relative(repositoryRoot, result.filePath)
      .split(path.sep)
      .join("/");

    for (const message of result.messages) {
      if (message.severity !== 1 && message.severity !== 2) {
        continue;
      }

      const key = messageKey(message);
      entries[relativePath] ??= {};
      entries[relativePath][key] = (entries[relativePath][key] ?? 0) + 1;

      if (message.severity === 2) {
        errors += 1;
      } else {
        warnings += 1;
      }
    }
  }

  const sortedEntries = Object.fromEntries(
    Object.entries(entries)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([file, counts]) => [
        file,
        Object.fromEntries(
          Object.entries(counts).sort(([left], [right]) =>
            left.localeCompare(right),
          ),
        ),
      ]),
  );

  return { entries: sortedEntries, errors, warnings };
}

const eslint = new ESLint({ cwd: repositoryRoot });
const current = summarize(await eslint.lintFiles(["."]));

if (updateBaseline) {
  const baseline = {
    version: 1,
    purpose:
      "Known ESLint debt ceiling. New file/rule/severity violations fail; reductions are allowed.",
    entries: current.entries,
  };

  await writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
  console.log(
    `Updated ESLint ratchet baseline: ${current.errors} error(s), ${current.warnings} warning(s).`,
  );
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(await readFile(baselinePath, "utf8"));
} catch (error) {
  console.error(
    `Cannot read ESLint ratchet baseline at ${baselinePath}: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

if (baseline.version !== 1 || typeof baseline.entries !== "object") {
  console.error("Unsupported or malformed ESLint ratchet baseline.");
  process.exit(1);
}

const regressions = [];
for (const [file, counts] of Object.entries(current.entries)) {
  for (const [key, count] of Object.entries(counts)) {
    const allowed = baseline.entries[file]?.[key] ?? 0;
    if (count > allowed) {
      regressions.push({ file, key, added: count - allowed, current: count, allowed });
    }
  }
}

if (regressions.length > 0) {
  console.error("ESLint ratchet failed. New lint debt was introduced:");
  for (const regression of regressions) {
    console.error(
      ` - ${regression.file}: ${regression.key} +${regression.added} (current ${regression.current}, allowed ${regression.allowed})`,
    );
  }
  console.error(
    "Fix the regressions. Update the baseline only when an explicit debt-ceiling change is reviewed.",
  );
  process.exit(1);
}

console.log(
  `ESLint ratchet passed: ${current.errors} error(s), ${current.warnings} warning(s); no file/rule/severity ceiling increased.`,
);
