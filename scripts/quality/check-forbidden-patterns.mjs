import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

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

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    return statSync(absolute).isDirectory() ? walkFiles(absolute) : [absolute];
  });
}

function isTestPath(filePath) {
  const normalized = normalizePath(filePath);
  return /(^|\/)(__tests__|__mocks__|mocks?)\//.test(normalized)
    || /\.(test|spec)\.[cm]?[jt]sx?$/.test(normalized)
    || /(?:fixture|fixtures)\//.test(normalized);
}

function loadSourceFiles() {
  return walkFiles(path.resolve("src"))
    .filter((absolute) => /\.[cm]?[jt]sx?$/.test(absolute))
    .map((absolute) => ({
      filePath: normalizePath(path.relative(process.cwd(), absolute)),
      content: readFileSync(absolute, "utf8"),
    }));
}

function resolveImportPath(sourceFilePath, moduleName, sourceMap) {
  let base;
  if (moduleName.startsWith("@/")) {
    base = path.resolve("src", moduleName.slice(2));
  } else if (moduleName.startsWith(".")) {
    base = path.resolve(path.dirname(sourceFilePath), moduleName);
  } else {
    return null;
  }

  const candidates = [
    base,
    ...[".ts", ".tsx", ".js", ".jsx"].map((extension) => `${base}${extension}`),
    ...[".ts", ".tsx", ".js", ".jsx"].map((extension) => path.join(base, `index${extension}`)),
  ];
  for (const candidate of candidates) {
    const relative = normalizePath(path.relative(process.cwd(), candidate));
    if (sourceMap.has(relative)) return relative;
  }
  return null;
}

function hasUseClientDirective(sourceFile) {
  return sourceFile.statements.some(
    (statement) => ts.isExpressionStatement(statement)
      && ts.isStringLiteral(statement.expression)
      && statement.expression.text === "use client",
  );
}

function hasUseServerDirective(sourceFile) {
  return sourceFile.statements.some(
    (statement) => ts.isExpressionStatement(statement)
      && ts.isStringLiteral(statement.expression)
      && statement.expression.text === "use server",
  );
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return null;
}

function containsPinHashObjectProperty(node) {
  let found = false;
  const visit = (child) => {
    if (ts.isPropertyAssignment(child) || ts.isShorthandPropertyAssignment(child)) {
      if (propertyName(child.name) === "pinHash") found = true;
    }
    if (!found) ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

/**
 * Detects serialization boundaries rather than matching the word "pinHash".
 * Type declarations and test fixtures are intentionally not inspected: only a
 * concrete prop object passed to a client module or a server payload return is
 * an application-to-client handoff.
 */
export function findPinHashBoundaryViolations(allSources, candidatePaths) {
  const sourceMap = new Map(allSources.map((source) => [normalizePath(source.filePath), source]));
  const parsed = new Map(allSources.map((source) => [
    normalizePath(source.filePath),
    ts.createSourceFile(source.filePath, source.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
  ]));
  const clientModules = new Set(
    [...parsed.entries()]
      .filter(([, sourceFile]) => hasUseClientDirective(sourceFile))
      .map(([filePath]) => filePath),
  );
  const violations = [];

  for (const candidatePath of candidatePaths.map(normalizePath)) {
    const source = sourceMap.get(candidatePath);
    const sourceFile = parsed.get(candidatePath);
    if (!source || !sourceFile || isTestPath(candidatePath)) continue;

    const importedClientBindings = new Set();
    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const target = resolveImportPath(path.resolve(candidatePath), statement.moduleSpecifier.text, sourceMap);
      if (!target || !clientModules.has(target) || !statement.importClause) continue;
      if (statement.importClause.name) importedClientBindings.add(statement.importClause.name.text);
      const bindings = statement.importClause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) importedClientBindings.add(element.name.text);
      }
    }

    const isServerPayloadModule = hasUseServerDirective(sourceFile) || /(?:\.actions|actions)\.[cm]?[jt]sx?$/.test(candidatePath);
    const visit = (node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tagName = ts.isIdentifier(node.tagName) ? node.tagName.text : null;
        if (tagName && importedClientBindings.has(tagName)) {
          for (const attribute of node.attributes.properties) {
            if (ts.isJsxAttribute(attribute) && propertyName(attribute.name) === "pinHash") {
              const position = sourceFile.getLineAndCharacterOfPosition(attribute.getStart(sourceFile));
              violations.push(`${candidatePath}:${position.line + 1} PIN hash is passed directly to client component ${tagName}`);
            }
            if (ts.isJsxAttribute(attribute) && attribute.initializer && ts.isJsxExpression(attribute.initializer)
              && attribute.initializer.expression && containsPinHashObjectProperty(attribute.initializer.expression)) {
              const position = sourceFile.getLineAndCharacterOfPosition(attribute.getStart(sourceFile));
              violations.push(`${candidatePath}:${position.line + 1} PIN hash object is passed to client component ${tagName}`);
            }
          }
        }
      }
      if (isServerPayloadModule && ts.isReturnStatement(node) && node.expression && containsPinHashObjectProperty(node.expression)) {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        violations.push(`${candidatePath}:${position.line + 1} PIN hash is returned from a server payload`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  return violations;
}

function runPinHashBoundarySelfTest() {
  const sources = [
    { filePath: "src/components/ClientScreen.tsx", content: '"use client"; export function ClientScreen() { return null; }' },
    { filePath: "src/lib/auth/types.ts", content: "export type StoredUser = { pinHash: string };" },
    { filePath: "src/app/page.tsx", content: 'import { ClientScreen } from "@/components/ClientScreen"; export default function Page() { return <ClientScreen payload={{ pinHash: "hash" }} />; }' },
    { filePath: "src/app/actions/example.actions.ts", content: '"use server"; export async function example() { return { pinHash: "hash" }; }' },
    { filePath: "src/app/__tests__/fixture.test.tsx", content: 'import { ClientScreen } from "@/components/ClientScreen"; export const fixture = <ClientScreen payload={{ pinHash: "fixture" }} />;' },
  ];
  const violations = findPinHashBoundaryViolations(sources, sources.map((source) => source.filePath));
  if (violations.length !== 2 || !violations.some((violation) => violation.includes("client component")) || !violations.some((violation) => violation.includes("server payload"))) {
    throw new Error(`PIN boundary self-test failed: ${JSON.stringify(violations)}`);
  }
  console.log("PIN client-boundary self-test passed (real props and server payloads fail; types and fixtures do not).");
}

function isProductionPath(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  if (!/^(src|supabase\/functions)\//.test(normalized)) return false;
  if (/(^|\/)(__tests__|__mocks__|mocks?)\//.test(normalized)) return false;
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(normalized)) return false;
  if (/\.(bak|disabled)$/.test(normalized)) return false;
  return true;
}

function isClientFacingPath(filePath, lines) {
  const normalized = filePath.replaceAll("\\", "/");
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

if (args["self-test"]) {
  runPinHashBoundarySelfTest();
  process.exit(0);
}

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
const allSources = loadSourceFiles();
const pinHashBoundaryViolations = findPinHashBoundaryViolations(allSources, files);

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

violations.push(...pinHashBoundaryViolations);

if (violations.length > 0) {
  console.error("Forbidden patterns detected:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(`Forbidden pattern gate passed for ${files.length} changed file(s).`);
