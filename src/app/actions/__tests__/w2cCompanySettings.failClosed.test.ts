import { readFile } from "node:fs/promises";
import { createElement } from "react";
import ts from "typescript";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanySettingsForm } from "@/components/admin/CompanySettingsForm";

const readDenial = "NOT_AVAILABLE: Firmendaten-Anzeige benötigt einen tenant- und capability-geprüften W3-Read-Vertrag.";
const writeDenial = "NOT_AVAILABLE: Sichere Firmendatenänderung benötigt den W3-Command-Vertrag.";
const {
  mockRequireAdminOrDeveloper,
  mockIsOffline,
  mockCreateClient,
  mockFrom,
  mockSelect,
  mockEq,
  mockSingle,
  mockOrdersGetAll,
  mockCustomersGetAll,
  mockQrToDataUrl,
  mockRenderToStream,
  mockDate,
} = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockEq = vi.fn(() => ({ single: mockSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ select: mockSelect }));

  return {
    mockRequireAdminOrDeveloper: vi.fn(),
    mockIsOffline: vi.fn(),
    mockCreateClient: vi.fn(() => ({ from: mockFrom })),
    mockFrom,
    mockSelect,
    mockEq,
    mockSingle,
    mockOrdersGetAll: vi.fn(),
    mockCustomersGetAll: vi.fn(),
    mockQrToDataUrl: vi.fn(),
    mockRenderToStream: vi.fn(),
    mockDate: vi.fn(),
  };
});

vi.mock("@/lib/auth/permissions", () => ({
  requireAdminOrDeveloper: mockRequireAdminOrDeveloper,
}));
vi.mock("@/lib/offline/OfflineManager", () => ({
  OfflineManager: { isOffline: mockIsOffline },
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: mockCreateClient }));
vi.mock("@/lib/repositories/ordersRepository", () => ({
  ordersRepository: { getAll: mockOrdersGetAll },
}));
vi.mock("@/lib/repositories/customersRepository", () => ({
  customersRepository: { getAll: mockCustomersGetAll },
}));
vi.mock("qrcode", () => ({ default: { toDataURL: mockQrToDataUrl } }));
vi.mock("@react-pdf/renderer", () => ({ renderToStream: mockRenderToStream }));

const sourceFile = (source: string, fileName: string) =>
  ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function functionDeclaration(source: ts.SourceFile, name: string): ts.FunctionDeclaration {
  const declaration = source.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  expect(declaration, `${name} must be declared`).toBeDefined();
  return declaration!;
}

function getSettingsMethod(source: ts.SourceFile): ts.MethodDeclaration {
  let method: ts.MethodDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "companySettingsRepository" &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      method = node.initializer.properties.find(
        (property): property is ts.MethodDeclaration =>
          ts.isMethodDeclaration(property) && ts.isIdentifier(property.name) && property.name.text === "getSettings",
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  expect(method, "companySettingsRepository.getSettings must be declared").toBeDefined();
  return method!;
}

function expectExactDenial(functionLike: ts.FunctionLikeDeclaration, denial: string, expectedStatementCount: number) {
  expect(functionLike.body).toBeDefined();
  expect(ts.isBlock(functionLike.body!)).toBe(true);
  if (!ts.isBlock(functionLike.body!)) throw new Error("Expected a block body");
  const statements = functionLike.body.statements;
  expect(statements).toHaveLength(expectedStatementCount);
  const denialStatement = statements[statements.length - 1];
  expect(ts.isThrowStatement(denialStatement)).toBe(true);
  expect(denialStatement.getText()).toBe(`throw new Error("${denial}");`);
}

function expectNoRuntimePortImports(source: ts.SourceFile, moduleNames: string[]) {
  const importedModules: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      importedModules.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      importedModules.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  expect(importedModules.filter((moduleName) => moduleNames.includes(moduleName))).toEqual([]);
}

function expectNoPortNodes(functionLike: ts.FunctionLikeDeclaration, identifiers: string[]) {
  const calls: ts.CallExpression[] = [];
  const foundIdentifiers: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) calls.push(node);
    if (ts.isIdentifier(node) && identifiers.includes(node.text)) foundIdentifiers.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(functionLike.body!);
  expect(calls).toEqual([]);
  expect(foundIdentifiers).toEqual([]);
}

describe("W2C company settings read containment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminOrDeveloper.mockResolvedValue(undefined);
    mockIsOffline.mockReturnValue(false);
    mockSingle.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("denies getCompanySettings before a repository read", async () => {
    const { companySettingsRepository } = await import("@/lib/repositories/companySettingsRepository");
    const repositoryRead = vi.spyOn(companySettingsRepository, "getSettings");
    const { getCompanySettings } = await import("@/app/actions/company.actions");

    await expect(getCompanySettings()).rejects.toThrow(readDenial);
    expect(repositoryRead).not.toHaveBeenCalled();
  });

  it("denies direct repository reads without any browser or Supabase port", async () => {
    const { companySettingsRepository } = await import("@/lib/repositories/companySettingsRepository");
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("Date", mockDate);

    await expect(companySettingsRepository.getSettings()).rejects.toThrow(readDenial);

    expect(mockIsOffline).not.toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockEq).not.toHaveBeenCalled();
    expect(mockSingle).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(mockDate).not.toHaveBeenCalled();
  });

  it("denies both PDF entry points before every PDF and repository port", async () => {
    const { companySettingsRepository } = await import("@/lib/repositories/companySettingsRepository");
    const companySettingsGetSettings = vi.spyOn(companySettingsRepository, "getSettings");
    const { generateDeliveryNote, generateOrderLabel } = await import("@/app/actions/pdf.actions");

    await expect(generateOrderLabel(["order-1", "order-2"])).rejects.toThrow(readDenial);
    await expect(generateDeliveryNote("order-3")).rejects.toThrow(readDenial);

    expect(mockOrdersGetAll).not.toHaveBeenCalled();
    expect(mockCustomersGetAll).not.toHaveBeenCalled();
    expect(companySettingsGetSettings).not.toHaveBeenCalled();
    expect(mockQrToDataUrl).not.toHaveBeenCalled();
    expect(mockRenderToStream).not.toHaveBeenCalled();
  });

  it("keeps the static header logo without a company-settings action", async () => {
    const source = await readFile("src/components/layout/KreileHeader.tsx", "utf8");

    expect(source).not.toContain("getCompanySettings");
    expect(source).toContain('const logoUrl = "/assets/logo/kreile-wordmark-skyline.svg";');
    expect(source).toContain("src={logoUrl}");
  });

  it("renders the unavailable form without editable controls or read dependencies", async () => {
    render(createElement(CompanySettingsForm));

    expect(screen.getByText(readDenial)).toBeVisible();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    const source = await readFile("src/components/admin/CompanySettingsForm.tsx", "utf8");
    for (const forbidden of ["getCompanySettings", "from \"@/lib/repositories/companySettingsRepository\"", "formData", "<input", "<textarea", "<button", "Loader", "fake", "default"]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("proves source-level denial structure without runtime read or PDF ports", async () => {
    const [repositorySource, pdfSource] = await Promise.all([
      readFile("src/lib/repositories/companySettingsRepository.ts", "utf8"),
      readFile("src/app/actions/pdf.actions.ts", "utf8"),
    ]);
    const repository = sourceFile(repositorySource, "companySettingsRepository.ts");
    const pdf = sourceFile(pdfSource, "pdf.actions.ts");
    const getSettings = getSettingsMethod(repository);
    const orderLabel = functionDeclaration(pdf, "generateOrderLabel");
    const deliveryNote = functionDeclaration(pdf, "generateDeliveryNote");

    expectExactDenial(getSettings, readDenial, 1);
    expectExactDenial(orderLabel, readDenial, 2);
    expectExactDenial(deliveryNote, readDenial, 2);
    expectNoRuntimePortImports(repository, ["@/lib/offline/OfflineManager", "@/lib/supabase/client"]);
    expectNoRuntimePortImports(pdf, [
      "@/lib/repositories/ordersRepository",
      "@/lib/repositories/customersRepository",
      "@/lib/repositories/companySettingsRepository",
      "qrcode",
      "@react-pdf/renderer",
    ]);
    expectNoPortNodes(getSettings, ["OfflineManager", "createClient", "from", "select", "eq", "single"]);
    expectNoPortNodes(orderLabel, ["ordersRepository", "customersRepository", "companySettingsRepository", "QRCode", "renderToStream"]);
    expectNoPortNodes(deliveryNote, ["ordersRepository", "customersRepository", "companySettingsRepository", "QRCode", "renderToStream"]);
  });

  it("retains write denials without calling their repository port", async () => {
    const { companySettingsRepository } = await import("@/lib/repositories/companySettingsRepository");
    const repositoryUpdate = vi.spyOn(companySettingsRepository, "updateSettings");
    const { updateCompanySettings } = await import("@/app/actions/company.actions");

    await expect(updateCompanySettings({ companyName: "Neu" })).rejects.toThrow(writeDenial);
    await expect(companySettingsRepository.updateSettings({ companyName: "Neu" })).rejects.toThrow(writeDenial);

    expect(mockRequireAdminOrDeveloper).toHaveBeenCalledTimes(1);
    expect(repositoryUpdate).toHaveBeenCalledTimes(1);
  });
});
