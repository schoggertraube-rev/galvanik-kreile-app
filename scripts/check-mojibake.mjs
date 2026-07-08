import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoPath = path.resolve(__dirname, '..');

const searchPatterns = [
  "Ã",
  "Â",
  "â€",
  "â†",
  "â”",
  "\uFFFD",
  "StoÃ",
  "KÃ",
  "fÃ",
  "Ã¤",
  "Ã¶",
  "Ã¼",
  "ÃŸ"
];

const scanDirs = [
  'src',
  'scripts',
  'supabase',
  'public'
];

const targetExtensions = [
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.txt', '.sql', '.css'
];

const ignoredPaths = [
  'node_modules',
  '.next',
  '.git',
  'coverage',
  'dist',
  'build',
  '.vercel',
  'KREILE_PROJEKT_DOKUMENTATION/99_AUDIT_INPUT',
  'output'
];

// Specific file exclusions (such as old log files, generated results, check script itself, or legacy md)
const ignoredFiles = [
  'lint-report.txt',
  'lint_results.txt',
  'analysisoverlay_search.txt',
  'recovered_getAnalysisProps.txt',
  'check-mojibake.mjs' // Ignore this check script itself
];

const findings = [];

function scanFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!targetExtensions.includes(ext)) return;

  const relPath = path.relative(repoPath, filePath).replace(/\\/g, '/');
  if (ignoredFiles.includes(path.basename(filePath))) return;
  if (relPath === 'package-lock.json') return;

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pat of searchPatterns) {
      if (line.includes(pat)) {
        findings.push({
          file: relPath,
          line: i + 1,
          pattern: pat,
          context: line.trim()
        });
        break;
      }
    }
  }
}

function walkDir(dir) {
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch {
    return;
  }

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const relPath = path.relative(repoPath, fullPath).replace(/\\/g, '/');
    
    // Check if path is in ignoredPaths
    if (ignoredPaths.some(p => relPath === p || relPath.startsWith(p + '/'))) {
      continue;
    }

    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else {
      scanFile(fullPath);
    }
  }
}

// 1. Scan recursive directories
for (const dir of scanDirs) {
  const fullDir = path.join(repoPath, dir);
  if (fs.existsSync(fullDir)) {
    walkDir(fullDir);
  }
}

// 2. Scan specific root files and *.md in root
const rootFiles = fs.readdirSync(repoPath);
for (const file of rootFiles) {
  const fullPath = path.join(repoPath, file);
  let stat;
  try {
    stat = fs.statSync(fullPath);
  } catch {
    continue;
  }

  if (stat.isFile()) {
    const ext = path.extname(file).toLowerCase();
    if (file === 'package.json' || file === 'tsconfig.json' || ext === '.md') {
      scanFile(fullPath);
    }
  }
}

if (findings.length > 0) {
  console.error(`\x1b[31m[MOJIBAKE GATE] Found ${findings.length} encoding issue(s):\x1b[0m`);
  for (const f of findings) {
    console.error(`  \x1b[33m${f.file}:${f.line}\x1b[0m - Pattern: "${f.pattern}" - Context: "${f.context}"`);
  }
  process.exit(1);
} else {
  console.log('\x1b[32m[MOJIBAKE GATE] No encoding issues found. Clean!\x1b[0m');
  process.exit(0);
}
