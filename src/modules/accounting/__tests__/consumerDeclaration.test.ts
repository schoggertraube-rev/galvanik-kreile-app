import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function diagnosticsText(diagnostics: readonly ts.Diagnostic[]): string {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => root,
    getNewLine: () => "\n",
  });
}

function sourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path));
    else if (/\.[cm]?[jt]sx?$/.test(entry)) files.push(path);
  }
  return files;
}

describe("Accounting public declaration and import containment", () => {
  it("emits the actual public/server-public declarations and typechecks a real consumer", () => {
    const temp = mkdtempSync(join(tmpdir(), "kreile-accounting-declarations-"));
    const outDir = join(temp, "out");
    try {
      const configPath = join(root, "tsconfig.json");
      const config = ts.readConfigFile(configPath, ts.sys.readFile);
      expect(config.error, config.error ? diagnosticsText([config.error]) : "").toBeUndefined();
      const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
      const emitOptions: ts.CompilerOptions = {
        ...parsed.options,
        noEmit: false,
        declaration: true,
        declarationMap: false,
        emitDeclarationOnly: true,
        incremental: false,
        composite: false,
        outDir,
        rootDir: join(root, "src"),
        tsBuildInfoFile: undefined,
      };
      const facadeRoots = [
        join(root, "src/modules/accounting/public.ts"),
        join(root, "src/modules/accounting/server-public.ts"),
      ];
      const declarationProgram = ts.createProgram(facadeRoots, emitOptions);
      const declarationDiagnostics = ts.getPreEmitDiagnostics(declarationProgram);
      expect(diagnosticsText(declarationDiagnostics)).toBe("");
      const emitted = declarationProgram.emit();
      expect(emitted.emitSkipped).toBe(false);

      const publicDeclaration = join(outDir, "modules/accounting/public.d.ts");
      const serverDeclaration = join(outDir, "modules/accounting/server-public.d.ts");
      expect(existsSync(publicDeclaration)).toBe(true);
      expect(existsSync(serverDeclaration)).toBe(true);

      const consumerPath = join(temp, "consumer.ts");
      writeFileSync(consumerPath, `
        import { ACCOUNTING_CORE_CONTRACT_VERSION } from "./out/modules/accounting/public";
        import type {
          InvoiceIssuedReceiptV1,
          ReadEnvelopeV1,
        } from "./out/modules/accounting/public";
        import {
          issueInvoiceCommand,
          recoverInvoiceIssueCommand,
        } from "./out/modules/accounting/server-public";
        import type {
          CreateInvoiceResult,
          RecoveryCommandInput,
        } from "./out/modules/accounting/server-public";

        declare const query: RecoveryCommandInput;
        declare const read: ReadEnvelopeV1<InvoiceIssuedReceiptV1>;
        const version: "1.0.0-candidate.1" = ACCOUNTING_CORE_CONTRACT_VERSION;
        const command: Promise<CreateInvoiceResult> = issueInvoiceCommand({
          orderId: "order-a",
          expectedVersion: 1,
          clientEventId: "11111111-1111-4111-8111-111111111111",
        });
        const recovery = recoverInvoiceIssueCommand(query);
        void [version, command, recovery, read];
      `, "utf8");
      const consumerOptions: ts.CompilerOptions = {
        ...parsed.options,
        noEmit: true,
        incremental: false,
        tsBuildInfoFile: undefined,
        baseUrl: root,
        paths: { "@/*": ["src/*"] },
      };
      const consumerProgram = ts.createProgram([consumerPath], consumerOptions);
      expect(diagnosticsText(ts.getPreEmitDiagnostics(consumerProgram))).toBe("");

      const invalidConsumerPath = join(temp, "invalid-consumer.ts");
      writeFileSync(invalidConsumerPath, `
        import type { InvoiceIssuedReceiptV1 } from "./out/modules/accounting/public";
        import type { RecoveryCommandInput } from "./out/modules/accounting/server-public";
        declare const base: Omit<InvoiceIssuedReceiptV1, "vatRateBasisPoints">;
        const invalidNewExecutionProof: InvoiceIssuedReceiptV1 = {
          ...base,
          vatRateBasisPoints: 700,
        };
        const clientControlledTenant: RecoveryCommandInput = {
          kind: "invoice_issued",
          tenantId: "client-tenant",
          intentId: "11111111-1111-4111-8111-111111111111",
          idempotencyKey: "11111111-1111-4111-8111-111111111111",
          aggregateId: "order-a",
          expectedVersion: 1,
          expectedAmount: null,
          expectedMethod: null,
          expectedReason: null,
        };
        void [invalidNewExecutionProof, clientControlledTenant];
      `, "utf8");
      const invalidConsumerProgram = ts.createProgram([invalidConsumerPath], consumerOptions);
      const invalidDiagnostics = diagnosticsText(ts.getPreEmitDiagnostics(invalidConsumerProgram));
      expect(invalidDiagnostics).toContain("Type '700' is not assignable to type '1900'");
      expect(invalidDiagnostics).toContain("'tenantId' does not exist in type 'RecoveryCommandInput'");
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }, 60_000);

  it("contains host imports in one adapter and forces product consumers through facades", () => {
    const accountingRoot = join(root, "src/modules/accounting");
    const productionFiles = sourceFiles(accountingRoot)
      .filter((path) => !path.includes(`${join("accounting", "__tests__")}`));
    const hostImports = productionFiles.filter((path) => readFileSync(path, "utf8").includes("@/lib/server/"));
    expect(hostImports.map((path) => relative(root, path).replaceAll("\\", "/")))
      .toEqual(["src/modules/accounting/server/hostAdapter.ts"]);

    for (const path of sourceFiles(join(root, "src"))) {
      if (path.includes(`${join("accounting", "__tests__")}`)) continue;
      const relativePath = relative(root, path).replaceAll("\\", "/");
      const source = readFileSync(path, "utf8");
      if (!relativePath.startsWith("src/modules/accounting/")) {
        expect(source, `${relativePath} bypasses the accounting facades`)
          .not.toMatch(/@\/modules\/accounting\/(?:core|server)(?:\/|["'])/);
      }
      if (relativePath.startsWith("src/modules/accounting/core/")) {
        expect(source, `${relativePath} is not host-neutral`).not.toContain("@/");
      }
    }

    for (const action of ["invoices.actions.ts", "payments.actions.ts"]) {
      const source = readFileSync(resolve(root, "src/app/actions", action), "utf8");
      expect(source).toContain("@/modules/accounting/server-public");
      expect(source).not.toContain("@/lib/server/");
      expect(source).not.toMatch(/@\/modules\/accounting\/(?:core|server)\//);
    }
  });
});
