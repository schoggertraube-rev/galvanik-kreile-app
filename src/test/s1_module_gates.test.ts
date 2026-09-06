// @vitest-environment node
//
// S1 Beweis: jede Naht aus ARCHITEKTUR_MODULE_PATH1.md §2/§5 wird bei Verstoss ROT.
// Die Fixtures sind Mini-Repos in einem Temp-Ordner; das echte Schema wird 1:1 kopiert,
// damit die Pruefung gegen den realen Vertrag laeuft und nicht gegen eine Kopie.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BASELINE_PATH,
  SCHEMA_PATH,
  exportedSymbols,
  resolveSpec,
  runModuleGates,
  validateAgainstSchema,
  writeBaseline,
} from "../../scripts/quality/check-module-gates.mjs";

const REAL_SCHEMA = readFileSync(path.resolve(process.cwd(), SCHEMA_PATH), "utf8");
// Verworfene Bausteine/Texte werden zusammengesetzt, damit DIESE Datei den Naht-5-Scan
// des echten Repos nicht selbst ausloest.
const NAV = ["Warendurchlauf", "StationNav"].join("");
const STRIP = ["Workflow", "Strip"].join("");
const BAR = ["TopWorkflow", "Bar"].join("");
const TOGGLE = ["Theme", "Toggle"].join("");
const OPEN_TEXT = ["Station", "öffnen"].join(" ");
const IMP = ["im", "port"].join("");
const EXP = ["ex", "port"].join("");
const MOCK = ["vi.", "mock"].join("");
const temps: string[] = [];

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "s1-gates-"));
  temps.push(root);
  const all: Record<string, string> = {
    [SCHEMA_PATH]: REAL_SCHEMA,
    "AGENTS.md": "Bauanleitung: docs/project/linie/ARCHITEKTUR_MODULE_PATH1.md\n",
    ...files,
  };
  for (const [rel, content] of Object.entries(all)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

function manifest(id: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ moduleId: id, version: "1.0.0", owner: "kreile", publicExports: [], ...extra });
}

const goodModule = {
  "src/modules/orders/orders.manifest.json": manifest("orders", {
    publicExports: ["@/modules/orders/public#readOrder"],
    ownsTables: ["public.orders"],
    viewsFunctions: ["public.v_order_facts"],
  }),
  "src/modules/orders/public.ts": 'export { readOrder } from "./server/readOrder";\n',
  "src/modules/orders/server/readOrder.ts": "export const readOrder = () => sql`select id from public.orders`;\n",
};

afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

function findingsOf(root: string, opts?: { baseBaselinePath?: string }): string[] {
  return runModuleGates(root, opts).findings;
}

describe("S1 Naht 1 — Manifest je Modul + Ablage", () => {
  it("ein regelkonformes Modul ist gruen", () => {
    expect(findingsOf(repo(goodModule))).toEqual([]);
  });

  it("Modulordner ohne Manifest = FAIL", () => {
    const root = repo({ "src/modules/orders/public.ts": "export const x = 1;\n" });
    expect(findingsOf(root)).toEqual([expect.stringContaining("[naht1] src/modules/orders/orders.manifest.json: Manifest fehlt")]);
  });

  it("moduleId != Ordnername, fehlende public.ts, unbekanntes Feld, ungueltige version = FAIL", () => {
    const root = repo({
      "src/modules/orders/orders.manifest.json": JSON.stringify({ moduleId: "auftraege", version: "1", owner: "k", fremd: true }),
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("moduleId 'auftraege' != Ordnername 'orders'"));
    expect(f).toContainEqual(expect.stringContaining("public.ts fehlt"));
    expect(f).toContainEqual(expect.stringContaining("unbekanntes Feld 'fremd'"));
    expect(f).toContainEqual(expect.stringContaining("$.version: '1' verletzt pattern"));
  });

  it("publicExports muss die eigene Fassade sein und von public.ts exportiert werden", () => {
    const root = repo({
      ...goodModule,
      "src/modules/orders/orders.manifest.json": manifest("orders", {
        publicExports: ["@/modules/orders/public#missing", "@/lib/orders/x#readOrder", "@/modules/other/public#y"],
      }),
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("exportiert 'missing' nicht"));
    expect(f).toContainEqual(expect.stringContaining("'@/lib/orders/x#readOrder' muss '@/modules/orders/public#Symbol' sein"));
    expect(f).toContainEqual(expect.stringContaining("'@/modules/other/public#y' muss '@/modules/orders/public#Symbol' sein"));
  });

  it("dependencies muessen existierende Module sein; Selbstabhaengigkeit = FAIL", () => {
    const root = repo({
      ...goodModule,
      "src/modules/orders/orders.manifest.json": manifest("orders", { dependencies: ["orders", "auth"] }),
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("dependency 'auth' ist kein Modul"));
    expect(f).toContainEqual(expect.stringContaining("haengt von sich selbst ab"));
  });

  it("Fach mit Modul darf nicht mehr in app/components/lib/features liegen", () => {
    const root = repo({
      ...goodModule,
      "src/components/orders/OrderCard.tsx": "export const OrderCard = () => null;\n",
      "src/lib/orders/read.ts": "export const r = 1;\n",
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("[naht1] src/components/orders/OrderCard.tsx: Fach 'orders' hat ein Modul"));
    expect(f).toContainEqual(expect.stringContaining("[naht1] src/lib/orders/read.ts: Fach 'orders' hat ein Modul"));
  });

  it("Schema-Validator deckt object/required/additionalProperties/array/pattern/minLength ab", () => {
    const schema = JSON.parse(REAL_SCHEMA);
    expect(validateAgainstSchema({ moduleId: "a", version: "0.1.0", owner: "x" }, schema)).toEqual([]);
    expect(validateAgainstSchema({ moduleId: "A", version: "0.1.0", owner: "" }, schema)).toEqual([
      expect.stringContaining("$.moduleId: 'A' verletzt pattern"),
      expect.stringContaining("$.owner: kuerzer als minLength 1"),
    ]);
    expect(validateAgainstSchema({ moduleId: "a", version: "0.1.0", owner: "x", ownsTables: ["orders"] }, schema)).toEqual([
      expect.stringContaining("$.ownsTables[0]: 'orders' verletzt pattern"),
    ]);
    expect(validateAgainstSchema({ moduleId: "a", version: "0.1.0", owner: "x", storagePurposes: [{ bucket: "b" }] }, schema)).toEqual([
      expect.stringContaining("$.storagePurposes[0]: Pflichtfeld 'purpose' fehlt"),
    ]);
  });
});

describe("S1 Naht 2 — positive Fassade / Tiefimport-Verbot", () => {
  const consumer = { "src/modules/invoices/invoices.manifest.json": manifest("invoices"), "src/modules/invoices/public.ts": "export {};\n" };

  it("Import ueber @/modules/<fach>/public ist erlaubt (Alias und relativ)", () => {
    const root = repo({
      ...goodModule,
      ...consumer,
      "src/modules/invoices/server/a.ts": 'import { readOrder } from "@/modules/orders/public";\nexport const a = readOrder;\n',
      "src/modules/invoices/server/b.ts": 'import { readOrder } from "../../orders/public";\nexport const b = readOrder;\n',
      "src/app/page.tsx": 'import { readOrder } from "@/modules/orders/public";\nexport default readOrder;\n',
    });
    expect(findingsOf(root)).toEqual([]);
  });

  it("Tiefimport in ein Fremdmodul = FAIL (Alias, relativ, dynamic import, export-from, vi.mock)", () => {
    const root = repo({
      ...goodModule,
      ...consumer,
      // Die Import-Schluesselwoerter werden zusammengesetzt, damit DIESE Datei den
      // Naht-2-Scan des echten Repos nicht selbst ausloest.
      "src/modules/invoices/server/a.ts": `${IMP} { readOrder } from "@/modules/orders/server/readOrder";\n`,
      "src/modules/invoices/server/b.ts": `${IMP} { readOrder } from "../../orders/server/readOrder";\n`,
      "src/app/page.tsx": `const m = await ${IMP}("@/modules/orders/server/readOrder");\n`,
      "src/app/re.ts": `${EXP} * from "@/modules/orders/server/readOrder";\n`,
      "src/app/x.test.ts": `${MOCK}("@/modules/orders/server/readOrder", () => ({}));\n`,
      "src/app/root.ts": `${IMP} * as o from "@/modules/orders";\n`,
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("[naht2] src/modules/invoices/server/a.ts:1: Tiefimport '@/modules/orders/server/readOrder'"));
    expect(f).toContainEqual(expect.stringContaining("[naht2] src/modules/invoices/server/b.ts:1: Tiefimport '../../orders/server/readOrder'"));
    expect(f).toContainEqual(expect.stringContaining("[naht2] src/app/page.tsx:1: Tiefimport"));
    expect(f).toContainEqual(expect.stringContaining("[naht2] src/app/re.ts:1: Tiefimport"));
    expect(f).toContainEqual(expect.stringContaining("[naht2] src/app/x.test.ts:1: Tiefimport"));
    expect(f).toContainEqual(expect.stringContaining("[naht2] src/app/root.ts:1: Tiefimport '@/modules/orders'"));
    expect(f).toHaveLength(6);
  });

  it("Im eigenen Modul nur relative Imports; @/modules/<eigen>/... = FAIL", () => {
    const root = repo({
      ...goodModule,
      "src/modules/orders/ui/Card.tsx": `${IMP} { readOrder } from "@/modules/orders/server/readOrder";\nexport const Card = readOrder;\n`,
    });
    expect(findingsOf(root)).toEqual([expect.stringContaining("[naht2] src/modules/orders/ui/Card.tsx:1: Import im eigenen Modul muss relativ sein")]);
  });

  it("resolveSpec: Alias, relativ, Endungen, index; Pakete ignoriert", () => {
    expect(resolveSpec("src/app/page.tsx", "@/modules/orders/public")).toBe("src/modules/orders/public");
    expect(resolveSpec("src/modules/a/server/x.ts", "../../b/public.ts")).toBe("src/modules/b/public");
    // bewusst KEIN index-Kollaps (Red-Team P1): public/index ist nicht die Fassade
    expect(resolveSpec("src/modules/a/x.ts", "../b/server/index")).toBe("src/modules/b/server/index");
    expect(resolveSpec("src/app/page.tsx", "react")).toBeNull();
  });

  it("exportedSymbols erkennt Deklarationen und Re-Export-Listen inkl. as/type", () => {
    const names = exportedSymbols([
      "export const a = 1;",
      "export async function b() {}",
      "export type C = string;",
      "export { d, e as f, type G } from './x';",
      "export type { H } from './y';",
      "const hidden = 2;",
    ].join("\n"));
    expect([...names].sort()).toEqual(["C", "G", "H", "a", "b", "d", "f"]);
  });
});

describe("S1 Naht 4 — Cross-Modul-Fakten nur ueber v_*-Views", () => {
  it("eigene Tabellen und deklarierte v_*-Views sind erlaubt", () => {
    const root = repo({
      ...goodModule,
      "src/modules/invoices/invoices.manifest.json": manifest("invoices", { ownsTables: ["public.invoices", "private.invoice_numbers"] }),
      "src/modules/invoices/public.ts": "export {};\n",
      "src/modules/invoices/server/q.ts": [
        "export const q = sql`",
        "  UPDATE public.invoices SET x = 1;",
        "  INSERT INTO private.invoice_numbers (n) VALUES (1);",
        "  SELECT o.id FROM public.v_order_facts o JOIN public.invoices i ON i.order_id = o.id;",
        "`;",
      ].join("\n"),
    });
    expect(findingsOf(root)).toEqual([]);
  });

  it("Fremdtabelle direkt oder undeklarierte View = FAIL", () => {
    const root = repo({
      ...goodModule,
      "src/modules/invoices/invoices.manifest.json": manifest("invoices", { ownsTables: ["public.invoices"] }),
      "src/modules/invoices/public.ts": "export {};\n",
      "src/modules/invoices/server/q.ts": [
        "export const q = sql`",
        "  SELECT * FROM public.orders o",
        "  JOIN public.v_customer_facts c ON c.id = o.customer_id",
        "  DELETE FROM public.invoices WHERE 1=0;",
        "`;",
      ].join("\n"),
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("[naht4] src/modules/invoices/server/q.ts:2: Tabelle 'public.orders' gehoert nicht zu Modul 'invoices'"));
    expect(f).toContainEqual(expect.stringContaining("[naht4] src/modules/invoices/server/q.ts:3: View 'public.v_customer_facts' ist in keinem Manifest"));
    expect(f).toHaveLength(2);
  });
});

describe("S1 Naht 5 — UI-Vertrag (verworfene Stationsband-Bausteine), shrink-only", () => {
  it("verworfener Baustein/Text in Datei ausserhalb der Baseline = FAIL", () => {
    const root = repo({
      "src/app/page.tsx": `import { ${NAV} } from "@/x";\nexport default () => <button>${OPEN_TEXT}</button>;\n`,
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining(`[naht5] src/app/page.tsx:1: Baustein '${NAV}'`));
    expect(f).toContainEqual(expect.stringContaining(`[naht5] src/app/page.tsx:2: Text '${OPEN_TEXT}'`));
  });

  it("Baseline-Datei ist erlaubt; leere Baseline-Eintraege und Wachstum gegen Basis = FAIL", () => {
    const base = repo({ [BASELINE_PATH]: JSON.stringify({ uiContract: { allowedLegacyFiles: ["src/legacy/a.tsx"] } }) });
    const root = repo({
      "src/legacy/a.tsx": `export const A = ${STRIP};\n`,
      "src/legacy/b.tsx": `export const B = ${BAR};\n`,
      [BASELINE_PATH]: JSON.stringify({ uiContract: { allowedLegacyFiles: ["src/legacy/a.tsx", "src/legacy/b.tsx", "src/legacy/gone.tsx"] } }),
    });
    const f = findingsOf(root, { baseBaselinePath: path.join(base, BASELINE_PATH) });
    expect(f).toContainEqual(expect.stringContaining("'src/legacy/gone.tsx' hat keine Treffer mehr"));
    expect(f).toContainEqual(expect.stringContaining("'src/legacy/b.tsx' neu in allowedLegacyFiles"));
    expect(f).toContainEqual(expect.stringContaining("'src/legacy/gone.tsx' neu in allowedLegacyFiles"));
    expect(f.filter((x) => x.includes("src/legacy/a.tsx"))).toEqual([]);
  });

  it("--update schreibt exakt die Trefferliste; danach gruen, Loeschung der Altlast bleibt gruen nur mit Baseline-Pflege", () => {
    const root = repo({ "src/legacy/a.tsx": `export const A = ${TOGGLE};\n` });
    expect(writeBaseline(root)).toEqual(["src/legacy/a.tsx"]);
    expect(findingsOf(root)).toEqual([]);
    rmSync(path.join(root, "src/legacy/a.tsx"));
    expect(findingsOf(root)).toEqual([expect.stringContaining("'src/legacy/a.tsx' hat keine Treffer mehr")]);
  });
});

describe("S1 Naht 6 — AGENTS.md verweist auf die Bauanleitung", () => {
  it("fehlender Verweis = FAIL", () => {
    const root = repo({ "AGENTS.md": "nichts\n" });
    expect(findingsOf(root)).toEqual([expect.stringContaining("[naht6] AGENTS.md: Verweis auf ARCHITEKTUR_MODULE_PATH1.md fehlt")]);
  });
});

describe("S1 — echtes Repo", () => {
  it("der aktuelle Stand haelt alle Naehte (Baseline = Altlasten der Kill-Liste)", () => {
    expect(runModuleGates(process.cwd()).findings).toEqual([]);
  });
});

describe("S1 Red-Team-Fixes (unabhaengige Pruefung 2026-09-06)", () => {
  it("P0: Ordner build/ oder out/ unter src werden gescannt (kein Namens-Skip in der Tiefe)", () => {
    const root = repo({
      ...goodModule,
      "src/modules/invoices/invoices.manifest.json": manifest("invoices"),
      "src/modules/invoices/public.ts": "export {};\n",
      "src/modules/invoices/build/leak.ts": `${IMP} { readOrder } from "../../orders/server/readOrder";\n`,
      "src/app/out/leak.ts": `${IMP} { readOrder } from "@/modules/orders/server/readOrder";\n`,
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("[naht2] src/modules/invoices/build/leak.ts:1: Tiefimport"));
    expect(f).toContainEqual(expect.stringContaining("[naht2] src/app/out/leak.ts:1: Tiefimport"));
  });

  it("P0: Symlink aus dem Repo heraus = FAIL, Symlink innerhalb wird gescannt", () => {
    const outside = mkdtempSync(path.join(tmpdir(), "s1-outside-"));
    temps.push(outside);
    writeFileSync(path.join(outside, "leak.ts"), `${IMP} { x } from "@/modules/orders/server/readOrder";\n`);
    const root = repo({ ...goodModule, "src/inner/real.ts": `${IMP} { x } from "@/modules/orders/server/readOrder";\n` });
    try {
      symlinkSync(outside, path.join(root, "src/app/vendor"), "junction");
      symlinkSync(path.join(root, "src/inner"), path.join(root, "src/app/linked"), "junction");
    } catch {
      return; // Symlinks auf diesem System nicht erlaubt — Test nicht aussagekraeftig, nicht gruenwaschen
    }
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("[naht2] src/app/vendor: Symlink zeigt aus dem Repo heraus"));
    expect(f).toContainEqual(expect.stringContaining("[naht2] src/app/linked/real.ts:1: Tiefimport"));
  });

  it("P1: public/index, export * as, Template-Literal, vi.importActual werden erkannt", () => {
    const root = repo({
      ...goodModule,
      "src/modules/orders/public/index.ts": "export const y = 1;\n",
      "src/app/a.ts": `${IMP} { y } from "@/modules/orders/public/index";\n`,
      "src/app/b.ts": `${EXP} * as ns from "@/modules/orders/server/readOrder";\n`,
      "src/app/c.ts": `const m = await ${IMP}(\`@/modules/orders/server/readOrder\`);\n`,
      "src/app/d.test.ts": `const real = await vi.${["import", "Actual"].join("")}("@/modules/orders/server/readOrder");\n`,
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("[naht1] src/modules/orders/public: Ordner 'public/' verboten"));
    expect(f).toContainEqual(expect.stringContaining("[naht2] src/app/a.ts:1: Tiefimport '@/modules/orders/public/index'"));
    expect(f).toContainEqual(expect.stringContaining("[naht2] src/app/b.ts:1: Tiefimport"));
    expect(f).toContainEqual(expect.stringContaining("[naht2] src/app/c.ts:1: Tiefimport"));
    expect(f).toContainEqual(expect.stringContaining("[naht2] src/app/d.test.ts:1: Tiefimport"));
  });

  it("P1: export * in public.ts verboten; fremde tsconfig-Aliase verboten", () => {
    const root = repo({
      ...goodModule,
      "src/modules/orders/public.ts": `${EXP} * from "./server/readOrder";\n`,
      "tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"], "~/*": ["./src/*"] } } }),
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("[naht1] src/modules/orders/public.ts: 'export * from' verboten"));
    expect(f).toContainEqual(expect.stringContaining("[naht1] src/modules/orders/public.ts: exportiert 'readOrder' nicht"));
    expect(f).toContainEqual(expect.stringContaining("[naht2] tsconfig.json: paths '~/*'"));
    expect(f.filter((x) => x.includes("paths '@/*'"))).toEqual([]);
  });

  it("P1: ownsTables eindeutig; Supabase .from('tabelle'), \"public\".\"t\"-Quoting und .sql-Dateien werden geprueft; storage.from ist frei", () => {
    const root = repo({
      ...goodModule,
      "src/modules/invoices/invoices.manifest.json": manifest("invoices", { ownsTables: ["public.orders", "public.invoices"] }),
      "src/modules/invoices/public.ts": "export {};\n",
      "src/modules/invoices/server/q.ts": [
        'const a = supabase.from("customers").select("*");',
        'const b = supabase.storage.from("scans").upload(p, f);',
        'const c = sql`select * from "public"."customers"`;',
        'const d = supabase.from("invoices").select("*");',
      ].join("\n"),
      "src/modules/invoices/db/view.sql": "create view public.v_invoice_facts as select * from public.customers;\n",
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("ownsTables 'public.orders' gehoert bereits Modul"));
    expect(f).toContainEqual(expect.stringContaining("[naht4] src/modules/invoices/server/q.ts:1: Tabelle 'public.customers'"));
    expect(f).toContainEqual(expect.stringContaining("[naht4] src/modules/invoices/server/q.ts:3: Tabelle 'public.customers'"));
    expect(f).toContainEqual(expect.stringContaining("[naht4] src/modules/invoices/db/view.sql:1: Tabelle 'public.customers'"));
    expect(f.filter((x) => x.includes("scans") || x.includes("q.ts:4"))).toEqual([]);
  });

  it("P2: Ablage-Check trifft auch (orders)-Routen, Orders/ und lib/orders.ts", () => {
    const root = repo({
      ...goodModule,
      "src/app/(orders)/page.tsx": "export default () => null;\n",
      "src/components/Orders/Card.tsx": "export const Card = () => null;\n",
      "src/lib/orders.ts": "export const o = 1;\n",
      "src/lib/ordersLegacy/x.ts": "export const l = 1;\n",
    });
    const f = findingsOf(root).filter((x) => x.startsWith("[naht1]"));
    expect(f).toContainEqual(expect.stringContaining("src/app/(orders)/page.tsx: Fach 'orders'"));
    expect(f).toContainEqual(expect.stringContaining("src/components/Orders/Card.tsx: Fach 'orders'"));
    expect(f).toContainEqual(expect.stringContaining("src/lib/orders.ts: Fach 'orders'"));
    expect(f.filter((x) => x.includes("ordersLegacy"))).toEqual([]); // bewusst nicht (Spec: Fachname)
  });

  it("P2: kaputte Manifest-/Baseline-Strukturen ergeben Befunde statt Abstuerze", () => {
    const root = repo({
      "src/modules/a/a.manifest.json": "null",
      "src/modules/b/b.manifest.json": JSON.stringify({ moduleId: "b", version: "1.0.0", owner: "k", publicExports: 5, dependencies: "x", ownsTables: 7 }),
      "src/modules/b/public.ts": "export {};\n",
      [BASELINE_PATH]: JSON.stringify({ uiContract: { allowedLegacyFiles: "nope" } }),
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("[naht1] src/modules/a/a.manifest.json: $: erwartet object"));
    expect(f).toContainEqual(expect.stringContaining("[naht1] src/modules/b/b.manifest.json: $.publicExports: erwartet array"));
    expect(f).toContainEqual(expect.stringContaining("allowedLegacyFiles muss ein String-Array sein"));
  });
});
