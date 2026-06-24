#!/usr/bin/env node
/**
 * lint-ratchet.mjs — QG-01 Regression Gate
 *
 * Runs all three ESLint scopes and compares against the committed baseline
 * in lint-baseline.json. Fails (exit 1) if:
 *
 *   - any scope processes 0 files (command broken or scope emptied)
 *   - error count increases vs baseline
 *   - warning count increases vs baseline
 *   - checked file count drops below baseline (scope shrinkage)
 *
 * Baseline:  lint-baseline.json (committed to repo)
 * JSON output: $TEMP/lint-ratchet-{scope}.json  (not committed)
 *
 * Usage:
 *   node scripts/lint-ratchet.mjs          (check — fails on regression)
 *   node scripts/lint-ratchet.mjs --update (regenerate baseline from current counts)
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir, EOL } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASELINE_PATH = join(ROOT, 'lint-baseline.json');
const UPDATE_MODE = process.argv.includes('--update');

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));

/** @type {Array<{name: string, cmd: string}>} */
const SCOPES = [
  {
    name: 'app',
    cmd: 'npx eslint --config eslint.config.mjs src/ --format json',
  },
  {
    name: 'edge',
    cmd: 'npx eslint --config eslint.edge.config.mjs supabase/functions/ --format json',
  },
  {
    name: 'scripts',
    // *.js expands to root CJS scripts; migrate.mjs is the ESM root script
    cmd: 'npx eslint --config eslint.scripts.config.mjs scripts/ *.js migrate.mjs --format json',
  },
];

let failed = false;
const newCounts = {};

for (const scope of SCOPES) {
  const outFile = join(tmpdir(), `lint-ratchet-${scope.name}.json`);

  // 64 MB buffer — ESLint JSON for large scopes (600+ files, 400+ errors)
  // easily exceeds the default 1 MB maxBuffer.
  const MAX_BUF = 64 * 1024 * 1024;
  let stdout = '';
  try {
    stdout = execSync(scope.cmd, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: MAX_BUF,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    // ESLint exits 1 when it finds errors — expected. Capture stdout.
    stdout = typeof e.stdout === 'string' ? e.stdout : '';
    if (!stdout) {
      console.error(`[RATCHET FAIL] ${scope.name}: ESLint produced no output (command error)`);
      console.error('  stderr:', String(e.stderr ?? '').slice(0, 400));
      failed = true;
      continue;
    }
  }

  writeFileSync(outFile, stdout, 'utf8');

  /** @type {Array<{filePath: string, errorCount: number, warningCount: number}>} */
  let results;
  try {
    results = JSON.parse(stdout);
  } catch {
    console.error(`[RATCHET FAIL] ${scope.name}: could not parse ESLint JSON output`);
    console.error('  output starts with:', stdout.slice(0, 200));
    failed = true;
    continue;
  }

  const checkedFiles = results.length;
  const errors = results.reduce((sum, f) => sum + f.errorCount, 0);
  const warnings = results.reduce((sum, f) => sum + f.warningCount, 0);

  newCounts[scope.name] = { files: checkedFiles, errors, warnings };

  if (UPDATE_MODE) {
    console.log(`[UPDATE] ${scope.name}: files=${checkedFiles} errors=${errors} warnings=${warnings}`);
    continue;
  }

  const b = baseline[scope.name];
  if (!b) {
    console.error(`[RATCHET FAIL] ${scope.name}: no baseline entry found in lint-baseline.json`);
    failed = true;
    continue;
  }

  const issues = [];

  if (checkedFiles === 0) {
    issues.push('ZERO files checked — scope is broken or command failed');
  }
  if (errors > b.errors) {
    issues.push(`errors: ${b.errors} → ${errors} (+${errors - b.errors})`);
  }
  if (warnings > b.warnings) {
    issues.push(`warnings: ${b.warnings} → ${warnings} (+${warnings - b.warnings})`);
  }
  if (checkedFiles < b.files && checkedFiles > 0) {
    issues.push(`scope shrinkage: ${b.files} → ${checkedFiles} files (check for accidental exclusions)`);
  }

  if (issues.length > 0) {
    console.error(`[RATCHET FAIL] ${scope.name.padEnd(9)} ${issues.join(' | ')}`);
    failed = true;
  } else {
    const delta = checkedFiles - b.files;
    const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
    console.log(
      `[RATCHET OK]   ${scope.name.padEnd(9)} ` +
      `files=${checkedFiles}(${deltaStr})  ` +
      `errors=${errors}/${b.errors}  ` +
      `warnings=${warnings}/${b.warnings}  ` +
      `report=${outFile}`,
    );
  }
}

if (UPDATE_MODE) {
  // Merge new counts into existing baseline (preserves comments and extra fields)
  const existing = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  for (const [name, counts] of Object.entries(newCounts)) {
    existing[name] = { ...existing[name], ...counts };
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(existing, null, 2) + EOL, 'utf8');
  console.log(`\nBaseline updated: ${BASELINE_PATH}`);
  process.exit(0);
}

if (failed) {
  process.stderr.write(
    '\nRatchet failed: errors or warnings increased, or a scope produced 0 files.\n' +
    'Fix the regressions before committing.\n',
  );
  process.exit(1);
} else {
  console.log('\nRatchet passed. No regression vs baseline.');
}
