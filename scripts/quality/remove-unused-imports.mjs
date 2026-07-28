#!/usr/bin/env node

/**
 * Mechanical hygiene helper for the repository-wide unused-import backlog.
 *
 * It consumes ESLint's own `no-unused-vars` findings and removes only the
 * reported import bindings. When the last value binding of a value import is
 * removed, the module is retained as a side-effect import. This deliberately
 * does not touch variables, parameters, exports, or lint configuration.
 *
 * Usage: node scripts/quality/remove-unused-imports.mjs [--write]
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { ESLint } from "eslint";
import ts from "typescript";

const write = process.argv.includes("--write");
const root = process.cwd();
const eslint = new ESLint({ cwd: root });
const results = await eslint.lintFiles(["."]);
const unusedImportPositions = new Map();

for (const result of results) {
  const positions = new Set(
    result.messages
      .filter((message) => message.ruleId === "@typescript-eslint/no-unused-vars")
      .map((message) => `${message.line}:${message.column}`),
  );

  if (positions.size > 0) {
    unusedImportPositions.set(path.resolve(result.filePath), positions);
  }
}

function lineColumnAt(sourceFile, position) {
  const lineAndCharacter = sourceFile.getLineAndCharacterOfPosition(position);
  return `${lineAndCharacter.line + 1}:${lineAndCharacter.character + 1}`;
}

function isReportedUnused(sourceFile, positions, node) {
  return positions.has(lineColumnAt(sourceFile, node.getStart(sourceFile)));
}

function importText(importDeclaration, sourceFile, positions) {
  const clause = importDeclaration.importClause;

  if (!clause) {
    return null;
  }

  const defaultName = clause.name;
  let removedBinding = false;
  const keepDefault = defaultName && !isReportedUnused(sourceFile, positions, defaultName)
    ? defaultName.text
    : null;
  if (defaultName && !keepDefault) {
    removedBinding = true;
  }
  const namedBindings = clause.namedBindings;
  let keepNamespace = null;
  let keepSpecifiers = [];

  if (namedBindings && ts.isNamespaceImport(namedBindings)) {
    if (!isReportedUnused(sourceFile, positions, namedBindings.name)) {
      keepNamespace = namedBindings.name.text;
    } else {
      removedBinding = true;
    }
  }

  if (namedBindings && ts.isNamedImports(namedBindings)) {
    keepSpecifiers = namedBindings.elements
      .filter((specifier) => !isReportedUnused(sourceFile, positions, specifier.name))
      .map((specifier) => specifier.getText(sourceFile));
    removedBinding ||= keepSpecifiers.length !== namedBindings.elements.length;
  }

  if (!removedBinding) {
    return null;
  }

  const moduleText = importDeclaration.moduleSpecifier.getText(sourceFile);
  if (!keepDefault && !keepNamespace && keepSpecifiers.length === 0) {
    return clause.isTypeOnly ? "" : `import ${moduleText};`;
  }

  const prefix = clause.isTypeOnly ? "import type " : "import ";
  const parts = [];
  if (keepDefault) {
    parts.push(keepDefault);
  }
  if (keepNamespace) {
    parts.push(`* as ${keepNamespace}`);
  }
  if (keepSpecifiers.length > 0) {
    parts.push(`{ ${keepSpecifiers.join(", ")} }`);
  }

  return `${prefix}${parts.join(", ")} from ${moduleText};`;
}

let changedFiles = 0;
let removedBindings = 0;

for (const [filePath, positions] of unusedImportPositions) {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const replacements = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) {
      continue;
    }

    const oldText = statement.getText(sourceFile);
    const nextText = importText(statement, sourceFile, positions);
    if (nextText !== null && nextText !== oldText) {
      removedBindings += 1;
      replacements.push({ start: statement.getStart(sourceFile), end: statement.end, text: nextText });
    }
  }

  if (replacements.length === 0) {
    continue;
  }

  let output = sourceText;
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    output = `${output.slice(0, replacement.start)}${replacement.text}${output.slice(replacement.end)}`;
  }

  changedFiles += 1;
  if (write) {
    fs.writeFileSync(filePath, output);
  }
}

console.log(`${write ? "Updated" : "Would update"} ${changedFiles} file(s); ${removedBindings} import declaration(s) changed.`);
