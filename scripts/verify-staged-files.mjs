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
