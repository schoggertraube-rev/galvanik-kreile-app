import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  getOperationalOrders: vi.fn(),
  getOperationalOrderCount: vi.fn(),
  noStore: vi.fn(),
}));

vi.mock("next/cache", () => ({ unstable_noStore: ports.noStore }));
vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: ports.resolveAuthorization,
}));
vi.mock("@/lib/server/operationalOrders", () => ({
  getOperationalOrders: ports.getOperationalOrders,
  getOperationalOrderCount: ports.getOperationalOrderCount,
}));
vi.mock("@/lib/server/commands/orderStationCommand", () => ({
  transitionWareneingangToGalvanik: vi.fn(),
}));

const snapshot = (role: "readonly" | "buero" = "readonly") => ({
  userId: `${role}-user`,
  tenantId: "tenant-a",
  displayName: role,
  role,
  permissions: ["perm_view_leitstand"] as const,
  active: true as const,
});

function parseSource(fileName: string, source: string) {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function findFunction(sourceFile: ts.SourceFile, name: string): ts.FunctionDeclaration {
  const declaration = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  if (!declaration?.body) throw new Error(`Missing function: ${name}`);
  return declaration;
}

function findObjectMethod(sourceFile: ts.SourceFile, name: string): ts.MethodDeclaration {
  let found: ts.MethodDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (
      ts.isMethodDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
    ) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (!found?.body) throw new Error(`Missing object method: ${name}`);
  return found;
}

function callPositions(
  sourceFile: ts.SourceFile,
  root: ts.Node,
  identifier: string,
  dynamicModule?: string,
) {
  const positions: number[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const [argument] = node.arguments;
      const identifierCall =
        ts.isIdentifier(node.expression) && node.expression.text === identifier;
      const dynamicImport =
        dynamicModule !== undefined &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        argument !== undefined &&
        ts.isStringLiteral(argument) &&
        argument.text === dynamicModule;
      if (identifierCall || dynamicImport) positions.push(node.getStart(sourceFile));
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return positions;
}

function stripSqlComments(sql: string) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\r\n]*/g, " ");
}

function findDynamicImportBinding(
  sourceFile: ts.SourceFile,
  root: ts.Node,
  importedName: string,
) {
  const matches: Array<{ importCall: ts.CallExpression; localName: string }> = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer !== undefined &&
      ts.isAwaitExpression(node.initializer) &&
      ts.isCallExpression(node.initializer.expression)
    ) {
      const importCall = node.initializer.expression;
      const [argument] = importCall.arguments;
      if (
        importCall.expression.kind === ts.SyntaxKind.ImportKeyword &&
        argument !== undefined &&
        ts.isStringLiteral(argument) &&
        argument.text === "@/lib/server/operationalOrders"
      ) {
        for (const element of node.name.elements) {
          const exportedName = element.propertyName && ts.isIdentifier(element.propertyName)
            ? element.propertyName.text
            : ts.isIdentifier(element.name)
              ? element.name.text
              : undefined;
          if (exportedName === importedName && ts.isIdentifier(element.name)) {
            matches.push({ importCall, localName: element.name.text });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function directExecutedSqlTemplates(sourceFile: ts.SourceFile, root: ts.Node) {
  const templates: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "tx" &&
      node.expression.name.text === "execute" &&
      node.arguments.length === 1
    ) {
      const [query] = node.arguments;
      if (
        query !== undefined &&
        ts.isTaggedTemplateExpression(query) &&
        ts.isIdentifier(query.tag) &&
        query.tag.text === "sql"
      ) {
        templates.push(query.template.getText(sourceFile));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return templates;
}

describe("W4 operational order read actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ports.resolveAuthorization.mockResolvedValue({ ok: true, data: snapshot() });
    ports.getOperationalOrders.mockResolvedValue([]);
    ports.getOperationalOrderCount.mockResolvedValue(0);
  });

  it.each(["readonly", "buero"] as const)(
    "allows %s to read only through the resolved tenant snapshot",
    async (role) => {
      const authorization = snapshot(role);
      ports.resolveAuthorization.mockResolvedValueOnce({ ok: true, data: authorization });
      const { getOrdersDb } = await import("../orders.actions");

      await expect(getOrdersDb()).resolves.toEqual({ ok: true, data: [] });

      expect(ports.resolveAuthorization).toHaveBeenCalledOnce();
      expect(ports.getOperationalOrders).toHaveBeenCalledWith(authorization);
      expect(ports.resolveAuthorization.mock.invocationCallOrder[0]).toBeLessThan(
        ports.getOperationalOrders.mock.invocationCallOrder[0],
      );
    },
  );

  it("uses the same guarded port contract for a safe count", async () => {
    const authorization = snapshot("buero");
    ports.resolveAuthorization.mockResolvedValueOnce({ ok: true, data: authorization });
    ports.getOperationalOrderCount.mockResolvedValueOnce(7);
    const { getOrderCountDb } = await import("../orders.actions");

    await expect(getOrderCountDb()).resolves.toEqual({ ok: true, data: { count: 7 } });
    expect(ports.getOperationalOrderCount).toHaveBeenCalledWith(authorization);
  });

  it("keeps session, capability, resolver, and query failures neutral and outside the read port", async () => {
    const { getOrdersDb } = await import("../orders.actions");

    ports.resolveAuthorization.mockResolvedValueOnce({
      ok: false,
      reason: "INVALID_SESSION",
      message: "raw resolver detail",
    });
    await expect(getOrdersDb()).resolves.toEqual({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Sitzung oder Berechtigung ist nicht verfügbar.",
    });

    ports.resolveAuthorization.mockResolvedValueOnce({
      ok: true,
      data: { ...snapshot(), permissions: [] },
    });
    await expect(getOrdersDb()).resolves.toEqual({
      ok: false,
      error: "FORBIDDEN",
      message: "Auftragsansicht ist nicht erlaubt.",
    });

    ports.resolveAuthorization.mockRejectedValueOnce(new Error("raw resolver throw"));
    await expect(getOrdersDb()).resolves.toEqual({
      ok: false,
      error: "DB_ERROR",
      message: "Auftragsdaten sind derzeit nicht verfügbar.",
    });

    expect(ports.getOperationalOrders).not.toHaveBeenCalled();

    ports.resolveAuthorization.mockResolvedValueOnce({ ok: true, data: snapshot() });
    ports.getOperationalOrders.mockRejectedValueOnce(new Error("raw query detail"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await getOrdersDb();
    errorSpy.mockRestore();
    expect(result).toEqual({
      ok: false,
      error: "DB_ERROR",
      message: "Auftragsdaten konnten nicht sicher geladen werden.",
    });
    expect(result).not.toHaveProperty("details");
  });

  it("accepts no tenant argument and ignores an adversarial runtime argument", async () => {
    const { getOrdersDb } = await import("../orders.actions");
    const adversarialCall = getOrdersDb as unknown as (
      input: { tenantId: string },
    ) => ReturnType<typeof getOrdersDb>;

    await expect(adversarialCall({ tenantId: "tenant-b" })).resolves.toEqual({
      ok: true,
      data: [],
    });
    expect(ports.getOperationalOrders).toHaveBeenCalledWith(snapshot());
    expect(ports.getOperationalOrders).not.toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-b" }),
    );
  });

  it("source-locks post-guard dynamic loading, one uncached v1 reader, and no repository fallback", async () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
    const [actions, adapter, reader, repository] = await Promise.all([
      readFile(path.join(root, "app/actions/orders.actions.ts"), "utf8"),
      readFile(path.join(root, "lib/server/operationalOrders.ts"), "utf8"),
      readFile(path.join(root, "lib/server/orderStationRead.ts"), "utf8"),
      readFile(path.join(root, "lib/repositories/ordersRepository.ts"), "utf8"),
    ]);

    const actionSource = parseSource("orders.actions.ts", actions);
    const staticOperationalImports = actionSource.statements
      .filter(ts.isImportDeclaration)
      .filter((statement) => ts.isStringLiteral(statement.moduleSpecifier))
      .map((statement) => (statement.moduleSpecifier as ts.StringLiteral).text)
      .filter((moduleName) => moduleName === "@/lib/server/operationalOrders");
    expect(staticOperationalImports).toEqual([]);

    for (const [functionName, readerName] of [
      ["getOrdersDb", "getOperationalOrders"],
      ["getOrderCountDb", "getOperationalOrderCount"],
    ] as const) {
      const fn = findFunction(actionSource, functionName);
      const guard = callPositions(
        actionSource,
        fn,
        "resolveOperationalReadAuthorization",
      );
      const dynamicBinding = findDynamicImportBinding(actionSource, fn, readerName);
      const readerCalls = callPositions(actionSource, fn, dynamicBinding.localName);
      expect(guard).toHaveLength(1);
      expect(readerCalls).toHaveLength(1);
      expect(guard[0]).toBeLessThan(dynamicBinding.importCall.getStart(actionSource));
      expect(dynamicBinding.importCall.getStart(actionSource)).toBeLessThan(readerCalls[0]);
    }
    const actionStringLiterals: string[] = [];
    const visitAction = (node: ts.Node) => {
      if (ts.isStringLiteral(node)) actionStringLiterals.push(node.text);
      ts.forEachChild(node, visitAction);
    };
    visitAction(actionSource);
    expect(actionStringLiterals).not.toContain("galvanik-kreile");

    const adapterSource = parseSource("operationalOrders.ts", adapter);
    expect(
      adapterSource.statements.some(
        (statement) =>
          ts.isImportDeclaration(statement) &&
          ts.isStringLiteral(statement.moduleSpecifier) &&
          statement.moduleSpecifier.text === "server-only",
      ),
    ).toBe(true);
    const adapterFunctions = adapterSource.statements
      .filter(ts.isFunctionDeclaration)
      .map((declaration) => declaration.name?.text);
    expect(adapterFunctions).not.toContain("getOperationalOrdersByStation");
    expect(adapterFunctions).not.toContain("getOperationalOrdersReadyForStation");
    expect(adapterFunctions).not.toContain("getOperationalOrdersForCustomer");
    const adapterIdentifiers: string[] = [];
    const visitAdapter = (node: ts.Node) => {
      if (ts.isIdentifier(node)) adapterIdentifiers.push(node.text);
      ts.forEachChild(node, visitAdapter);
    };
    visitAdapter(adapterSource);
    for (const forbiddenIdentifier of [
      "_ordersCache",
      "CACHE_TTL_MS",
      "invalidateOperationalOrdersCache",
    ]) {
      expect(adapterIdentifiers).not.toContain(forbiddenIdentifier);
    }

    const readerSource = parseSource("orderStationRead.ts", reader);
    for (const functionName of [
      "readTenantOperationalOrders",
      "readTenantOperationalOrderCount",
    ]) {
      const fn = findFunction(readerSource, functionName);
      const queryTemplates = directExecutedSqlTemplates(readerSource, fn);
      expect(queryTemplates).toHaveLength(1);
      expect(
        queryTemplates.some((template) =>
          /\bFROM\s+private\.v_operational_station_queue_v1\b/i.test(
            stripSqlComments(template),
          ),
        ),
      ).toBe(true);
    }

    const repositorySource = parseSource("ordersRepository.ts", repository);
    const getAll = findObjectMethod(repositorySource, "getAll");
    const getAllIdentifiers: string[] = [];
    let arrayFallback = false;
    let throwCount = 0;
    const visitGetAll = (node: ts.Node) => {
      if (ts.isIdentifier(node)) getAllIdentifiers.push(node.text);
      if (
        ts.isReturnStatement(node) &&
        node.expression !== undefined &&
        ts.isArrayLiteralExpression(node.expression)
      ) {
        arrayFallback = true;
      }
      if (ts.isThrowStatement(node)) throwCount += 1;
      ts.forEachChild(node, visitGetAll);
    };
    visitGetAll(getAll);
    expect(getAllIdentifiers).not.toContain("isSupabase");
    expect(arrayFallback).toBe(false);
    expect(throwCount).toBeGreaterThan(0);
  });

  it("makes repository getAll reject every failure and resolve empty only on explicit success", async () => {
    const repositoryRead = vi.fn();
    vi.resetModules();
    vi.doMock("@/app/actions/orders.actions", () => ({
      getOrdersDb: repositoryRead,
      updateOrderDb: vi.fn(),
    }));

    try {
      const { ordersRepository } = await import("@/lib/repositories/ordersRepository");
      for (const error of ["UNAUTHORIZED", "FORBIDDEN", "DB_ERROR"] as const) {
        repositoryRead.mockResolvedValueOnce({
          ok: false,
          error,
          message: "neutral",
        });
        await expect(ordersRepository.getAll()).rejects.toThrow(error);
      }

      repositoryRead.mockRejectedValueOnce(new Error("transport rejected"));
      await expect(ordersRepository.getAll()).rejects.toThrow("transport rejected");

      repositoryRead.mockResolvedValueOnce({ ok: true, data: [] });
      await expect(ordersRepository.getAll()).resolves.toEqual([]);
    } finally {
      vi.doUnmock("@/app/actions/orders.actions");
      vi.resetModules();
    }
  });

  it("keeps the legacy classifier fail-closed without any data port", () => {
    const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
    const projectRoot = path.resolve(srcRoot, "..");
    const scriptPath = path.join(projectRoot, "scripts/fetch_and_classify_orders.ts");
    const expectedMessage =
      "NOT_AVAILABLE: Auftragsklassifizierung benötigt einen autorisierten tenantgebundenen Read-Vertrag.";
    const expectedSource = `process.stderr.write(
  "${expectedMessage}\\n",
);
process.exitCode = 1;
`;

    const source = readFileSync(scriptPath, "utf8").replace(/\r\n/g, "\n");
    expect(source).toBe(expectedSource);

    const execution = spawnSync(
      process.execPath,
      ["--import", "tsx", scriptPath],
      { cwd: projectRoot, encoding: "utf8" },
    );
    expect(execution.error).toBeUndefined();
    expect(execution.status).toBe(1);
    expect(execution.stdout).toBe("");
    expect(execution.stderr).toBe(`${expectedMessage}\n`);
  });
});
