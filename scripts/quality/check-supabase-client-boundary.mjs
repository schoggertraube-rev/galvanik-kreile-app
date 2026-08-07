import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Enforces that createClient(...) from "@supabase/supabase-js" is only ever
// called inside src/lib/supabase/ (the canonical client factories, e.g.
// createAdminClient() in src/lib/supabase/admin.ts). Every other file under
// src/ must import a factory from '@/lib/supabase/*' instead of constructing
// its own ad-hoc client. This keeps the service-role key confined to one
// audited module boundary.
//
// The check resolves imports precisely (named import with optional alias,
// namespace import, or a per-specifier/whole-statement `type` import) so
// that type-only imports such as `import { RealtimeChannel } from
// "@supabase/supabase-js"` are never mistaken for a runtime createClient
// binding.

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const EXCLUDED_DIR = path.join(SRC_DIR, "lib", "supabase");
function collectSourceFiles(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (fullPath === EXCLUDED_DIR) continue;
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, files);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

// Returns local bindings that createClient from "@supabase/supabase-js" is
// reachable through in this file: { kind: "named", name } for
// `import { createClient [as X] }` or { kind: "namespace", name } for
// `import * as ns`. Type-only imports (whole statement or per-specifier)
// are skipped since they carry no runtime value and cannot be called.
function findCreateClientImports(content) {
  const bindings = [];
  const importRegex =
    /import\s+(type\s+)?([^;]+?)\s+from\s+["']@supabase\/supabase-js["']/gs;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const isTypeOnlyImport = Boolean(match[1]);
    if (isTypeOnlyImport) continue;
    const clause = match[2].trim();

    const namespaceMatch = clause.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/);
    if (namespaceMatch) {
      bindings.push({ kind: "namespace", name: namespaceMatch[1] });
      continue;
    }

    const namedMatch = clause.match(/\{([\s\S]*)\}/);
    if (!namedMatch) continue;

    const specifiers = namedMatch[1]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    for (const specifier of specifiers) {
      if (/^type\s+/.test(specifier)) continue;
      const parts = specifier.split(/\s+as\s+/).map((part) => part.trim());
      const originalName = parts[0];
      const localName = parts[1] || parts[0];
      if (originalName === "createClient") {
        bindings.push({ kind: "named", name: localName });
      }
    }
  }
  return bindings;
}

function findViolations(filePath, content) {
  const bindings = findCreateClientImports(content);
  if (bindings.length === 0) return [];

  const violations = [];
  for (const binding of bindings) {
    // Negative lookbehind on the named form excludes unrelated
    // `obj.createClient(` member calls; the namespace form requires the
    // dot explicitly since that IS the call shape for `import * as ns`.
    const callRegex =
      binding.kind === "namespace"
        ? new RegExp(`\\b${binding.name}\\.createClient\\s*\\(`, "g")
        : new RegExp(`(?<!\\.)\\b${binding.name}\\s*\\(`, "g");
    let callMatch;
    while ((callMatch = callRegex.exec(content)) !== null) {
      violations.push({
        file: path.relative(ROOT, filePath).split(path.sep).join("/"),
        line: lineNumberAt(content, callMatch.index),
        binding: binding.name,
      });
    }
  }
  return violations;
}

const files = collectSourceFiles(SRC_DIR);
const violations = [];

for (const filePath of files) {
  const content = readFileSync(filePath, "utf8");
  violations.push(...findViolations(filePath, content));
}

if (violations.length > 0) {
  console.error("Supabase client boundary violations detected:");
  console.error(
    "createClient() from '@supabase/supabase-js' may only be called inside " +
      "src/lib/supabase/. Use createAdminClient() from '@/lib/supabase/admin' " +
      "(or another canonical factory in that directory) instead."
  );
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} (via '${violation.binding}')`);
  }
  process.exit(1);
}

console.log(`boundary ok (${files.length} file(s) scanned under src/, excluding src/lib/supabase/)`);
process.exit(0);
