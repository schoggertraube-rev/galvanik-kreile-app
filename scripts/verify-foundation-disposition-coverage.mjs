import { execFileSync } from "node:child_process";

const base = process.env.FOUNDATION_DISPOSITION_BASE ?? "origin/main";
const diffRange = `${base}...HEAD`;
const files = execFileSync("git", ["diff", "--name-only", diffRange], {
  encoding: "utf8",
}).split(/\r?\n/).filter(Boolean);

const exactMerge = new Set([
  "src/app/actions/customers.actions.ts",
  "src/app/actions/orders.actions.ts",
  "src/app/customers/page.tsx",
  "src/app/layout.tsx",
  "src/app/orders/page.tsx",
  "src/lib/auth/PermissionsContext.tsx",
  "src/lib/auth/__tests__/PermissionsContext.test.tsx",
  "src/lib/server/__tests__/devAuthBypass.test.ts",
  "src/lib/server/devAuthBypass.ts",
  "src/proxy.ts",
  "supabase/migrations/20260728124147_foundation_w1_runtime_receipt_columns.sql",
  "vitest.config.ts",
]);

function classify(path) {
  if (exactMerge.has(path)) return ["MERGE", "explicitly tested containment or canonical-contract extraction"];
  if (path.startsWith("docs/foundation/") || path.startsWith("contracts/")) return ["KEEP", "evidence or contract artifact"];
  if (path === "scripts/verify-foundation-disposition-coverage.mjs") return ["KEEP", "coverage verifier"];
  if (path.startsWith("supabase/migrations/")) return ["QUARANTINE", "migration lacks a complete remote proof or rollout approval"];
  if (path.includes("/__tests__/") || /(?:^|\/)__tests__\//.test(path) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)) return ["QUARANTINE", "test is retained until a surviving product contract names it"];
  if (path.startsWith("src/app/") || path.startsWith("src/components/") || path.startsWith("src/contexts/") || path.startsWith("src/features/") || path.startsWith("src/hooks/") || path.startsWith("src/lib/") || path.startsWith("src/db/") || path.startsWith("src/types/")) return ["QUARANTINE", "legacy route, component, action, hook, adapter or model has no individual release proof"];
  if (path.startsWith("scripts/")) return ["QUARANTINE", "legacy operational script has no current runner proof"];
  if (path.startsWith("public/") || path.startsWith("drizzle/") || path.startsWith("supabase/")) return ["QUARANTINE", "asset or database artifact has no individual release proof"];
  if (path.startsWith(".github/") || path.startsWith(".husky/") || /^(?:package(?:-lock)?\.json|tsconfig\.json|next\.config\.|eslint\.|\.gitignore|README)/.test(path)) return ["KEEP", "build or governance artifact"];
  return ["UNKNOWN", "no rule matched; add a specific disposition before any release decision"];
}

const results = files.map((path) => ({ path, ...Object.fromEntries([["result", classify(path)]]) }));
const unknown = results.filter(({ result }) => result[0] === "UNKNOWN");
for (const { path, result } of results) {
  console.log(`${result[0]}\t${path}\t${result[1]}`);
}
if (unknown.length > 0) {
  console.error(`Disposition coverage FAIL: ${unknown.length} path(s) are UNKNOWN in ${diffRange}.`);
  process.exit(1);
}
const counts = results.reduce((acc, { result }) => {
  acc[result[0]] = (acc[result[0]] ?? 0) + 1;
  return acc;
}, {});
console.log(`Disposition coverage PASS: ${files.length} path(s); ${JSON.stringify(counts)}; DELETE_AFTER_PROOF=0.`);
