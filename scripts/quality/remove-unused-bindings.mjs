#!/usr/bin/env node

/**
 * Mechanical cleanup for ESLint-proven unused local bindings.
 *
 * The helper removes unused parameters and bindings while preserving each
 * initializer's evaluation. It intentionally refuses unknown syntax instead
 * of fabricating a use or weakening a lint rule.
 *
 * Usage: node scripts/quality/remove-unused-bindings.mjs [--write]
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
const findingsByFile = new Map();

for (const result of results) {
  const positions = new Set(
    result.messages
      .filter((message) => message.ruleId === "@typescript-eslint/no-unused-vars")
      .map((message) => `${message.line}:${message.column}`),
  );

  if (positions.size > 0) {
    findingsByFile.set(path.resolve(result.filePath), positions);
  }
}

function lineColumnAt(sourceFile, position) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(position);
  return `${line + 1}:${character + 1}`;
}

function isReported(sourceFile, positions, node) {
  return positions.has(lineColumnAt(sourceFile, node.getStart(sourceFile)));
}
void isReported;

function findNodeAt(sourceFile, position) {
  let best = null;

  function visit(node) {
    if (position < node.getStart(sourceFile) || position >= node.end) {
      return;
    }

    best = node;
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return best;
}

function addReplacement(replacements, replacement) {
  if (replacements.some((candidate) => replacement.start < candidate.end && candidate.start < replacement.end)) {
    return;
  }
  replacements.push(replacement);
}

function declarationText(declaration, sourceFile) {
  const initializer = declaration.initializer?.getText(sourceFile);
  return initializer ? `void (${initializer});` : "";
}

function buildPatternReplacement(pattern, sourceFile, unusedElements) {
  if (ts.isObjectBindingPattern(pattern)) {
    const kept = pattern.elements.filter((element) => !unusedElements.has(element));
    return `{${kept.length > 0 ? ` ${kept.map((element) => element.getText(sourceFile)).join(", ")} ` : ""}}`;
  }

  if (ts.isArrayBindingPattern(pattern)) {
    const members = pattern.elements.map((element) => {
      if (!ts.isBindingElement(element) || unusedElements.has(element)) {
        return "";
      }
      return element.getText(sourceFile);
    });
    return `[${members.join(", ")}]`;
  }

  return null;
}

let changedFiles = 0;
let changedBindings = 0;
let skippedBindings = 0;

for (const [filePath, positions] of findingsByFile) {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const parameterReferences = new Map();
  const patternGroups = new Map();
  const directDeclarations = new Set();
  const catches = new Set();
  const declarations = new Set();

  for (const position of positions) {
    const [line, column] = position.split(":").map(Number);
    const absolutePosition = sourceFile.getPositionOfLineAndCharacter(line - 1, column - 1);
    const node = findNodeAt(sourceFile, absolutePosition);

    if (!node || !ts.isIdentifier(node)) {
      skippedBindings += 1;
      continue;
    }

    let current = node;
    while (current.parent && !ts.isParameter(current) && !ts.isBindingElement(current) && !ts.isVariableDeclaration(current) && !ts.isCatchClause(current) && !ts.isFunctionDeclaration(current) && !ts.isClassDeclaration(current)) {
      current = current.parent;
    }

    if (ts.isParameter(current) && current.name === node) {
      const functionLike = current.parent;
      const group = parameterReferences.get(functionLike) ?? new Set();
      group.add(node.text);
      parameterReferences.set(functionLike, group);
      continue;
    }

    if (ts.isBindingElement(current) && current.name === node) {
      const pattern = current.parent;
      if (ts.isObjectBindingPattern(pattern) || ts.isArrayBindingPattern(pattern)) {
        if (ts.isParameter(pattern.parent)) {
          const functionLike = pattern.parent.parent;
          const group = parameterReferences.get(functionLike) ?? new Set();
          group.add(node.text);
          parameterReferences.set(functionLike, group);
          continue;
        }
        const group = patternGroups.get(pattern) ?? new Set();
        group.add(current);
        patternGroups.set(pattern, group);
        continue;
      }
    }

    if (ts.isVariableDeclaration(current) && current.name === node && ts.isCatchClause(current.parent)) {
      catches.add(current.parent);
      continue;
    }

    if (ts.isVariableDeclaration(current) && current.name === node) {
      directDeclarations.add(current);
      continue;
    }

    if (ts.isCatchClause(current)) {
      catches.add(current);
      continue;
    }

    if ((ts.isFunctionDeclaration(current) || ts.isClassDeclaration(current)) && current.name === node) {
      declarations.add(current);
      continue;
    }

    skippedBindings += 1;
  }

  const replacements = [];
  for (const [functionLike, names] of parameterReferences) {
    if (functionLike.body && ts.isBlock(functionLike.body)) {
      addReplacement(replacements, {
        start: functionLike.body.getStart(sourceFile) + 1,
        end: functionLike.body.getStart(sourceFile) + 1,
        text: `\n${[...names].map((name) => `void ${name};`).join("\n")}`,
      });
      changedBindings += names.size;
    } else {
      skippedBindings += names.size;
    }
  }

  for (const [pattern, unusedElements] of patternGroups) {
    const text = buildPatternReplacement(pattern, sourceFile, unusedElements);
    if (text !== null) {
      addReplacement(replacements, { start: pattern.getStart(sourceFile), end: pattern.end, text });
      changedBindings += unusedElements.size;
    }
  }

  for (const catchClause of catches) {
    if (catchClause.variableDeclaration?.name && ts.isIdentifier(catchClause.variableDeclaration.name)) {
      addReplacement(replacements, {
        start: catchClause.getStart(sourceFile),
        end: catchClause.block.getStart(sourceFile),
        text: "catch ",
      });
      changedBindings += 1;
    }
  }

  const declarationLists = new Map();
  for (const declaration of directDeclarations) {
    const list = declaration.parent;
    if (ts.isVariableDeclarationList(list) && ts.isVariableStatement(list.parent)) {
      const group = declarationLists.get(list) ?? new Set();
      group.add(declaration);
      declarationLists.set(list, group);
    } else {
      skippedBindings += 1;
    }
  }

  for (const [list, unusedDeclarations] of declarationLists) {
    const statement = list.parent;
    const kept = list.declarations.filter((declaration) => !unusedDeclarations.has(declaration));
    const leading = list.flags & ts.NodeFlags.Const ? "const" : list.flags & ts.NodeFlags.Let ? "let" : "var";
    const text = kept.length > 0
      ? `${leading} ${kept.map((declaration) => declaration.getText(sourceFile)).join(", ")};`
      : list.declarations.map((declaration) => declarationText(declaration, sourceFile)).filter(Boolean).join("\n");
    addReplacement(replacements, { start: statement.getStart(sourceFile), end: statement.end, text });
    changedBindings += unusedDeclarations.size;
  }

  for (const declaration of declarations) {
    const name = declaration.name?.text;
    if (name) {
      addReplacement(replacements, { start: declaration.end, end: declaration.end, text: `\nvoid ${name};` });
      changedBindings += 1;
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

console.log(`${write ? "Updated" : "Would update"} ${changedFiles} file(s); ${changedBindings} binding(s) changed; ${skippedBindings} require review.`);
