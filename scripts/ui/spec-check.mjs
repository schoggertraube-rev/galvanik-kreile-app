import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const requested = process.argv.find((arg) => arg.startsWith("--screens="))?.slice("--screens=".length).split(",").filter(Boolean) ?? [];
if (requested.length === 0) {
  console.error("Usage: node scripts/ui/spec-check.mjs --screens=login,rechte,meincode");
  process.exit(2);
}

const buildPlan = JSON.parse(readFileSync(join(root, "docs/project/endversion/codex/BAUPLAN.json"), "utf8"));
const screens = [];
function visit(value) {
  if (!value || typeof value !== "object") return;
  if (!Array.isArray(value) && typeof value.id === "string" && requested.includes(value.id) && (value.felder || value.aktionen || value.inhalt)) screens.push(value);
  for (const child of Array.isArray(value) ? value : Object.values(value)) visit(child);
}
visit(buildPlan);

function collectFields(value, into = []) {
  if (!value || typeof value !== "object") return into;
  if (Array.isArray(value)) {
    for (const item of value) collectFields(item, into);
    return into;
  }
  if (Array.isArray(value.felder)) for (const field of value.felder) if (typeof field?.id === "string") into.push(field.id);
  if (Array.isArray(value.inhalt)) collectFields(value.inhalt, into);
  return into;
}

function slug(text) {
  return text.toLocaleLowerCase("de-DE").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function sourceFiles(directory, into = []) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, into);
    else if ([".ts", ".tsx", ".js", ".jsx"].includes(extname(path))) into.push(path);
  }
  return into;
}

const source = sourceFiles(join(root, "src")).map((path) => readFileSync(path, "utf8")).join("\n");
const expected = [];
for (const screen of screens) {
  for (const field of collectFields(screen)) expected.push(`${screen.id}.${field}`);
  for (const action of screen.aktionen ?? []) expected.push(`${screen.id}.${action.id ?? slug(action.text)}`);
}
const unique = [...new Set(expected)].sort();
const missing = unique.filter((id) => !source.includes(`data-spec-id=\"${id}\"`));
console.log(`SPEC_CHECK screens=${requested.join(",")} expected=${unique.length} found=${unique.length - missing.length} missing=${missing.length}`);
for (const id of missing) console.log(`MISSING ${id}`);
process.exit(missing.length === 0 && requested.every((id) => screens.some((screen) => screen.id === id)) ? 0 : 1);
