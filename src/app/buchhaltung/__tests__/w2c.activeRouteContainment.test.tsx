import { realpathSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';
import AccountingPage from '../page';
import AusgabenPage from '../ausgaben/page';
import BwaPage from '../bwa/page';
import KostenPage from '../kosten/page';
import KraftstoffPage from '../kraftstoff/page';
import PeriodenabschlussPage from '../periodenabschluss/page';
import RechnungenPage from '../rechnungen/page';
import SteuerprofilPage from '../steuerprofil/page';

const repoRoot = resolve(process.cwd());
const srcRoot = resolve(repoRoot, 'src');
const appRoot = resolve(srcRoot, 'app');
const tsconfigPath = ts.findConfigFile(repoRoot, ts.sys.fileExists, 'tsconfig.json');

if (!tsconfigPath) throw new Error(`tsconfig.json was not found below ${repoRoot}`);

const tsconfigResult = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
if (tsconfigResult.error) throw new Error(ts.flattenDiagnosticMessageText(tsconfigResult.error.messageText, '\n'));

const parsedTsconfig = ts.parseJsonConfigFileContent(tsconfigResult.config, ts.sys, dirname(tsconfigPath), undefined, tsconfigPath);
if (parsedTsconfig.errors.length > 0) {
  throw new Error(parsedTsconfig.errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
}

const expectedSource = `import { FoundationUnavailable } from '@/components/foundation/FoundationUnavailable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AccountingUnavailablePage() {
  return <FoundationUnavailable />;
}
`;

const activeRoutes = [
  ['buchhaltung/page.tsx', AccountingPage],
  ['buchhaltung/rechnungen/page.tsx', RechnungenPage],
  ['buchhaltung/kosten/page.tsx', KostenPage],
  ['buchhaltung/kraftstoff/page.tsx', KraftstoffPage],
  ['buchhaltung/ausgaben/page.tsx', AusgabenPage],
  ['buchhaltung/bwa/page.tsx', BwaPage],
  ['buchhaltung/steuerprofil/page.tsx', SteuerprofilPage],
  ['buchhaltung/periodenabschluss/page.tsx', PeriodenabschlussPage],
] as const;

function canonicalExistingPath(path: string): string {
  return realpathSync.native(path).replace(/\\/g, '/');
}

function comparisonKey(path: string, useCaseSensitiveFileNames = ts.sys.useCaseSensitiveFileNames): string {
  const normalized = path.replace(/\\/g, '/');
  return useCaseSensitiveFileNames ? normalized : normalized.toLowerCase();
}

const forbiddenTargets = [
  'src/app/buchhaltung/actions.ts',
  'src/app/buchhaltung/analysis.actions.ts',
  'src/app/buchhaltung/search-actions.ts',
  'src/app/buchhaltung/BuchhaltungCockpitClient.tsx',
  'src/app/buchhaltung/periodenabschluss/actions.ts',
  'src/app/buchhaltung/periodenabschluss/PeriodenabschlussClient.tsx',
  'src/lib/buchhaltung/index.ts',
  'src/lib/buchhaltung/providers/SupabaseBuchhaltungProvider.ts',
  'src/components/analytics/AnalyticsDrillDrawer.tsx',
].map((path) => comparisonKey(canonicalExistingPath(resolve(repoRoot, path))));
const forbiddenBindings = new Set(['getBuchhaltungProvider']);
const srcRootKey = comparisonKey(canonicalExistingPath(srcRoot));

type RuntimeEdge = { specifier: string; target?: string; unresolved?: boolean };
type ImportAnalysis = { bindings: Set<string>; moduleSpecifiers: Set<string>; resolvedTargets: Set<string>; edges: RuntimeEdge[] };
type SourceReader = (path: string) => string | undefined;
type ModuleResolver = (entryPath: string, specifier: string) => string | undefined;
type ContainmentResult = { violations: string[]; unresolved: string[] };

function isLocalSpecifier(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('@/');
}

function resolveModuleTarget(entryPath: string, moduleSpecifier: string): string | undefined {
  if (!isLocalSpecifier(moduleSpecifier)) return undefined;
  const result = ts.resolveModuleName(moduleSpecifier, entryPath, parsedTsconfig.options, ts.sys);
  const resolvedFileName = result.resolvedModule?.resolvedFileName;
  if (!resolvedFileName || !/\.(?:ts|tsx|js|jsx|mts|cts)$/i.test(resolvedFileName)) return undefined;
  return canonicalExistingPath(resolvedFileName);
}

function isIgnoredLocalNonSource(specifier: string): boolean {
  return /\.(?:css|scss|sass|less|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot)$/i.test(specifier);
}

function analyzeImports(entryPath: string, source: string, resolver: ModuleResolver = resolveModuleTarget): ImportAnalysis {
  const sourceFile = ts.createSourceFile(entryPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const bindings = new Set<string>();
  const moduleSpecifiers = new Set<string>();
  const resolvedTargets = new Set<string>();
  const edges: RuntimeEdge[] = [];

  const addRuntimeSpecifier = (moduleSpecifier: ts.Expression | undefined) => {
    if (!moduleSpecifier || (!ts.isStringLiteral(moduleSpecifier) && !ts.isNoSubstitutionTemplateLiteral(moduleSpecifier))) {
      edges.push({ specifier: '<nonliteral>', unresolved: true });
      return;
    }
    const specifier = moduleSpecifier.text;
    moduleSpecifiers.add(specifier);
    if (isIgnoredLocalNonSource(specifier)) return;
    const target = resolver(entryPath, specifier);
    if (target) {
      resolvedTargets.add(comparisonKey(target));
      edges.push({ specifier, target });
    } else if (isLocalSpecifier(specifier)) {
      edges.push({ specifier, unresolved: true });
    }
  };

  const addImportClauseBindings = (importClause: ts.ImportClause | undefined) => {
    if (!importClause || importClause.isTypeOnly) return;
    if (importClause.name) bindings.add(importClause.name.text);
    const namedBindings = importClause.namedBindings;
    if (namedBindings && ts.isNamespaceImport(namedBindings)) bindings.add(namedBindings.name.text);
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      namedBindings.elements.filter((element) => !element.isTypeOnly).forEach((element) => bindings.add(element.propertyName?.text ?? element.name.text));
    }
  };

  const hasRuntimeImport = (importClause: ts.ImportClause | undefined) => {
    if (!importClause) return true;
    if (importClause.isTypeOnly) return false;
    if (importClause.name || !importClause.namedBindings || ts.isNamespaceImport(importClause.namedBindings)) return true;
    return importClause.namedBindings.elements.some((element) => !element.isTypeOnly);
  };

  const hasRuntimeExport = (node: ts.ExportDeclaration) => {
    if (node.isTypeOnly || !node.moduleSpecifier) return false;
    if (!node.exportClause || ts.isNamespaceExport(node.exportClause)) return true;
    return node.exportClause.elements.some((element) => !element.isTypeOnly);
  };

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && hasRuntimeImport(node.importClause)) {
      addRuntimeSpecifier(node.moduleSpecifier);
      addImportClauseBindings(node.importClause);
    }
    if (ts.isExportDeclaration(node) && hasRuntimeExport(node)) addRuntimeSpecifier(node.moduleSpecifier);
    if (ts.isImportEqualsDeclaration(node) && !node.isTypeOnly && ts.isExternalModuleReference(node.moduleReference)) {
      bindings.add(node.name.text);
      addRuntimeSpecifier(node.moduleReference.expression);
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      addRuntimeSpecifier(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { bindings, moduleSpecifiers, resolvedTargets, edges };
}

function inspectContainment(entries: string[], readSource: SourceReader, resolver: ModuleResolver = resolveModuleTarget): ContainmentResult {
  const violations: string[] = [];
  const unresolved: string[] = [];
  const visited = new Set<string>();

  const visit = (entryPath: string) => {
    const realEntryPath = entryPath.startsWith('mem://') ? entryPath : canonicalExistingPath(entryPath);
    const entryKey = comparisonKey(realEntryPath);
    if (visited.has(entryKey)) return;
    visited.add(entryKey);
    const source = readSource(realEntryPath);
    if (source === undefined) throw new Error(`Missing local runtime source ${realEntryPath}`);
    const analysis = analyzeImports(realEntryPath, source, resolver);
    for (const edge of analysis.edges) {
      if (edge.unresolved) unresolved.push(`${realEntryPath} -> ${edge.specifier}`);
      if (!edge.target) continue;
      const targetKey = comparisonKey(edge.target);
      if (forbiddenTargets.includes(targetKey)) violations.push(`${realEntryPath} -> ${edge.specifier} -> ${edge.target}`);
      if (forbiddenTargets.includes(targetKey)) continue;
      if (targetKey.startsWith(`${srcRootKey}/`) || edge.target.startsWith('mem://')) visit(edge.target);
    }
  };

  entries.forEach(visit);
  return { violations, unresolved };
}

function routeEntries(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return routeEntries(entryPath);
    return entry.name === 'page.tsx' || entry.name === 'layout.tsx' ? [entryPath] : [];
  });
}

function memoryResolver(graph: Record<string, string>, entryPath: string, specifier: string): string | undefined {
  return graph[`${entryPath}|${specifier}`];
}

afterEach(() => cleanup());

describe('W2C accounting active-route containment', () => {
  it('keeps real paths case-preserving while comparison keys follow the filesystem contract', () => {
    expect(comparisonKey('C:\\Repo\\Src\\App.tsx', true)).toBe('C:/Repo/Src/App.tsx');
    expect(comparisonKey('C:\\Repo\\Src\\App.tsx', false)).toBe('c:/repo/src/app.tsx');
  });

  it('canonically resolves every local runtime syntax form and ignores comments, strings, and type-only edges', () => {
    const entryPath = resolve(appRoot, 'buchhaltung/fristen/page.tsx');
    const analysis = analyzeImports(entryPath, `
      import DefaultClient from '../BuchhaltungCockpitClient';
      import * as provider from '@/lib/buchhaltung/providers/SupabaseBuchhaltungProvider';
      import { getBuchhaltungProvider as providerAlias } from '@/lib/buchhaltung';
      export { value } from '../analysis.actions';
      import Actions = require('../actions');
      void import('../../buchhaltung/search-actions');
      require('@/components/analytics/AnalyticsDrillDrawer');
      import { getPeriodenabschlussStatusAction } from '../periodenabschluss/actions';
      import { PeriodenabschlussClient } from '../periodenabschluss/PeriodenabschlussClient';
      import type { Metadata } from 'next';
      import { type ActionResult } from '../analysis.actions';
      // import('../analysis.actions)
      const documentation = "require('@/app/buchhaltung/actions')";
    `);

    expect([...analysis.moduleSpecifiers]).toEqual(expect.arrayContaining([
      '../BuchhaltungCockpitClient', '@/lib/buchhaltung/providers/SupabaseBuchhaltungProvider', '@/lib/buchhaltung',
      '../analysis.actions', '../actions', '../../buchhaltung/search-actions', '@/components/analytics/AnalyticsDrillDrawer',
      '../periodenabschluss/actions', '../periodenabschluss/PeriodenabschlussClient',
    ]));
    expect(analysis.resolvedTargets).toEqual(new Set(forbiddenTargets));
    expect([...analysis.bindings]).toEqual(expect.arrayContaining(['DefaultClient', 'provider', 'getBuchhaltungProvider', 'Actions']));
    expect(analysis.moduleSpecifiers).not.toContain('@/app/buchhaltung/actions');
  });

  it('ignores type-only import-equals and export edges while retaining mixed runtime edges', () => {
    const entryPath = resolve(appRoot, 'buchhaltung/fristen/page.tsx');
    const typeOnlyImportEquals = analyzeImports(entryPath, "import type Actions = require('../actions');");
    const typeOnlyExport = analyzeImports(entryPath, "export { type ActionResult } from '../analysis.actions';");
    const mixedExport = analyzeImports(entryPath, "export { type ActionResult, value } from '../analysis.actions';");
    const mixedImport = analyzeImports(entryPath, "import { type ActionResult, value } from '../analysis.actions';");

    expect(typeOnlyImportEquals.edges).toEqual([]);
    expect(typeOnlyExport.edges).toEqual([]);
    expect(mixedExport.edges).toEqual([{ specifier: '../analysis.actions', target: canonicalExistingPath(resolve(appRoot, 'buchhaltung/analysis.actions.ts')) }]);
    expect(mixedImport.edges).toEqual([{ specifier: '../analysis.actions', target: canonicalExistingPath(resolve(appRoot, 'buchhaltung/analysis.actions.ts')) }]);
  });

  it('uses TypeScript resolution for extensionless, explicit, alias, deep-relative, and directory-index forms', () => {
    const entryPath = resolve(appRoot, 'buchhaltung/fristen/page.tsx');
    const extensionless = resolveModuleTarget(entryPath, '../analysis.actions');
    const explicit = resolveModuleTarget(entryPath, '../analysis.actions.ts');
    expect(comparisonKey(extensionless!)).toBe(forbiddenTargets[1]);
    expect(comparisonKey(explicit!)).toBe(forbiddenTargets[1]);
    expect(comparisonKey(resolveModuleTarget(entryPath, '../../buchhaltung/analysis.actions.ts')!)).toBe(forbiddenTargets[1]);
    expect(comparisonKey(resolveModuleTarget(entryPath, '@/app/buchhaltung/actions')!)).toBe(forbiddenTargets[0]);
    expect(comparisonKey(resolveModuleTarget(entryPath, '../periodenabschluss/actions')!)).toBe(forbiddenTargets[4]);
    expect(comparisonKey(resolveModuleTarget(entryPath, '../periodenabschluss/PeriodenabschlussClient')!)).toBe(forbiddenTargets[5]);
    expect(comparisonKey(resolveModuleTarget(entryPath, '@/lib/buchhaltung')!)).toBe(forbiddenTargets[6]);
    expect(comparisonKey(resolveModuleTarget(entryPath, '@/lib/buchhaltung/providers/SupabaseBuchhaltungProvider.ts')!)).toBe(forbiddenTargets[7]);

    const javascript = resolveModuleTarget(entryPath, '../analysis.actions.js');
    if (javascript) expect(comparisonKey(javascript)).toBe(forbiddenTargets[1]);
    else expect(ts.resolveModuleName('../analysis.actions.js', entryPath, parsedTsconfig.options, ts.sys).resolvedModule).toBeUndefined();

    const caseFixture = ts.sys.useCaseSensitiveFileNames
      ? canonicalExistingPath(resolve(repoRoot, 'src/app/buchhaltung/analysis.actions.ts'))
      : canonicalExistingPath(resolve(repoRoot, 'src/APP/BUCHHALTUNG/analysis.actions.ts'));
    expect(comparisonKey(caseFixture)).toBe(forbiddenTargets[1]);
  });

  it('classifies forbidden direct and transitive dependency decisions without exclusions', () => {
    const route = canonicalExistingPath(resolve(appRoot, 'buchhaltung/fristen/page.tsx'));
    const wrapper = 'mem://wrapper.ts';
    const control = 'mem://control.ts';
    const graph: Record<string, string> = {
      [`${route}|../BuchhaltungCockpitClient`]: forbiddenTargets[3],
      [`${route}|@/lib/buchhaltung`]: forbiddenTargets[6],
      [`${route}|@/lib/buchhaltung/providers/SupabaseBuchhaltungProvider`]: forbiddenTargets[7],
      [`${route}|../actions`]: forbiddenTargets[0],
      [`${route}|../analysis.actions`]: forbiddenTargets[1],
      [`${route}|../analysis.actions.ts`]: forbiddenTargets[1],
      [`${route}|../../buchhaltung/search-actions`]: forbiddenTargets[2],
      [`${route}|@/components/analytics/AnalyticsDrillDrawer`]: forbiddenTargets[8],
      [`${route}|../periodenabschluss/actions`]: forbiddenTargets[4],
      [`${route}|../periodenabschluss/PeriodenabschlussClient`]: forbiddenTargets[5],
      [`${route}|@/test-fixtures/wrapper`]: wrapper,
      [`${wrapper}|../app/buchhaltung/actions`]: forbiddenTargets[0],
      [`${route}|@/test-fixtures/periodenabschluss-actions-wrapper`]: 'mem://periodenabschluss-actions-wrapper.ts',
      ['mem://periodenabschluss-actions-wrapper.ts|../app/buchhaltung/periodenabschluss/actions']: forbiddenTargets[4],
      [`${route}|@/test-fixtures/periodenabschluss-client-wrapper`]: 'mem://periodenabschluss-client-wrapper.ts',
      ['mem://periodenabschluss-client-wrapper.ts|../app/buchhaltung/periodenabschluss/PeriodenabschlussClient']: forbiddenTargets[5],
      [`${route}|@/test-fixtures/control`]: control,
    };
    const sources: Record<string, string> = {
      [route]: '', [wrapper]: '', ['mem://periodenabschluss-actions-wrapper.ts']: '', ['mem://periodenabschluss-client-wrapper.ts']: '', [control]: '',
    };
    const readSource: SourceReader = (path) => sources[path];
    const resolver: ModuleResolver = (entryPath, specifier) => memoryResolver(graph, entryPath, specifier);
    const cases = [
      { name: 'default binding', source: "import DefaultClient from '../BuchhaltungCockpitClient';", violation: true },
      { name: 'named alias directory index', source: "import { getBuchhaltungProvider as provider } from '@/lib/buchhaltung';", violation: true },
      { name: 'namespace alias', source: "import * as provider from '@/lib/buchhaltung/providers/SupabaseBuchhaltungProvider';", violation: true },
      { name: 'bare import', source: "import '../actions';", violation: true },
      { name: 'extensionless forbidden target', source: "export { value } from '../analysis.actions';", violation: true },
      { name: 'explicit forbidden target', source: "void import('../analysis.actions.ts');", violation: true },
      { name: 'deep relative dynamic import', source: "void import('../../buchhaltung/search-actions');", violation: true },
      { name: 'literal require', source: "require('@/components/analytics/AnalyticsDrillDrawer');", violation: true },
      { name: 'periodenabschluss action direct target', source: "import '../periodenabschluss/actions';", violation: true },
      { name: 'periodenabschluss client direct target', source: "import '../periodenabschluss/PeriodenabschlussClient';", violation: true },
      { name: 'transitive forbidden target', source: "import '@/test-fixtures/wrapper';", violation: true },
      { name: 'periodenabschluss action transitive target', source: "import '@/test-fixtures/periodenabschluss-actions-wrapper';", violation: true },
      { name: 'periodenabschluss client transitive target', source: "import '@/test-fixtures/periodenabschluss-client-wrapper';", violation: true },
      { name: 'safe control', source: "import '@/test-fixtures/control';", violation: false },
    ];

    for (const testCase of cases) {
      sources[route] = testCase.source;
      sources[wrapper] = "require('../app/buchhaltung/actions');";
      sources['mem://periodenabschluss-actions-wrapper.ts'] = "require('../app/buchhaltung/periodenabschluss/actions');";
      sources['mem://periodenabschluss-client-wrapper.ts'] = "require('../app/buchhaltung/periodenabschluss/PeriodenabschlussClient');";
      sources[control] = 'export const control = true;';
      const result = inspectContainment([route], readSource, resolver);
      expect(result.unresolved, testCase.name).toEqual([]);
      expect(result.violations.length > 0, testCase.name).toBe(testCase.violation);
    }
  });

  it('fails closed for nonliteral dynamic import and require in a considered dependency', () => {
    const entryPath = canonicalExistingPath(resolve(appRoot, 'buchhaltung/fristen/page.tsx'));
    const analysis = analyzeImports(entryPath, 'void import(specifier); require(factory());');
    expect(analysis.edges.filter((edge) => edge.unresolved).map((edge) => edge.specifier)).toEqual(['<nonliteral>', '<nonliteral>']);
  });

  it('keeps each active accounting route byte-for-content fail-closed', () => {
    for (const [route] of activeRoutes) {
      expect(readFileSync(join(appRoot, route), 'utf8').replace(/\r\n/g, '\n')).toBe(expectedSource);
    }
  });

  it('renders every active accounting route as the real foundation-unavailable state', () => {
    for (const [, Page] of activeRoutes) {
      render(<Page />);
      expect(screen.getByText('NOT_AVAILABLE')).toBeVisible();
      expect(screen.getByText('Operative Daten sind noch nicht verfügbar')).toBeVisible();
      expect(screen.getByText('Für diesen Bereich ist noch keine kanonische, quellgestützte operative Datenbasis verfügbar.')).toBeVisible();
      cleanup();
    }
  });

  it('keeps all route entries and their transitive local runtime dependencies away from unsafe targets', () => {
    const entries = routeEntries(appRoot);
    for (const entryPath of entries) {
      const route = relative(appRoot, entryPath).replace(/\\/g, '/');
      const analysis = analyzeImports(entryPath, readFileSync(entryPath, 'utf8'));
      for (const forbiddenBinding of forbiddenBindings) {
        expect(analysis.bindings, `${route} imports ${forbiddenBinding}`).not.toContain(forbiddenBinding);
      }
    }
    const result = inspectContainment(entries, (path) => readFileSync(path, 'utf8'));
    expect(result.unresolved, result.unresolved.join('\n')).toEqual([]);
    expect(result.violations, result.violations.join('\n')).toEqual([]);

  }, 15_000);

  it('keeps the existing export route foundation-unavailable', () => {
    const exportSource = readFileSync(join(appRoot, 'buchhaltung/export/page.tsx'), 'utf8').replace(/\r\n/g, '\n');
    expect(exportSource).toBe(expectedSource.replace('AccountingUnavailablePage', 'ExportPage'));
  });
});
