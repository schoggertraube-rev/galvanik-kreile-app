import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const migrationPrefix = "supabase/migrations/";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function segmentMatches(pattern, value) {
  const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, "\\$&").replaceAll("*", "[^/]*");
  return new RegExp(`^${escaped}$`).test(value);
}

export function matches(pattern, path) {
  const parts = pattern.split("/");
  const target = path.split("/");
  function visit(i, j) {
    if (i === parts.length) return j === target.length;
    if (parts[i] === "**") {
      for (let next = j; next <= target.length; next += 1) {
        if (visit(i + 1, next)) return true;
      }
      return false;
    }
    return j < target.length && segmentMatches(parts[i], target[j]) && visit(i + 1, j + 1);
  }
  return visit(0, 0);
}

export function sharedPatterns(body = "") {
  return body.split(/\r?\n/).flatMap(line => {
    const found = line.match(/^\s*(?:[-*]\s+)?GEMEINSAM\s+(\S+)\s+\S.*$/);
    return found ? [found[1]] : [];
  });
}

function category(config, path) {
  for (const name of config.vorrang) {
    if (name === "rest_haupt") return name;
    if ((config[name] ?? []).some(pattern => matches(pattern, path))) return name;
  }
  return "rest_haupt";
}

export function checkPaths(config, branch, paths, body = "") {
  const writer = branch.startsWith("codex-b/") ? "codex-b" : branch.startsWith("codex/") ? "codex" : null;
  const shared = sharedPatterns(body);
  return paths.map(path => {
    const list = category(config, path);
    let reason = "";
    if (!writer) reason = "Zweig ohne Schreiber";
    else if (writer === "codex-b" && list === "nur_haupt") reason = "nur Haupt-Codex";
    else if (writer === "codex-b" && !["register", "codex-b"].includes(list)
      && !shared.some(pattern => matches(pattern, path))) reason = "GEMEINSAM-Zeile fehlt";
    else if (writer === "codex" && list === "codex-b"
      && !shared.some(pattern => matches(pattern, path))) reason = "GEMEINSAM-Zeile fehlt";
    return { path, list, ok: !reason, reason };
  });
}

function mainConfig() {
  try {
    git("cat-file", "-e", "origin/main:scripts/quality/check-besitz.mjs");
    git("cat-file", "-e", "origin/main:besitz.json");
    return JSON.parse(git("show", "origin/main:besitz.json"));
  } catch {
    return JSON.parse(readFileSync("besitz.json", "utf8"));
  }
}

function mainMigrationMaximum() {
  const names = git("ls-tree", "-r", "--name-only", "origin/main", "--", migrationPrefix).split(/\r?\n/);
  return names.reduce((largest, name) => {
    const stamp = name.slice(migrationPrefix.length).match(/^(\d{14})_/);
    return stamp && stamp[1] > largest ? stamp[1] : largest;
  }, "00000000000000");
}

export function checkMigrations({ changedPaths, newPaths, otherPulls = [], selfNumber, maxMainStamp }) {
  if (!changedPaths.some(path => path.startsWith(migrationPrefix))) return [];
  const errors = [];
  const blocker = otherPulls.filter(pr => pr.number !== selfNumber && pr.number < selfNumber
    && pr.files.some(path => path.startsWith(migrationPrefix)))
    .sort((a, b) => a.number - b.number)[0];
  if (blocker) errors.push(`Migrationsplatz belegt durch #${blocker.number}`);
  for (const path of newPaths.filter(name => name.startsWith(migrationPrefix))) {
    const stamp = path.slice(migrationPrefix.length).match(/^(\d{14})_/);
    if (!stamp || stamp[1] <= maxMainStamp) errors.push(`${path}: Zeitstempel zu alt`);
  }
  return errors;
}

async function githubPages(url, token) {
  const all = [];
  for (let page = 1; ; page += 1) {
    const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}per_page=100&page=${page}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
    });
    if (!response.ok) throw Error(`GitHub API ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw Error("GitHub API Antwort ungültig");
    all.push(...rows);
    if (rows.length < 100) return all;
  }
}

async function otherPulls(selfNumber) {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token || !repository) throw Error("Migrationsprüfung benötigt GITHUB_TOKEN und GITHUB_REPOSITORY");
  const api = process.env.GITHUB_API_URL || "https://api.github.com";
  const pulls = await githubPages(`${api}/repos/${repository}/pulls?state=open`, token);
  return Promise.all(pulls.filter(pr => pr.number !== selfNumber && pr.number < selfNumber).map(async pr => ({
    number: pr.number,
    files: (await githubPages(`${api}/repos/${repository}/pulls/${pr.number}/files`, token)).map(file => file.filename),
  })));
}

function selftest() {
  const config = JSON.parse(readFileSync("besitz.json", "utf8"));
  const check = (branch, files, body = "") => checkPaths(config, branch, files, body).every(row => row.ok);
  const tests = [
    !check("codex-b/x", [".github/x.yml"]),
    check("codex-b/x", ["src/modules/lager/a.ts"]),
    !check("codex-b/x", ["src/app/actions/neu.ts"]) && check("codex-b/x", ["src/app/actions/neu.ts"], "GEMEINSAM src/app/actions/neu.ts B1a") && check("codex-b/x", ["src/app/actions/neu.ts"], "- GEMEINSAM src/app/actions/neu.ts B1a"),
    !check("codex/x", ["src/modules/lager/a.ts"]),
    check("codex-b/x", ["scripts/quality/h18-server-actions.json"]),
    check("codex-b/x", ["src/modules/lager/a.ts"]),
    !check("claude/x", ["src/modules/lager/a.ts"]) && checkPaths(config, "claude/x", ["x"])[0].reason === "Zweig ohne Schreiber",
    !check("codex-b/x", ["src/modules/tasks/a.ts", "src/modules/lager/a.ts"]),
    checkMigrations({ changedPaths: ["supabase/migrations/20261124010101_x.sql"], newPaths: [], otherPulls: [{ number: 7, files: ["supabase/migrations/a.sql"] }], selfNumber: 8, maxMainStamp: "0" }).some(error => error.includes("#7")),
    check("codex-b/x", ["src/app/actions/lager.actions.ts"]),
    !check("codex-b/x", ["src/ui/vorlage/a.ts"], "GEMEINSAM src/ui/** x"),
    check("codex-b/x", Array.from({ length: 10 }, (_, i) => `supabase/migrations/${i}.sql`), "GEMEINSAM supabase/migrations/** B1a"),
    !check("codex-b/x", ["docs/a.md"]) && check("codex-b/x", ["docs/a.md"], "GEMEINSAM docs/a.md B1a"),
    check("codex/x", ["src/modules/lager/a.ts", ".github/x.yml"], "GEMEINSAM src/modules/lager/a.ts B1a"),
    checkMigrations({ changedPaths: ["supabase/migrations/20261124010101_x.sql"], newPaths: [], otherPulls: [{ number: 9, files: ["supabase/migrations/a.sql"] }], selfNumber: 8, maxMainStamp: "0" }).length === 0
      && checkMigrations({ changedPaths: ["docs/a.md"], newPaths: [], otherPulls: [{ number: 7, files: ["supabase/migrations/a.sql"] }], selfNumber: 8, maxMainStamp: "0" }).length === 0
      && checkMigrations({ changedPaths: ["supabase/migrations/20261123010101_x.sql"], newPaths: ["supabase/migrations/20261123010101_x.sql"], otherPulls: [], selfNumber: 8, maxMainStamp: "20261123010101" }).some(error => error.includes("Zeitstempel zu alt")),
    !checkPaths({ ...config, nur_haupt: config.nur_haupt.filter(pattern => pattern !== ".github/**") }, "codex-b/x", ["besitz.json", ".github/x.yml"])[1].ok,
  ];
  for (const [index, passed] of tests.entries()) {
    console.log(`besitz Selbsttest ${index + 1}/16: ${passed ? "grün" : "rot"}`);
  }
  if (tests.length !== 16 || tests.some(passed => !passed)) throw Error("besitz Selbsttest fehlgeschlagen");
}

async function main() {
  if (process.argv.includes("--selftest")) return selftest();
  const config = mainConfig();
  const branch = process.env.HEAD_REF || git("branch", "--show-current");
  const body = process.env.PR_BODY || "";
  const selfNumber = Number(process.env.PR_NUMBER);
  const base = git("merge-base", "origin/main", "HEAD");
  const changedPaths = git("diff", "--name-only", "--no-renames", base, "HEAD").split(/\r?\n/).filter(Boolean);
  const newPaths = git("diff", "--diff-filter=A", "--name-only", "--no-renames", base, "HEAD").split(/\r?\n/).filter(Boolean);
  const rows = checkPaths(config, branch, changedPaths, body);
  const errors = [];
  if (changedPaths.some(path => path.startsWith(migrationPrefix))) {
    try {
      if (!Number.isSafeInteger(selfNumber) || selfNumber < 1) throw Error("PR_NUMBER fehlt oder ist ungültig");
      errors.push(...checkMigrations({ changedPaths, newPaths, selfNumber, maxMainStamp: mainMigrationMaximum(), otherPulls: await otherPulls(selfNumber) }));
    } catch (error) {
      errors.push(`Migrationsprüfung fehlgeschlagen: ${error.message}`);
    }
  }
  for (const row of rows) console.log(`${row.path} | ${row.list} | ${row.ok ? "grün" : `rot: ${row.reason}`}`);
  for (const error of errors) console.error(`rot: ${error}`);
  const red = rows.filter(row => !row.ok).length + errors.length;
  console.log(red ? `besitz rot: ${red}` : "besitz grün");
  if (red) process.exitCode = 1;
}

await main();
