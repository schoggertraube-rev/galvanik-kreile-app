import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("bookkeeping export truth", () => {
  it("uses the real provider for all three downloadable formats", () => {
    const client = source("src/app/buchhaltung/export/ExportClient.tsx");
    expect(client).toContain("provider.exportDatev");
    expect(client).toContain("provider.exportLexware");
    expect(client).toContain("provider.exportSteuerberaterPaket");
    expect(client).toContain("result.anzahlBuchungen");
    expect(client).toContain("URL.revokeObjectURL");
    expect(client).not.toContain("generateDatevExportAction");
    expect(client).not.toContain("STEUERBERATER_ZIP");
  });

  it("does not advertise files which are absent from the ZIP", () => {
    const client = source("src/app/buchhaltung/export/ExportClient.tsx");
    const provider = source("src/lib/buchhaltung/providers/SupabaseBuchhaltungProvider.ts");
    for (const fabricated of ["BWA_2026-05.pdf", "UStVA_2026-05.pdf", "shell-frankfurt-ost.pdf", "gasthaus-adler.pdf"]) {
      expect(client).not.toContain(fabricated);
    }
    expect(client).toContain("Keine Belegbilder/PDFs");
    expect(provider).toContain("receiptsIncluded: false");
    expect(provider).toContain("manifest.json");
  });

  it("does not create a mismatched generic preview on the server page", () => {
    const page = source("src/app/buchhaltung/export/page.tsx");
    expect(page).not.toContain("exportBelegeAction");
    expect(page).not.toContain("previewData");
    expect(page).toContain("FORMATS.has");
  });

  it("quotes dynamic CSV cells and neutralizes spreadsheet formulas", () => {
    const actions = source("src/app/buchhaltung/actions.ts");
    expect(actions).toContain("function csvCell");
    expect(actions).toContain("/^[=+\\-@]/");
    expect(actions).toContain("replaceAll");
    expect(actions.match(/\.map\(csvCell\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(actions).not.toContain('"${b.lieferant_text');
  });
});
