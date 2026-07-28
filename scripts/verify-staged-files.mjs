import { execSync, spawnSync } from 'node:child_process';

// 1. Get staged files via git diff
let stdout = '';
try {
  stdout = execSync('git diff --cached --name-only --diff-filter=ACMR', { encoding: 'utf8' });
} catch (err) {
  console.error('Failed to run git diff:', err.message);
  process.exit(1);
}

// 2. Filter files by extensions: .js, .jsx, .ts, .tsx, .mjs, .cjs
const files = stdout
  .split(/\r?\n/)
  .map(file => file.trim())
  .filter(file => {
    if (!file) return false;
    return /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(file);
  });

// ESLint receives paths from the working tree, not index blobs. Do not present
// its result as a staged-candidate check when any selected file has newer
// unstaged content. The author must stage the intended candidate first.
let worktreeStdout = '';
try {
  worktreeStdout = execSync('git diff --name-only --diff-filter=ACMR', { encoding: 'utf8' });
} catch (err) {
  console.error('Failed to inspect working-tree drift:', err.message);
  process.exit(1);
}
const unstagedFiles = new Set(
  worktreeStdout
    .split(/\r?\n/)
    .map(file => file.trim())
    .filter(Boolean),
);
const overlappingFiles = files.filter(file => unstagedFiles.has(file));
if (overlappingFiles.length > 0) {
  console.error('Refusing to lint a mixed index/working-tree candidate. Stage these intended changes first:');
  console.error(overlappingFiles.map(file => ` - ${file}`).join('\n'));
  process.exit(1);
}

// 3. If no matching files, exit successfully
if (files.length === 0) {
  console.log('No staged JS/TS files to lint.');
  process.exit(0);
}

console.log(`Linting ${files.length} staged file(s) with ESLint...`);
console.log(files.map(f => ` - ${f}`).join('\n'));

// 4. Run ESLint without shell string concatenation and return exit code
const result = spawnSync('node', ['node_modules/eslint/bin/eslint.js', ...files], { stdio: 'inherit' });

process.exit(result.status ?? 1);
