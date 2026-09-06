import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireAdminOrDeveloper = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockValues = vi.fn();
const mockOnConflictDoNothing = vi.fn();

vi.mock("@/lib/auth/permissions", () => ({
  requireAdminOrDeveloper: mockRequireAdminOrDeveloper,
}));

vi.mock("@/db", () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
  },
}));

vi.mock("@/db/schema", () => ({ appUsers: {}, featureFlags: {} }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("@/lib/auth/userDtos", () => ({ toAdminUserDto: vi.fn() }));
vi.mock("@/lib/server/appSession", () => ({ APP_TENANT_ID: KREILE_TENANT_SLUG }));

const denial = "NOT_AVAILABLE: Sichere Feature- und Rollenverwaltung benötigt den W3-Command-Vertrag.";

function expectDatabasePortsUntouched() {
  expect(mockSelect).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockInsert).not.toHaveBeenCalled();
  expect(mockSet).not.toHaveBeenCalled();
  expect(mockWhere).not.toHaveBeenCalled();
  expect(mockValues).not.toHaveBeenCalled();
  expect(mockOnConflictDoNothing).not.toHaveBeenCalled();
}

function parseSource(source: string, fileName: string, scriptKind: ts.ScriptKind) {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind);
}

function findNodes<T extends ts.Node>(sourceFile: ts.Node, predicate: (node: ts.Node) => node is T): T[] {
  const nodes: T[] = [];
  const visit = (node: ts.Node) => {
    if (predicate(node)) nodes.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return nodes;
}

function jsxAttribute(element: ts.JsxOpeningLikeElement, name: string) {
  return element.attributes.properties.find(
    (attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute)
      && ts.isIdentifier(attribute.name)
      && attribute.name.text === name,
  );
}

function isStandaloneBooleanAttribute(element: ts.JsxOpeningLikeElement, name: string) {
  const attribute = jsxAttribute(element, name);
  return attribute !== undefined && attribute.initializer === undefined;
}

function isGuardFirst(statement: ts.Statement) {
  return ts.isExpressionStatement(statement)
    && ts.isAwaitExpression(statement.expression)
    && ts.isCallExpression(statement.expression.expression)
    && ts.isIdentifier(statement.expression.expression.expression)
    && statement.expression.expression.expression.text === "requireAdminOrDeveloper"
    && statement.expression.expression.arguments.length === 0;
}

function isForbiddenPort(node: ts.Node) {
  if (ts.isPropertyAccessExpression(node)) {
    return ts.isIdentifier(node.expression)
      && (node.expression.text === "db" || node.expression.text === "console");
  }

  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
    return /^(?:insert|update|select|revalidate[A-Za-z]*)$/.test(node.expression.text)
      || node.expression.text === "Date";
  }

  return ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Date";
}

describe("admin feature flag writers are fail-closed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminOrDeveloper.mockResolvedValue(undefined);
  });

  it("denies each authorized writer before every database port", async () => {
    const actions = await import("@/app/actions/admin.actions");
    const calls = [
      () => actions.toggleFeatureFlag("module_scan", true),
      () => actions.updateFeatureFlagRoles("perm_op_status", ["admin"]),
      () => actions.initializeDefaultFlags(),
    ];

    for (const call of calls) {
      await expect(call()).rejects.toThrow(denial);
    }

    expect(mockRequireAdminOrDeveloper).toHaveBeenCalledTimes(3);
    expectDatabasePortsUntouched();
  });

  it("propagates guard rejection without database access", async () => {
    const guardError = new Error("ADMIN_DENIED");
    mockRequireAdminOrDeveloper.mockRejectedValue(guardError);
    const actions = await import("@/app/actions/admin.actions");

    await expect(actions.toggleFeatureFlag("module_scan", true)).rejects.toBe(guardError);
    await expect(actions.updateFeatureFlagRoles("perm_op_status", ["admin"])).rejects.toBe(guardError);
    await expect(actions.initializeDefaultFlags()).rejects.toBe(guardError);

    expect(mockRequireAdminOrDeveloper).toHaveBeenCalledTimes(3);
    expectDatabasePortsUntouched();
  });

  it("keeps only the three feature writer bodies guard-first and side-effect-free", async () => {
    const source = await readFile("src/app/actions/admin.actions.ts", "utf8");
    const sourceFile = parseSource(source, "admin.actions.ts", ts.ScriptKind.TS);
    const names = ["toggleFeatureFlag", "updateFeatureFlagRoles", "initializeDefaultFlags"];
    const writers = findNodes(sourceFile, ts.isFunctionDeclaration).filter(
      (declaration) => declaration.name !== undefined && names.includes(declaration.name.text),
    );

    expect(writers).toHaveLength(3);
    expect(writers.map((writer) => writer.name!.text).sort()).toEqual([...names].sort());

    for (const writer of writers) {
      const statements = writer.body!.statements;
      expect(isGuardFirst(statements[0])).toBe(true);
      const denialStatementIndex = statements.findIndex(
        (statement) => ts.isThrowStatement(statement) && statement.getText(sourceFile).includes(denial),
      );
      expect(denialStatementIndex).toBeGreaterThan(0);
      expect(findNodes(writer.body!, (node): node is ts.Node => isForbiddenPort(node))).toEqual([]);
    }
  });

  it("keeps feature and role UIs read-only with concrete disabled controls", async () => {
    const [featureSource, roleSource, actionSource] = await Promise.all([
      readFile("src/components/admin/FeatureToggles.tsx", "utf8"),
      readFile("src/components/admin/RoleMatrix.tsx", "utf8"),
      readFile("src/app/actions/admin.actions.ts", "utf8"),
    ]);

    expect(actionSource).toContain("export async function getUsers()");
    expect(actionSource).toContain("export async function getFeatureFlags()");
    for (const source of [featureSource, roleSource]) {
      expect(source).toContain('import { getFeatureFlags } from "@/app/actions/admin.actions";');
      expect(source).toContain("getFeatureFlags()");
      expect(source).toContain(denial);
      for (const writer of ["toggleFeatureFlag", "updateFeatureFlagRoles", "initializeDefaultFlags"]) {
        expect(source).not.toContain(writer);
      }
    }

    const featureAst = parseSource(featureSource, "FeatureToggles.tsx", ts.ScriptKind.TSX);
    const roleAst = parseSource(roleSource, "RoleMatrix.tsx", ts.ScriptKind.TSX);
    const buttons = findNodes(featureAst, (node): node is ts.JsxOpeningLikeElement =>
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && ts.isIdentifier(node.tagName)
      && node.tagName.text === "button",
    );
    const checkboxInputs = findNodes(roleAst, (node): node is ts.JsxOpeningLikeElement => {
      if (!(ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))) return false;
      if (!ts.isIdentifier(node.tagName) || node.tagName.text !== "input") return false;
      const type = jsxAttribute(node, "type");
      return type?.initializer !== undefined
        && ts.isStringLiteral(type.initializer)
        && type.initializer.text === "checkbox";
    });

    expect(buttons).toHaveLength(1);
    expect(isStandaloneBooleanAttribute(buttons[0], "disabled")).toBe(true);
    expect(jsxAttribute(buttons[0], "onClick")).toBeUndefined();
    expect(checkboxInputs).toHaveLength(1);
    expect(isStandaloneBooleanAttribute(checkboxInputs[0], "disabled")).toBe(true);
    expect(jsxAttribute(checkboxInputs[0], "onChange")).toBeUndefined();
  });
});
