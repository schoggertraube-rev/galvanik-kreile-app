import { readFile } from "node:fs/promises";
import { createElement } from "react";
import ts from "typescript";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanySettingsForm } from "@/components/admin/CompanySettingsForm";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";

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
  mockResolveAuthorization,
  mockHasAuthorizationArea,
  mockWithPrivilegedTenantTransaction,
  mockExecute,
  mockQrToDataUrl,
  mockRenderToBuffer,
  mockCreateOrderLabelPdfDocument,
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
    mockResolveAuthorization: vi.fn(),
    mockHasAuthorizationArea: vi.fn(),
    mockWithPrivilegedTenantTransaction: vi.fn(),
    mockExecute: vi.fn(),
    mockQrToDataUrl: vi.fn(),
    mockRenderToBuffer: vi.fn(),
    mockCreateOrderLabelPdfDocument: vi.fn(),
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
vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: mockResolveAuthorization,
  hasAuthorizationArea: mockHasAuthorizationArea,
}));
vi.mock("@/lib/server/privilegedDb", () => ({
  withPrivilegedTenantTransaction: mockWithPrivilegedTenantTransaction,
}));
vi.mock("@/lib/pdf/OrderLabel", () => ({
  createOrderLabelPdfDocument: mockCreateOrderLabelPdfDocument,
}));
vi.mock("qrcode", () => ({ default: { toDataURL: mockQrToDataUrl } }));
vi.mock("@react-pdf/renderer", () => ({ renderToBuffer: mockRenderToBuffer }));

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
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === "companySettingsRepository"
      && node.initializer
      && ts.isObjectLiteralExpression(node.initializer)
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
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) importedModules.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) {
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

const authorized = {
  userId: "11111111-1111-4111-8111-111111111111",
  tenantId: KREILE_TENANT_SLUG,
  displayName: "Rolf",
  role: "meister",
  areas: ["eingang"],
  permissions: [],
  active: true,
} as const;

describe("W2C company settings read containment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminOrDeveloper.mockResolvedValue(undefined);
    mockIsOffline.mockReturnValue(false);
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockResolveAuthorization.mockResolvedValue({ ok: true, data: authorized });
    mockHasAuthorizationArea.mockReturnValue(true);
    mockWithPrivilegedTenantTransaction.mockImplementation(async (_authorization: unknown, work: (tx: { execute: typeof mockExecute }) => Promise<unknown>) => work({ execute: mockExecute }));
    mockQrToDataUrl.mockResolvedValue("data:image/png;base64,qr");
    mockCreateOrderLabelPdfDocument.mockReturnValue({ type: "label" });
    mockRenderToBuffer.mockResolvedValue(Buffer.from("%PDF-label"));
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

  it("rejects label generation before every data and PDF port without a login", async () => {
    mockResolveAuthorization.mockResolvedValue({ ok: false, reason: "NO_SESSION", message: "Nicht angemeldet" });
    const { generateOrderLabel } = await import("@/app/actions/pdf.actions");

    await expect(generateOrderLabel("order-1")).rejects.toThrow("LABEL_UNAUTHENTICATED");

    expect(mockWithPrivilegedTenantTransaction).not.toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();
    expect(mockQrToDataUrl).not.toHaveBeenCalled();
    expect(mockRenderToBuffer).not.toHaveBeenCalled();
  });

  it("rejects label generation before every data and PDF port without an allowed area", async () => {
    mockHasAuthorizationArea.mockReturnValue(false);
    const { generateOrderLabel } = await import("@/app/actions/pdf.actions");

    await expect(generateOrderLabel("order-1")).rejects.toThrow("LABEL_FORBIDDEN");

    expect(mockWithPrivilegedTenantTransaction).not.toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();
    expect(mockQrToDataUrl).not.toHaveBeenCalled();
    expect(mockRenderToBuffer).not.toHaveBeenCalled();
  });

  it("renders exactly one authorized label from one tenant-bound source query", async () => {
    mockExecute.mockResolvedValue([{
      id: "order-1",
      order_number: "A-2026-0001",
      customer_name: "Kreile Kunde",
      due_date: "2026-11-08",
      intake_date: "2026-11-06",
      positions: [{ quantity: "2", unit: "stueck" }],
    }]);
    const { generateOrderLabel } = await import("@/app/actions/pdf.actions");

    await expect(generateOrderLabel("order-1")).resolves.toBe(Buffer.from("%PDF-label").toString("base64"));

    expect(mockWithPrivilegedTenantTransaction).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockQrToDataUrl).toHaveBeenCalledWith("KREILE:A-2026-0001", expect.objectContaining({ margin: 0 }));
    expect(mockCreateOrderLabelPdfDocument).toHaveBeenCalledWith(expect.objectContaining({
      orderNumber: "A-2026-0001",
      partSummary: "2 Stück",
    }));
    expect(mockRenderToBuffer).toHaveBeenCalledTimes(1);
  });

  it("keeps the delivery note and company-settings reader fail-closed", async () => {
    const { companySettingsRepository } = await import("@/lib/repositories/companySettingsRepository");
    const companySettingsGetSettings = vi.spyOn(companySettingsRepository, "getSettings");
    const { generateDeliveryNote } = await import("@/app/actions/pdf.actions");

    await expect(generateDeliveryNote("order-3")).rejects.toThrow(readDenial);

    expect(companySettingsGetSettings).not.toHaveBeenCalled();
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

  it("proves the delivery note stays denied and the label stays tenant-authorized", async () => {
    const [repositorySource, pdfSource] = await Promise.all([
      readFile("src/lib/repositories/companySettingsRepository.ts", "utf8"),
      readFile("src/app/actions/pdf.actions.ts", "utf8"),
    ]);
    const repository = sourceFile(repositorySource, "companySettingsRepository.ts");
    const pdf = sourceFile(pdfSource, "pdf.actions.ts");
    const getSettings = getSettingsMethod(repository);
    const deliveryNote = functionDeclaration(pdf, "generateDeliveryNote");

    expectExactDenial(getSettings, readDenial, 1);
    expectExactDenial(deliveryNote, readDenial, 2);
    expectNoRuntimePortImports(repository, ["@/lib/offline/OfflineManager", "@/lib/supabase/client"]);
    expectNoPortNodes(getSettings, ["OfflineManager", "createClient", "from", "select", "eq", "single"]);
    expect(pdfSource).toContain("resolveAuthorization");
    expect(pdfSource).toContain("hasAuthorizationArea");
    expect(pdfSource).toContain("withPrivilegedTenantTransaction");
    expect(pdfSource).toContain("orders.tenant_id");
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
