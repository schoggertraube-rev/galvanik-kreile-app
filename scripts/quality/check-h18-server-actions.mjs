import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import ts from "typescript";

const ROOT = process.cwd();
const MANIFEST_PATH = "scripts/quality/h18-server-actions.json";

function posix(value) {
  return value.split(path.sep).join("/");
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [absolute] : [];
  });
}

function hasModifier(node, kind) {
  return node.modifiers?.some((modifier) => modifier.kind === kind) === true;
}

function isUseServerModule(sourceFile) {
  return sourceFile.statements.some((statement) => ts.isExpressionStatement(statement)
    && ts.isStringLiteral(statement.expression)
    && statement.expression.text === "use server");
}

function inventoryServerActions(sourceRoot = path.join(ROOT, "src")) {
  const actions = [];
  for (const absolute of walk(sourceRoot)) {
    const relative = posix(path.relative(ROOT, absolute));
    if (relative.includes("/test/") || relative.includes("/__tests__/")) continue;
    const source = fs.readFileSync(absolute, "utf8");
    const sourceFile = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true,
      relative.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    if (!isUseServerModule(sourceFile)) continue;
    for (const statement of sourceFile.statements) {
      if (ts.isFunctionDeclaration(statement)
        && statement.name
        && hasModifier(statement, ts.SyntaxKind.ExportKeyword)
        && hasModifier(statement, ts.SyntaxKind.AsyncKeyword)) {
        actions.push(`${relative}#${statement.name.text}`);
      }
      if (ts.isVariableStatement(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
        for (const declaration of statement.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
          const initializer = declaration.initializer;
          if ((ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
            && hasModifier(initializer, ts.SyntaxKind.AsyncKeyword)) {
            actions.push(`${relative}#${declaration.name.text}`);
          }
        }
      }
    }
  }
  return [...new Set(actions)].sort();
}

function actionModuleId(moduleSpecifier, testFile) {
  let resolved;
  if (moduleSpecifier.startsWith("@/")) {
    resolved = path.join(ROOT, "src", moduleSpecifier.slice(2));
  } else if (moduleSpecifier.startsWith(".")) {
    resolved = path.resolve(path.dirname(testFile), moduleSpecifier);
  } else {
    return null;
  }
  for (const suffix of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = `${resolved}${suffix}`;
    if (fs.existsSync(candidate)) return posix(path.relative(ROOT, candidate));
  }
  return null;
}

function importedAndCalledActions(testRelative) {
  const absolute = path.join(ROOT, testRelative);
  const source = fs.readFileSync(absolute, "utf8");
  const sourceFile = ts.createSourceFile(testRelative, source, ts.ScriptTarget.Latest, true,
    testRelative.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const bindings = new Map();
  const called = new Set();

  function bindNamed(binding, moduleSpecifier) {
    const moduleId = actionModuleId(moduleSpecifier, absolute);
    if (!moduleId || !ts.isObjectBindingPattern(binding)) return;
    for (const element of binding.elements) {
      if (!ts.isIdentifier(element.name)) continue;
      const exported = element.propertyName && ts.isIdentifier(element.propertyName)
        ? element.propertyName.text
        : element.name.text;
      bindings.set(element.name.text, `${moduleId}#${exported}`);
    }
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause?.namedBindings;
      if (clause && ts.isNamedImports(clause)) {
        const moduleId = actionModuleId(node.moduleSpecifier.text, absolute);
        if (moduleId) {
          for (const element of clause.elements) {
            bindings.set(element.name.text, `${moduleId}#${element.propertyName?.text ?? element.name.text}`);
          }
        }
      }
    }
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isObjectBindingPattern(node.name)) {
      let expression = node.initializer;
      if (ts.isAwaitExpression(expression)) expression = expression.expression;
      if (ts.isCallExpression(expression)
        && expression.expression.kind === ts.SyntaxKind.ImportKeyword
        && expression.arguments.length === 1
        && ts.isStringLiteral(expression.arguments[0])) {
        bindNamed(node.name, expression.arguments[0].text);
      }
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const action = bindings.get(node.expression.text);
      if (action) called.add(action);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return { called, source };
}

function readManifest() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST_PATH), "utf8"));
}

function classifiedSets(manifest) {
  return {
    tested: new Set(Object.keys(manifest.testedWriteActions ?? {})),
    overrides: new Set(Object.keys(manifest.writeActionOverrides ?? {})),
  };
}

function validateClassification(inventory, manifest) {
  const inventorySet = new Set(inventory);
  const groups = classifiedSets(manifest);
  const errors = [];
  const fingerprint = createHash("sha256").update(`${inventory.join("\n")}\n`).digest("hex");
  if (manifest.inventorySha256 !== fingerprint) {
    errors.push(`H18_SERVER_ACTION_INVENTORY_CHANGED:expected=${manifest.inventorySha256}:actual=${fingerprint}`);
  }
  const seen = new Map();
  for (const [group, values] of Object.entries(groups)) {
    for (const id of values) {
      if (!inventorySet.has(id)) errors.push(`H18_ACTION_NO_LONGER_EXPORTED:${group}:${id}`);
      const previous = seen.get(id);
      if (previous) errors.push(`H18_ACTION_CLASSIFIED_TWICE:${previous}:${group}:${id}`);
      seen.set(id, group);
    }
  }
  return errors;
}

function readBaselineManifest() {
  const candidates = [process.env.GITHUB_BASE_SHA, "origin/main"].filter(Boolean);
  for (const ref of candidates) {
    try {
      const value = execFileSync("git", ["show", `${ref}:${MANIFEST_PATH}`], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      return JSON.parse(value);
    } catch {
      // The first H18.8 introduction has no baseline manifest yet.
    }
  }
  return null;
}

function validateOverrideShrink(manifest, baseline) {
  if (!baseline) return [];
  const allowed = new Set(Object.keys(baseline.writeActionOverrides ?? {}));
  return Object.keys(manifest.writeActionOverrides ?? {})
    .filter((id) => !allowed.has(id))
    .map((id) => `H18_WRITE_OVERRIDE_MAY_ONLY_SHRINK:${id}`);
}

function validateTestProofs(manifest) {
  const errors = [];
  for (const [action, tests] of Object.entries(manifest.testedWriteActions ?? {})) {
    if (!Array.isArray(tests) || tests.length === 0) {
      errors.push(`H18_WRITE_TEST_MISSING:${action}`);
      continue;
    }
    let proved = false;
    for (const testFile of tests) {
      if (!/\.integration\.test\.tsx?$/.test(testFile) || !fs.existsSync(path.join(ROOT, testFile))) {
        errors.push(`H18_WRITE_TEST_FILE_INVALID:${action}:${testFile}`);
        continue;
      }
      const evidence = importedAndCalledActions(testFile);
      const replayGuard = evidence.source.includes("DATABASE_URL")
        && evidence.source.includes("EXPECTED_DATABASE_URL")
        && evidence.source.includes("127.0.0.1")
        && evidence.source.includes("expect(");
      if (evidence.called.has(action) && replayGuard) proved = true;
    }
    if (!proved) errors.push(`H18_WRITE_TEST_DOES_NOT_CALL_ACTION_AGAINST_REPLAY_DB:${action}`);
  }
  return errors;
}

function selftest() {
  const inventory = ["src/app/actions/a.ts#readA", "src/app/actions/a.ts#writeA"];
  const manifest = {
    inventorySha256: "outdated",
    testedWriteActions: {},
    writeActionOverrides: {},
  };
  const missing = validateClassification(inventory, manifest);
  if (!missing.some((entry) => entry.startsWith("H18_SERVER_ACTION_INVENTORY_CHANGED"))) {
    throw new Error("H18_SELFTEST_NEW_ACTION_NOT_REJECTED");
  }
  const growth = validateOverrideShrink(
    { writeActionOverrides: { newWrite: "reason" } },
    { writeActionOverrides: { oldWrite: "reason" } },
  );
  if (growth.length !== 1) throw new Error("H18_SELFTEST_OVERRIDE_GROWTH_NOT_REJECTED");
  process.stdout.write("H18_SERVER_ACTIONS_SELFTEST=PASS\n");
}

if (process.argv.includes("--selftest")) {
  selftest();
} else {
  const inventory = inventoryServerActions();
  if (process.argv.includes("--inventory")) {
    const inventorySha256 = createHash("sha256").update(`${inventory.join("\n")}\n`).digest("hex");
    process.stdout.write(`${JSON.stringify({ inventorySha256, actions: inventory }, null, 2)}\n`);
  } else {
    const manifest = readManifest();
    const errors = [
      ...validateClassification(inventory, manifest),
      ...validateOverrideShrink(manifest, readBaselineManifest()),
      ...validateTestProofs(manifest),
    ];
    if (errors.length > 0) {
      process.stderr.write(`${errors.join("\n")}\n`);
      process.exitCode = 1;
    } else {
      const writeCount = Object.keys(manifest.testedWriteActions).length
        + Object.keys(manifest.writeActionOverrides).length;
      process.stdout.write(`H18_SERVER_ACTIONS=PASS inventory=${inventory.length} writes=${writeCount} tested=${Object.keys(manifest.testedWriteActions).length} overrides=${Object.keys(manifest.writeActionOverrides).length}\n`);
    }
  }
}
