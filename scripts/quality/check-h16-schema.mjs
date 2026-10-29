import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";
import ts from "typescript";

const baseRef = process.env.H16_SCHEMA_BASE_REF?.trim() || "origin/main";
const SQL_START = /^(?:SELECT|INSERT|UPDATE|DELETE|WITH)\b/i;
const NON_QUERY_START = /^(?:CREATE|ALTER|DROP|DO|GRANT|REVOKE|COMMENT|TRUNCATE)\b/i;
const UUID = "'00000000-0000-4000-8000-000000000000'";

function changedSourceFiles() {
  const output = execFileSync("git", ["diff", "--name-only", `${baseRef}...HEAD`], { encoding: "utf8" });
  return output.split(/\r?\n/).filter((file) => /^src\/.+\.tsx?$/.test(file) && existsSync(file));
}

function tagName(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return "";
}

function placeholder(expression, followingText, declarations, seen) {
  if (ts.isTaggedTemplateExpression(expression) && tagName(expression.tag) === "sql") {
    return materialize(expression, declarations, seen);
  }
  if (ts.isIdentifier(expression)) {
    const declared = declarations.get(expression.text);
    if (declared && !seen.has(expression.text)) {
      const nextSeen = new Set(seen).add(expression.text);
      if (ts.isTaggedTemplateExpression(declared) && tagName(declared.tag) === "sql") {
        return materialize(declared, declarations, nextSeen);
      }
    }
  }

  const expressionText = expression.getText();
  if (/^::uuid\[\]/i.test(followingText)) return "ARRAY[]";
  if (/^::uuid/i.test(followingText)) return UUID;
  if (/^::jsonb/i.test(followingText) || /(?:payload|json|data)/i.test(expressionText)) return "'{}'";
  if (/^::date/i.test(followingText) || /(?:date|until|at|time)/i.test(expressionText)) return "'2026-01-01'";
  if (/(?:version|count|quantity|price|cents|basisPoints|rate|amount|limit|offset)/i.test(expressionText)) return "0";
  if (/(?:active|enabled|finished|granted|include)/i.test(expressionText)) return "false";
  const terminalName = expressionText.split(/[^A-Za-z0-9_$]+/).filter(Boolean).at(-1) ?? "";
  if (terminalName === "id" || terminalName === "uuid" || /Id$/.test(terminalName)) return UUID;
  return "NULL";
}

function materialize(node, declarations, seen = new Set()) {
  if (ts.isNoSubstitutionTemplateLiteral(node.template)) return node.template.text;
  let result = node.template.head.text;
  for (const span of node.template.templateSpans) {
    const followingText = span.literal.text;
    result += placeholder(span.expression, followingText, declarations, seen);
    result += followingText;
  }
  return result;
}

function collectQueries(file) {
  const sourceText = readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const declarations = new Map();
  const tags = [];

  function collectDeclarations(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      declarations.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, collectDeclarations);
  }
  collectDeclarations(source);

  function visit(node) {
    if (ts.isTaggedTemplateExpression(node) && tagName(node.tag) === "sql") tags.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);

  return tags.flatMap((node) => {
    const text = materialize(node, declarations).trim();
    if (!SQL_START.test(text)) return [];
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    return [{ id: `${file}:${line}`, text }];
  });
}

function collectChangedQueries() {
  const queries = changedSourceFiles().flatMap(collectQueries);
  const unique = new Map(queries.map((query) => [`${query.id}:${query.text}`, query]));
  return [...unique.values()];
}

if (process.argv.includes("--list")) {
  const queries = collectChangedQueries();
  console.log(`H16_SCHEMA_DISCOVERY changedFiles=${changedSourceFiles().length} queries=${queries.length}`);
  for (const query of queries) console.log(query.id);
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("H16_SCHEMA_DATABASE_URL_REQUIRED");
const sql = postgres(databaseUrl, { max: 1, prepare: false });

async function explain(query) {
  if (NON_QUERY_START.test(query.text)) return;
  try {
    await sql.unsafe(`EXPLAIN ${query.text}`);
  } catch (error) {
    throw new Error(`H16_SCHEMA_EXPLAIN_FAILED:${query.id}:${error instanceof Error ? error.message : String(error)}:SQL=${query.text.slice(0, 500)}`);
  }
}

try {
  if (process.argv.includes("--selftest")) {
    await explain({ id: "selftest-valid", text: "SELECT id FROM public.app_users LIMIT 1" });
    let rejected = false;
    try {
      await explain({ id: "selftest-invented-column", text: "SELECT definitely_missing_h16_column FROM public.app_users" });
    } catch (error) {
      rejected = String(error).includes("selftest-invented-column");
    }
    if (!rejected) throw new Error("H16_SCHEMA_SELFTEST_DID_NOT_REJECT_INVENTED_COLUMN");
    console.log("H16_SCHEMA_SELFTEST=PASS");
  } else {
    const queries = collectChangedQueries();
    if (queries.length === 0) throw new Error("H16_SCHEMA_NO_CHANGED_SQL_QUERIES");
    for (const query of queries) await explain(query);
    console.log(`H16_SCHEMA=PASS changedFiles=${changedSourceFiles().length} queries=${queries.length}`);
  }
} finally {
  await sql.end();
}
