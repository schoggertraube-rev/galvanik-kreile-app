#!/usr/bin/env node
/**
 * lint-ratchet.mjs — QG-01 Hardened Regression Gate
 *
 * Modes
 * ─────
 *   (default)    Run all scopes, compare against baseline, fail on regression.
 *   --update     Regenerate baseline. Shows diff. Requires clean worktree.
 *                Never runs automatically. Invoke via: npm run lint:baseline:update
 *   --run-tests  Execute the five negative/positive test cases. Uses $TEMP only.
 *
 * What fails
 * ──────────
 *   • A scope processes 0 files
 *   • A file that had issues disappears from scope entirely
 *   • A new file appears with issues
 *   • A new ruleId appears in an existing file
 *   • Error or warning count increases for any file × rule combination
 *   • errors_total or warnings_total increase
 *   • ESLint config file hash changed without baseline update
 *   • ESLint or plugin versions changed without baseline update
 *
 * What is allowed
 * ───────────────
 *   • Issues in a file decrease or disappear (improvement)
 *   • New clean production files appear in scope (file count can grow)
 *   • errors_total or warnings_total decrease
 *
 * Baseline:   lint-baseline.json (committed, updated only via --update)
 * JSON dumps: $TEMP/lint-ratchet-{scope}.json (never committed)
 */
import { execSync }           from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { tmpdir, EOL }        from 'node:os';
import { fileURLToPath }      from 'node:url';
import { createHash }         from 'node:crypto';

// ── Setup ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const BL_PATH   = join(ROOT, 'lint-baseline.json');
const TEMP      = tmpdir();
const MAX_BUF   = 64 * 1024 * 1024; // 64 MB — large JSON for 600+ files

const argv        = process.argv.slice(2);
const UPDATE_MODE = argv.includes('--update');
const TEST_MODE   = argv.includes('--run-tests');

// ── Scope definitions ────────────────────────────────────────────────────────

const SCOPES = [
  {
    name:       'app',
    configFile: 'eslint.config.mjs',
    cmd:        'npx eslint --config eslint.config.mjs src/ --format json',
  },
  {
    name:       'edge',
    configFile: 'eslint.edge.config.mjs',
    cmd:        'npx eslint --config eslint.edge.config.mjs supabase/functions/ --format json',
  },
  {
    name:       'scripts',
    configFile: 'eslint.scripts.config.mjs',
    cmd:        'npx eslint --config eslint.scripts.config.mjs scripts/ *.js migrate.mjs --format json',
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function sha256(content) {
  return 'sha256:' + createHash('sha256').update(content).digest('hex');
}

function hashFile(filePath) {
  try   { return sha256(readFileSync(filePath, 'utf8')); }
  catch { return 'sha256:missing'; }
}

/** Stable relative path with forward slashes — no absolute Windows paths in baseline. */
function relPath(absPath) {
  return relative(ROOT, absPath).split('\\').join('/');
}

function getVersions() {
  const pkgs = [
    'eslint', 'eslint-config-next', 'typescript-eslint',
    'eslint-plugin-react', 'eslint-plugin-react-hooks',
  ];
  const out = {};
  for (const pkg of pkgs) {
    try {
      const p = JSON.parse(readFileSync(join(ROOT, 'node_modules', pkg, 'package.json'), 'utf8'));
      out[pkg] = p.version;
    } catch {
      out[pkg] = 'unknown';
    }
  }
  return out;
}

/**
 * Analyse ESLint JSON output into a structured representation.
 * @param {object[]} results ESLint flat JSON array
 */
function analyzeResults(results) {
  const filesWithIssues = {};
  const rulesTotal      = {};
  let   errorsTotal     = 0;
  let   warningsTotal   = 0;
  const allPaths        = new Set(); // ALL checked paths, not just those with issues

  for (const file of results) {
    const rel = relPath(file.filePath);
    allPaths.add(rel);
    errorsTotal   += file.errorCount;
    warningsTotal += file.warningCount;

    if (file.errorCount + file.warningCount > 0) {
      const fileRules = {};
      for (const msg of file.messages) {
        const rule = msg.ruleId || '__parse_error__';
        const sev  = msg.severity === 2 ? 'error' : 'warn';
        if (!fileRules[rule]) fileRules[rule] = { error: 0, warn: 0 };
        fileRules[rule][sev]++;
        if (!rulesTotal[rule]) rulesTotal[rule] = { error: 0, warn: 0 };
        rulesTotal[rule][sev]++;
      }
      filesWithIssues[rel] = fileRules;
    }
  }

  return {
    total_files_checked: results.length,
    errors_total:        errorsTotal,
    warnings_total:      warningsTotal,
    rules_total:         sortedObj(rulesTotal),
    files_with_issues:   sortedObj(filesWithIssues),
    _all_paths:          allPaths, // runtime only — not persisted
  };
}

function sortedObj(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

// ── Comparison ───────────────────────────────────────────────────────────────

/**
 * Compare a single scope's current results against its baseline entry.
 * Returns an array of human-readable issue strings (empty = pass).
 *
 * @param {object} bScope   Baseline scope entry (from lint-baseline.json)
 * @param {object} current  Result of analyzeResults()
 * @param {string} configHash sha256 of the config file at runtime
 * @param {object} versions  Current ESLint/plugin versions
 * @param {object} bMeta    Baseline _meta block
 */
function compareScope(bScope, current, configHash, versions, bMeta) {
  const issues = [];

  // 1. Config integrity — catches rule removal / weakening
  if (bScope.config_hash && configHash !== bScope.config_hash) {
    issues.push(
      `CONFIG CHANGED without baseline update\n` +
      `  baseline config_hash: ${bScope.config_hash}\n` +
      `  current  config_hash: ${configHash}\n` +
      `  → Edit config intentionally, then run 'npm run lint:baseline:update' to acknowledge`
    );
  }

  // 2. Version drift
  if (bMeta && bMeta.versions) {
    for (const [pkg, bVer] of Object.entries(bMeta.versions)) {
      const curVer = versions[pkg];
      if (curVer && curVer !== bVer) {
        issues.push(`version drift: ${pkg} ${bVer} → ${curVer} (run lint:baseline:update after verifying upgrade)`);
      }
    }
  }

  // 3. Zero files — scope broken
  if (current.total_files_checked === 0) {
    issues.push('ZERO files checked — scope command broken or path missing');
    return issues; // no further per-file analysis possible
  }

  // 4. Scope shrinkage — files can grow (new clean files) but not shrink
  if (current.total_files_checked < bScope.total_files_checked) {
    issues.push(
      `scope shrinkage: ${bScope.total_files_checked} → ${current.total_files_checked} files ` +
      `(${bScope.total_files_checked - current.total_files_checked} files disappeared from scope)`
    );
  }

  // 5. Global totals (fast path — per-file analysis below is the strict gate)
  if (current.errors_total > bScope.errors_total) {
    issues.push(`errors_total: ${bScope.errors_total} → ${current.errors_total} (+${current.errors_total - bScope.errors_total})`);
  }
  if (current.warnings_total > bScope.warnings_total) {
    issues.push(`warnings_total: ${bScope.warnings_total} → ${current.warnings_total} (+${current.warnings_total - bScope.warnings_total})`);
  }

  const bFiles  = bScope.files_with_issues || {};
  const cFiles  = current.files_with_issues;
  const allPaths = current._all_paths;

  // 6. Files that had issues in baseline must still exist in scope
  //    (if fixed → still in results with 0 issues, but not in cFiles; if deleted → gone)
  for (const file of Object.keys(bFiles)) {
    if (!allPaths.has(file)) {
      issues.push(`expected file disappeared from scope: ${file}`);
    }
  }

  // 7. New file with issues — error relocation detector
  for (const file of Object.keys(cFiles)) {
    if (!bFiles[file]) {
      issues.push(`new file with issues: ${file}`);
    }
  }

  // 8. Per-file × per-rule checks
  for (const [file, bRules] of Object.entries(bFiles)) {
    const cRules = cFiles[file];
    if (!cRules) continue; // file was fixed entirely — allowed

    // 8a. New rule appeared in existing file
    for (const rule of Object.keys(cRules)) {
      if (!bRules[rule]) {
        issues.push(`new rule in ${file}: ${rule}`);
      }
    }

    // 8b. Count increase for existing rule
    for (const [rule, bCounts] of Object.entries(bRules)) {
      const cCounts = cRules[rule] || { error: 0, warn: 0 };
      if ((cCounts.error || 0) > (bCounts.error || 0)) {
        issues.push(`${file}: ${rule} error count ${bCounts.error} → ${cCounts.error}`);
      }
      if ((cCounts.warn || 0) > (bCounts.warn || 0)) {
        issues.push(`${file}: ${rule} warn count ${bCounts.warn} → ${cCounts.warn}`);
      }
    }
  }

  return issues;
}

// ── ESLint runner ─────────────────────────────────────────────────────────────

function runESLintScope(scope) {
  let stdout = '';
  try {
    stdout = execSync(scope.cmd, {
      cwd:      ROOT,
      encoding: 'utf8',
      maxBuffer: MAX_BUF,
      stdio:    ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    // ESLint exits 1 when errors are found — that's expected
    stdout = (typeof e.stdout === 'string') ? e.stdout : '';
    if (!stdout) {
      return { error: String(e.stderr || e.message || 'no output').slice(0, 400) };
    }
  }

  const outFile = join(TEMP, `lint-ratchet-${scope.name}.json`);
  writeFileSync(outFile, stdout, 'utf8');

  try {
    return { results: JSON.parse(stdout), outFile };
  } catch {
    return { error: `Could not parse JSON. Output starts: ${stdout.slice(0, 200)}` };
  }
}

// ── Diff display ──────────────────────────────────────────────────────────────

function showDiff(oldBL, newBL) {
  const scopes = ['app', 'edge', 'scripts'];
  let anyDiff = false;
  for (const s of scopes) {
    const o = oldBL[s], n = newBL[s];
    if (!o || !n) continue;
    const lines = [];
    if (o.errors_total !== n.errors_total)   lines.push(`  errors: ${o.errors_total} → ${n.errors_total}`);
    if (o.warnings_total !== n.warnings_total) lines.push(`  warnings: ${o.warnings_total} → ${n.warnings_total}`);
    if (o.total_files_checked !== n.total_files_checked) lines.push(`  files: ${o.total_files_checked} → ${n.total_files_checked}`);
    if (o.config_hash !== n.config_hash)     lines.push(`  config_hash changed`);
    // files_with_issues diff
    const oFW = new Set(Object.keys(o.files_with_issues || {}));
    const nFW = new Set(Object.keys(n.files_with_issues || {}));
    for (const f of nFW) if (!oFW.has(f)) lines.push(`  + new file with issues: ${f}`);
    for (const f of oFW) if (!nFW.has(f)) lines.push(`  - file fixed: ${f}`);
    if (lines.length) { anyDiff = true; console.log(`[DIFF] ${s}:\n` + lines.join('\n')); }
    else console.log(`[DIFF] ${s}: unchanged`);
  }
  // Meta diff
  const oV = (oldBL._meta || {}).versions || {};
  const nV = (newBL._meta || {}).versions || {};
  for (const pkg of Object.keys(nV)) {
    if (oV[pkg] !== nV[pkg]) { anyDiff = true; console.log(`[DIFF] version: ${pkg} ${oV[pkg]} → ${nV[pkg]}`); }
  }
  if (!anyDiff) console.log('[DIFF] No changes — baseline is already up to date.');
}

// ── Baseline builder ──────────────────────────────────────────────────────────

function buildNewBaseline() {
  const versions = getVersions();
  const baseline = { _meta: { generated: new Date().toISOString().slice(0, 10), versions } };
  const resultsMap = {};

  for (const scope of SCOPES) {
    process.stdout.write(`  Running ${scope.name} scope... `);
    const { results, error } = runESLintScope(scope);
    if (error) { console.error(`FAIL: ${error}`); process.exit(1); }
    resultsMap[scope.name] = results;
    const analysis = analyzeResults(results);
    const configHash = hashFile(join(ROOT, scope.configFile));
    baseline[scope.name] = {
      config_file:         scope.configFile,
      config_hash:         configHash,
      total_files_checked: analysis.total_files_checked,
      errors_total:        analysis.errors_total,
      warnings_total:      analysis.warnings_total,
      rules_total:         analysis.rules_total,
      files_with_issues:   analysis.files_with_issues,
    };
    console.log(`${results.length} files, ${analysis.errors_total}E, ${analysis.warnings_total}W`);
  }
  return baseline;
}

// ── Negative / positive test suite ───────────────────────────────────────────

async function runTests() {
  console.log('\n═══ QG-01 Ratchet Test Suite ═══\n');
  const versions = getVersions();
  let passed = 0, failed = 0;

  // Helper: print test result
  function testResult(n, label, issues, expectFail) {
    const got    = issues.length > 0;
    const ok     = got === expectFail;
    const status = ok ? '✓ PASS' : '✗ FAIL';
    if (ok) passed++; else failed++;
    console.log(`[${status}] Test ${n}: ${label}`);
    if (!ok) {
      if (expectFail) console.log('       Expected ratchet to FAIL but it PASSED');
      else console.log('       Expected ratchet to PASS but it FAILED:', issues[0]);
    } else if (got && ok) {
      console.log(`       → Correctly failed: ${issues[0].slice(0, 100)}`);
    }
  }

  // Load baseline and run ESLint to get real current results
  const baseline = JSON.parse(readFileSync(BL_PATH, 'utf8'));
  const bMeta    = baseline._meta || {};

  // Get real results from $TEMP (from a previous normal run) or re-run
  function loadOrRun(scopeName, scope) {
    const tmpFile = join(TEMP, `lint-ratchet-${scopeName}.json`);
    if (existsSync(tmpFile)) {
      try { return JSON.parse(readFileSync(tmpFile, 'utf8')); } catch {}
    }
    const { results, error } = runESLintScope(scope);
    if (error) { console.error(`Cannot get results for ${scopeName}: ${error}`); process.exit(1); }
    return results;
  }

  const appScope    = SCOPES[0];
  const appResults  = loadOrRun('app', appScope);
  const appAnalysis = analyzeResults(appResults);
  const appBL       = baseline.app;
  const appConfigHash = hashFile(join(ROOT, appScope.configFile));

  // ── Test 1: Total unchanged, but error relocated to different file ──────────
  // Simulate: pick a file A with issues, pick a file B without issues.
  // Move one warning from A to B as a new rule. Totals stay same.
  {
    const filesWithIssues = Object.keys(appAnalysis.files_with_issues);
    const fileA = filesWithIssues[0]; // has issues in both baseline and current
    // Find a file in scope without issues
    const allPaths = [...appAnalysis._all_paths];
    const fileB = allPaths.find(p => !appAnalysis.files_with_issues[p] && !appBL.files_with_issues[p]);

    // Build fake current analysis: file A has one fewer warn, file B gains one new rule
    const fakeFilesWithIssues = { ...appAnalysis.files_with_issues };
    const aRules = { ...fakeFilesWithIssues[fileA] };
    // Find a rule in file A to reduce by 1
    const [ruleA] = Object.keys(aRules);
    if (aRules[ruleA].warn > 0) {
      aRules[ruleA] = { ...aRules[ruleA], warn: aRules[ruleA].warn - 1 };
      if (aRules[ruleA].warn === 0 && aRules[ruleA].error === 0) delete aRules[ruleA];
      if (Object.keys(aRules).length > 0) fakeFilesWithIssues[fileA] = aRules;
      else delete fakeFilesWithIssues[fileA];
    }
    // Add file B with a new rule
    fakeFilesWithIssues[fileB] = { '__test_relocated_rule__': { error: 0, warn: 1 } };

    const fakeCurrent = {
      ...appAnalysis,
      files_with_issues: sortedObj(fakeFilesWithIssues),
      // keep totals same — this is the "disguise" the old ratchet missed
    };

    const issues = compareScope(appBL, fakeCurrent, appConfigHash, versions, bMeta);
    testResult(1, 'Total same but error relocated to new file → must FAIL', issues, true);
  }

  // ── Test 2: ESLint rule removed from config (config hash mismatch) ──────────
  {
    // Simulate: baseline has old config hash; current config was modified without update
    const fakeBL = {
      ...appBL,
      config_hash: 'sha256:00000000000000000000000000000000000000000000000000000000aabbccdd',
    };
    const issues = compareScope(fakeBL, appAnalysis, appConfigHash, versions, bMeta);
    testResult(2, 'Config modified without baseline update → must FAIL', issues, true);
  }

  // ── Test 3: Expected file path disappeared from scope ───────────────────────
  {
    // Simulate: remove a file that had baseline issues from _all_paths
    const trackedFile = Object.keys(appBL.files_with_issues)[0];
    const fakeAllPaths = new Set([...appAnalysis._all_paths]);
    fakeAllPaths.delete(trackedFile);

    const fakeCurrent = { ...appAnalysis, _all_paths: fakeAllPaths };
    const issues = compareScope(appBL, fakeCurrent, appConfigHash, versions, bMeta);
    testResult(3, `Expected file disappeared from scope → must FAIL`, issues, true);
  }

  // ── Test 4: Existing error removed (improvement) → must PASS ───────────────
  {
    // Simulate: one file in files_with_issues gets one fewer warning
    const [targetFile, targetRules] = Object.entries(appAnalysis.files_with_issues)[0];
    const [targetRule, targetCounts] = Object.entries(targetRules)[0];

    const fakeFilesWithIssues = { ...appAnalysis.files_with_issues };
    if (targetCounts.warn > 0) {
      fakeFilesWithIssues[targetFile] = {
        ...targetRules,
        [targetRule]: { ...targetCounts, warn: targetCounts.warn - 1 },
      };
    }
    const fakeCurrent = {
      ...appAnalysis,
      files_with_issues: fakeFilesWithIssues,
      warnings_total:    appAnalysis.warnings_total - 1,
    };
    const issues = compareScope(appBL, fakeCurrent, appConfigHash, versions, bMeta);
    testResult(4, 'Existing error removed (improvement) → must PASS', issues, false);
  }

  // ── Test 5: New clean production file added → must PASS ────────────────────
  {
    // Simulate: total_files_checked increases, new file has 0 issues, not in files_with_issues
    const fakeAllPaths = new Set([...appAnalysis._all_paths, 'src/app/new-clean-component.tsx']);
    const fakeCurrent = {
      ...appAnalysis,
      total_files_checked: appAnalysis.total_files_checked + 1,
      _all_paths:          fakeAllPaths,
    };
    const issues = compareScope(appBL, fakeCurrent, appConfigHash, versions, bMeta);
    testResult(5, 'New clean production file added → must PASS', issues, false);
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

// ── Normal ratchet run ────────────────────────────────────────────────────────

async function runRatchet() {
  const baseline = JSON.parse(readFileSync(BL_PATH, 'utf8'));
  const bMeta    = baseline._meta || {};
  const versions = getVersions();
  let   globalFail = false;

  for (const scope of SCOPES) {
    const { results, error } = runESLintScope(scope);

    if (error) {
      console.error(`[RATCHET FAIL] ${scope.name}: ${error}`);
      globalFail = true;
      continue;
    }

    const current    = analyzeResults(results);
    const configHash = hashFile(join(ROOT, scope.configFile));
    const bScope     = baseline[scope.name];

    if (!bScope) {
      console.error(`[RATCHET FAIL] ${scope.name}: no baseline entry`);
      globalFail = true;
      continue;
    }

    const issues = compareScope(bScope, current, configHash, versions, bMeta);

    if (issues.length > 0) {
      console.error(`[RATCHET FAIL] ${scope.name}`);
      for (const issue of issues) console.error(`  • ${issue}`);
      globalFail = true;
    } else {
      const dFiles = current.total_files_checked - bScope.total_files_checked;
      console.log(
        `[RATCHET OK]   ${scope.name.padEnd(9)} ` +
        `files=${current.total_files_checked}(${dFiles >= 0 ? '+' : ''}${dFiles})  ` +
        `errors=${current.errors_total}/${bScope.errors_total}  ` +
        `warnings=${current.warnings_total}/${bScope.warnings_total}  ` +
        `config_hash=OK`,
      );
    }
  }

  if (globalFail) {
    process.stderr.write('\nRatchet failed. Resolve regressions before committing.\n');
    process.exit(1);
  } else {
    console.log('\nRatchet passed. No regression detected.');
  }
}

// ── Baseline update ───────────────────────────────────────────────────────────

async function runUpdate() {
  // Require clean worktree (baseline update must be intentional)
  let statusOut = '';
  try { statusOut = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }); }
  catch { /* git not available — proceed */ }
  const dirtyTracked = statusOut.split('\n').filter(l => l && !l.startsWith('??'));
  if (dirtyTracked.length > 0) {
    console.error('[ERROR] Baseline update requires a clean working tree (no tracked changes).');
    console.error('  Unstaged / staged changes:');
    dirtyTracked.forEach(l => console.error(' ', l));
    process.exit(1);
  }

  console.log('Building new baseline...');
  const newBL  = buildNewBaseline();
  const oldRaw = existsSync(BL_PATH) ? readFileSync(BL_PATH, 'utf8') : '{}';
  const oldBL  = JSON.parse(oldRaw);

  console.log('\nDiff vs current baseline:');
  showDiff(oldBL, newBL);

  writeFileSync(BL_PATH, JSON.stringify(newBL, null, 2) + EOL, 'utf8');
  console.log(`\nBaseline written to ${BL_PATH}`);
  console.log('Stage and commit lint-baseline.json to make the update permanent.');
}

// ── Entrypoint ────────────────────────────────────────────────────────────────

if (UPDATE_MODE)     await runUpdate();
else if (TEST_MODE)  await runTests();
else                 await runRatchet();
