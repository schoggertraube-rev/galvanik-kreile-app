#!/usr/bin/env node

/**
 * Turns temporary unused-argument markers in unavailable adapters into an
 * explicit, non-persisting rejected-input contract. Only a contiguous leading
 * `void argument;` sequence followed by a direct unavailable return is changed.
 *
 * Usage: node scripts/quality/bind-unavailable-inputs.mjs [--write]
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const write = process.argv.includes("--write");
const root = process.cwd();
const sourceFiles = ["src", "scripts", "supabase", "scratch", "test_legacy.ts", "test_station_counts.ts"];

function filesAt(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return [];
  }
  if (fs.statSync(absolutePath).isFile()) {
    return [absolutePath];
  }
  return fs.readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) =>
    filesAt(path.join(relativePath, entry.name)),
  );
}

function voidIdentifier(statement) {
  if (!ts.isExpressionStatement(statement) || !ts.isVoidExpression(statement.expression)) {
    return null;
  }
  const expression = statement.expression;
  return ts.isIdentifier(expression.expression)
    ? expression.expression.text
    : null;
}

function unavailableCall(node) {
  let call = null;

  function visit(child) {
    if (call) {
      return;
    }
    if (ts.isCallExpression(child) && ts.isIdentifier(child.expression) && ["foundationUnavailableAction", "foundationUnavailableResponse"].includes(child.expression.text)) {
      call = child;
      return;
    }
    ts.forEachChild(child, visit);
  }

  visit(node);
  return call;
}

let changedFiles = 0;
let changedInputs = 0;

for (const filePath of sourceFiles.flatMap(filesAt).filter((filePath) => /\.(?:[cm]?[jt]sx?)$/.test(filePath))) {
  const text = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
  const replacements = [];

  function visit(node) {
    if (ts.isFunctionLike(node) && node.body && ts.isBlock(node.body)) {
      const statements = node.body.statements;
      const identifiers = [];
      let index = 0;
      while (index < statements.length) {
        const identifier = voidIdentifier(statements[index]);
        if (!identifier) {
          break;
        }
        identifiers.push(identifier);
        index += 1;
      }

      const call = identifiers.length > 0
        ? statements.slice(index).map(unavailableCall).find(Boolean)
        : null;
      if (call) {
        replacements.push({
          start: statements[0].getStart(sourceFile),
          end: statements[index].getStart(sourceFile),
          text: "",
        });
        replacements.push({
          start: call.arguments.end,
          end: call.arguments.end,
          text: `, ${identifiers.join(", ")}`,
        });
        changedInputs += identifiers.length;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  if (replacements.length === 0) {
    continue;
  }

  let output = text;
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    output = `${output.slice(0, replacement.start)}${replacement.text}${output.slice(replacement.end)}`;
  }

  changedFiles += 1;
  if (write) {
    fs.writeFileSync(filePath, output);
  }
}

console.log(`${write ? "Updated" : "Would update"} ${changedFiles} file(s); ${changedInputs} unavailable input(s) bound.`);
