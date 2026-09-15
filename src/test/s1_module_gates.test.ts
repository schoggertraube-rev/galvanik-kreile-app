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

const goodWerkstattModule = {
  "src/modules/werkstatt/werkstatt.manifest.json": manifest("werkstatt", {
    publicExports: ["@/modules/werkstatt/public#WerkstattView"],
  }),
  "src/modules/werkstatt/public.ts": 'export { WerkstattView } from "./ui/WerkstattView";\n',
  "src/modules/werkstatt/ui/WerkstattView.tsx": "export const WerkstattView = () => null;\n",
};

afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

function findingsOf(root: string, opts?: { baseBaselinePath?: string }): string[] {
  return runModuleGates(root, opts).findings;
}

describe("S1 Naht 1 — Manifest je Modul + Ablage", () => {
  it("bindet den Authority-Vertrag fail-closed in ein echtes Repository", () => {
    const root = repo({ "package.json": "{}\n" });
    expect(findingsOf(root)).toContain("[authority] AUTHORITY_CONFIG_PATH_MISSING:quality/authoritative-sources.json");
  });

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

  it("trennt browser-sichere public- und explizite server-public-Fassade", () => {
    const root = repo({
      "src/modules/customers/customers.manifest.json": manifest("customers", {
        publicExports: [
          "@/modules/customers/public#CustomerView",
          "@/modules/customers/public#CustomerInput",
          "@/modules/customers/server-public#CustomerInput",
          "@/modules/customers/server-public#createCustomer",
        ],
      }),
      "src/modules/customers/public.ts": `${EXP} { CustomerView } from "./ui/CustomerView";\n${EXP} type { CustomerInput } from "./server/types";\n`,
      "src/modules/customers/server-public.ts": `${IMP} "server-only";\n${EXP} { createCustomer } from "./server/createCustomer";\n${EXP} type { CustomerInput } from "./server/types";\n`,
      "src/modules/customers/ui/CustomerView.tsx": "export const CustomerView = () => null;\n",
      "src/modules/customers/server/types.ts": "export type CustomerInput = { name: string };\n",
      "src/modules/customers/server/createCustomer.ts": `${IMP} "server-only";\n${IMP} { sql } from "drizzle-orm";\nexport const createCustomer = () => sql;\n`,
      "src/app/actions/customers.actions.ts": `"use server";\n${IMP} { createCustomer } from "@/modules/customers/server-public";\nexport const action = createCustomer;\n`,
      "src/app/customers/CustomersAppAdapter.tsx": `${IMP} { CustomerView } from "@/modules/customers/public";\nexport const CustomersAppAdapter = CustomerView;\n`,
      "src/test/customer.integration.test.ts": `${IMP} { createCustomer } from "@/modules/customers/server-public";\nvoid createCustomer;\n`,
    });
    expect(findingsOf(root)).toEqual([]);
  });

  it("weist server-only im transitiven Client-Fassadengraph und fehlende Servermarkierung ab", () => {
    const root = repo({
      "src/modules/customers/customers.manifest.json": manifest("customers", {
        publicExports: [
          "@/modules/customers/public#CustomerView",
          "@/modules/customers/server-public#createCustomer",
        ],
      }),
      "src/modules/customers/public.ts": `${EXP} { CustomerView } from "./ui/CustomerView";\n`,
      "src/modules/customers/server-public.ts": `${EXP} { createCustomer } from "./server/createCustomer";\n`,
      "src/modules/customers/ui/CustomerView.tsx": `${EXP} { createCustomer as CustomerView } from "../server/createCustomer";\n`,
      "src/modules/customers/server/createCustomer.ts": `${IMP} "server-only";\nexport const createCustomer = () => null;\n`,
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("Client-Fassade ist nicht browser-sicher"));
    expect(f).toContainEqual(expect.stringContaining("importiert server-only 'server-only'"));
    expect(f).toContainEqual(expect.stringContaining("Server-Fassade muss direkt 'server-only' importieren"));
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

  it("erlaubt ausschliesslich duenne Next-Entrypoints und manifestgebundene typisierte AppAdapter als App-Kompositionsnaht", () => {
    const root = repo({
      ...goodModule,
      "src/app/orders/page.tsx": `${IMP} { OrdersAppAdapter } from "./OrdersAppAdapter";\nexport default function Page(){ return OrdersAppAdapter(); }\n`,
      "src/app/orders/[id]/page.tsx": `${IMP} { OrderCardAppAdapter } from "../OrderCardAppAdapter";\nexport default function Page(){ return OrderCardAppAdapter({ orderId: "x" }); }\n`,
      "src/app/orders/OrdersAppAdapter.tsx": `${IMP} { readOrder } from "@/modules/orders/public";\n${IMP} { action } from "@/app/actions/orders.actions";\nexport function OrdersAppAdapter(){ void action; return readOrder(); }\n`,
      "src/app/orders/OrderCardAppAdapter.tsx": `${IMP} { readOrder } from "@/modules/orders/public";\nexport function OrderCardAppAdapter({ fallbackHref }: { fallbackHref?: "/orders" }){ void fallbackHref; return readOrder(); }\n`,
    });
    expect(findingsOf(root)).toEqual([]);
  });

  it("ordnet den realen Routen-/Modul-Mismatch warendurchlauf/WerkstattAppAdapter ueber die Werkstatt-Fassade zu", () => {
    const root = repo({
      ...goodWerkstattModule,
      "src/app/warendurchlauf/WerkstattAppAdapter.tsx": [
        `${IMP} { WerkstattView } from "@/modules/werkstatt/public";`,
        `${IMP} { useRouter } from "next/navigation";`,
        `${IMP} { action } from "@/app/actions/orders.actions";`,
        `${IMP} { useOverlayStore } from "@/lib/overlayStore";`,
        "export function WerkstattAppAdapter() { const router = useRouter(); void action; void useOverlayStore; router.push(\"/warendurchlauf/galvanik\"); return WerkstattView(); }",
      ].join("\n"),
    });
    expect(findingsOf(root)).toEqual([]);
  });

  it("weist einen Next-Entrypoint ab, dessen Adapter einem anderen Fachmodul zugeordnet ist", () => {
    const root = repo({
      ...goodModule,
      ...goodWerkstattModule,
      "src/app/orders/page.tsx": `${IMP} { OrdersAppAdapter } from "./OrdersAppAdapter";\nexport default function Page(){ return OrdersAppAdapter(); }\n`,
      "src/app/orders/OrdersAppAdapter.tsx": `${IMP} { WerkstattView } from "@/modules/werkstatt/public";\nexport function OrdersAppAdapter(){ return WerkstattView(); }\n`,
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("src/app/orders/page.tsx:1: Next-Entrypoint darf lokalen Code nur ueber @/modules/orders/public"));
    expect(f).toContainEqual(expect.stringContaining("src/app/orders/page.tsx: App-Kompositionsdatei muss @/modules/orders/public konsumieren"));
  });

  it("weist beliebige App-Dateien, actions/server/domain, fehlende Modulnaht, Tiefimport und generische URL-Tunnel ab", () => {
    const root = repo({
      ...goodModule,
      "src/app/orders/page.tsx": "export default function Page(){ return null; }\n",
      "src/app/orders/actions.ts": "export const action = 1;\n",
      "src/app/orders/server/read.ts": "export const read = 1;\n",
      "src/app/orders/domain/calculate.ts": "export const calculate = 1;\n",
      "src/app/orders/BadAppAdapter.tsx": `${IMP} { x } from "@/modules/orders/server/readOrder";\n${IMP} { db } from "@/db";\nexport const BadAppAdapter = ({ href }: { href: string }) => href || "/foreign";\n`,
      "src/components/orders/Card.tsx": "export const Card = () => null;\n",
      "src/lib/orders/read.ts": "export const read = 1;\n",
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("src/app/orders/page.tsx: App-Kompositionsdatei muss"));
    expect(f).toContainEqual(expect.stringContaining("src/app/orders/actions.ts: Fach 'orders' hat ein Modul"));
    expect(f).toContainEqual(expect.stringContaining("src/app/orders/server/read.ts: Fach 'orders' hat ein Modul"));
    expect(f).toContainEqual(expect.stringContaining("src/app/orders/domain/calculate.ts: Fach 'orders' hat ein Modul"));
    expect(f).toContainEqual(expect.stringContaining("src/app/orders/BadAppAdapter.tsx:2: AppAdapter darf keine DB-, Supabase-, Repository- oder Command-Implementierung"));
    expect(f).toContainEqual(expect.stringContaining("src/app/orders/BadAppAdapter.tsx: AppAdapter muss genau eine kanonische Modul-public-Fassade importieren; Zuordnung ist keine"));
    expect(f).toContainEqual(expect.stringContaining("href/url/route/pathname:string-Tunnel"));
    expect(f).toContainEqual(expect.stringContaining("src/components/orders/Card.tsx: Fach 'orders' hat ein Modul"));
    expect(f).toContainEqual(expect.stringContaining("src/lib/orders/read.ts: Fach 'orders' hat ein Modul"));
  });

  it("prueft verbotene Implementierungsimporte auch beim realen Routen-/Modul-Mismatch", () => {
    const root = repo({
      ...goodWerkstattModule,
      "src/app/warendurchlauf/WerkstattAppAdapter.tsx": [
        `${IMP} { WerkstattView } from "@/modules/werkstatt/public";`,
        `${IMP} { supabase } from "@/lib/supabase/client";`,
        `${IMP} { orderRepository } from "@/lib/server/orderRepository";`,
        `${IMP} { recordGoodsOutCommand } from "@/lib/server/recordGoodsOutCommand";`,
        "export function WerkstattAppAdapter() { void supabase; void orderRepository; void recordGoodsOutCommand; return WerkstattView(); }",
      ].join("\n"),
    });
    const f = findingsOf(root);
    for (const line of [2, 3, 4]) {
      expect(f).toContainEqual(expect.stringContaining(`src/app/warendurchlauf/WerkstattAppAdapter.tsx:${line}: AppAdapter darf keine DB-, Supabase-, Repository- oder Command-Implementierung`));
    }
    expect(f).toHaveLength(3);
  });

  it("erkennt alle AppAdapter-Endungen case-insensitiv, meldet die Namensform und prueft ihren Inhalt weiter", () => {
    const unsafeAdapters = [
      ["unsafeAppAdapter.tsx", "@/utils/supabase/client"],
      ["UnsafeMixedappadapter.jsx", "@/lib/supabase/client"],
      ["UnsafeScriptAPPADAPTER.js", "@supabase/supabase-js"],
      ["UnsafeTypedAppAdapter.ts", "../../../utils/supabase/client"],
      ["UnsafeUpperAppAdapter.TSX", "@/lib/server/recordGoodsOutCommand"],
    ] as const;
    const files: Record<string, string> = { ...goodModule };
    for (const [filename, implementationImport] of unsafeAdapters) {
      files[`src/app/orders/${filename}`] = [
        `${IMP} { readOrder } from "@/modules/orders/public";`,
        `${IMP} { unsafe } from "${implementationImport}";`,
        "export function Adapter() { void unsafe; return readOrder(); }",
      ].join("\n");
    }

    const f = findingsOf(repo(files));
    for (const [filename, implementationImport] of unsafeAdapters) {
      expect(f).toContainEqual(expect.stringContaining(`src/app/orders/${filename}: AppAdapter-Dateiname muss kanonisch '<PascalCase>AppAdapter.tsx' geschrieben sein`));
      expect(f).toContainEqual(expect.stringContaining(`src/app/orders/${filename}:2: AppAdapter darf keine DB-, Supabase-, Repository- oder Command-Implementierung importieren ('${implementationImport}')`));
    }
    expect(f).toHaveLength(unsafeAdapters.length * 2);
  });

  it("weist fehlende, mehrdeutige und ungueltige Modulzuordnung direkter AppAdapter fail-closed ab", () => {
    const root = repo({
      ...goodModule,
      ...goodWerkstattModule,
      "src/modules/broken/broken.manifest.json": manifest("wrong"),
      "src/modules/broken/public.ts": "export const BrokenView = () => null;\n",
      "src/app/warendurchlauf/OrphanAppAdapter.tsx": `${IMP} { action } from "@/app/actions/orders.actions";\nexport function OrphanAppAdapter() { void action; return null; }\n`,
      "src/app/warendurchlauf/AmbiguousAppAdapter.tsx": `${IMP} { readOrder } from "@/modules/orders/public";\n${IMP} { WerkstattView } from "@/modules/werkstatt/public";\nexport function AmbiguousAppAdapter() { readOrder(); return WerkstattView(); }\n`,
      "src/app/broken/BrokenAppAdapter.tsx": `${IMP} { BrokenView } from "@/modules/broken/public";\nexport function BrokenAppAdapter() { return BrokenView(); }\n`,
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("src/app/warendurchlauf/OrphanAppAdapter.tsx: AppAdapter muss genau eine kanonische Modul-public-Fassade importieren; Zuordnung ist keine"));
    expect(f).toContainEqual(expect.stringContaining("src/app/warendurchlauf/AmbiguousAppAdapter.tsx: AppAdapter muss genau eine kanonische Modul-public-Fassade importieren; Zuordnung ist mehrere (orders, werkstatt)"));
    expect(f).toContainEqual(expect.stringContaining("src/app/broken/BrokenAppAdapter.tsx: AppAdapter-Fassade '@/modules/broken/public' gehoert nicht zu einem gueltigen Manifest"));
  });

  it("weist breite Route-Props ab und laesst enge Literal-Fallbacks sowie konkrete App-Navigation zu", () => {
    const root = repo({
      ...goodModule,
      "src/app/orders/FallbackAppAdapter.tsx": `${IMP} { readOrder } from "@/modules/orders/public";\nexport function FallbackAppAdapter({ fallbackHref }: { fallbackHref?: string }) { void fallbackHref; return readOrder(); }\n`,
      "src/app/orders/TargetAppAdapter.tsx": `${IMP} { readOrder } from "@/modules/orders/public";\nexport function TargetAppAdapter({ targetUrl }: { targetUrl: string }) { void targetUrl; return readOrder(); }\n`,
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("src/app/orders/FallbackAppAdapter.tsx:2: AppAdapter darf keinen breit typisierten href/url/route/pathname:string-Tunnel"));
    expect(f).toContainEqual(expect.stringContaining("src/app/orders/TargetAppAdapter.tsx:2: AppAdapter darf keinen breit typisierten href/url/route/pathname:string-Tunnel"));
    expect(f).toHaveLength(2);
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

  it("erlaubt server-public nur fuer Server Actions und Real-DB-Tests; Client, Re-Export und Tiefimport bleiben rot", () => {
    const root = repo({
      "src/modules/customers/customers.manifest.json": manifest("customers", {
        publicExports: [
          "@/modules/customers/public#CustomerView",
          "@/modules/customers/server-public#createCustomer",
        ],
      }),
      "src/modules/customers/public.ts": `${EXP} { CustomerView } from "./ui/CustomerView";\n`,
      "src/modules/customers/server-public.ts": `${IMP} "server-only";\n${EXP} { createCustomer } from "./server/createCustomer";\n`,
      "src/modules/customers/ui/CustomerView.tsx": "export const CustomerView = () => null;\n",
      "src/modules/customers/server/createCustomer.ts": `${IMP} "server-only";\nexport const createCustomer = () => null;\n`,
      "src/app/customers/CustomersAppAdapter.tsx": `${IMP} { CustomerView } from "@/modules/customers/public";\n${IMP} { createCustomer } from "@/modules/customers/server-public";\nexport const CustomersAppAdapter = () => { void createCustomer; return CustomerView(); };\n`,
      "src/app/client.tsx": `${IMP} { createCustomer } from "@/modules/customers/server-public";\nvoid createCustomer;\n`,
      "src/app/actions/bad.actions.ts": `"use server";\n${IMP} { createCustomer } from "@/modules/customers/server/createCustomer";\nvoid createCustomer;\n`,
      "src/app/actions/missing-server-marker.actions.ts": `${IMP} { createCustomer } from "@/modules/customers/server-public";\nvoid createCustomer;\n`,
      "src/app/actions/reexport.actions.ts": `"use server";\n${EXP} { createCustomer } from "@/modules/customers/server-public";\n`,
      "src/test/customer.integration.test.tsx": `${IMP} { createCustomer } from "@/modules/customers/server-public";\nvoid createCustomer;\n`,
      "src/app/reexport.ts": `${EXP} { createCustomer } from "@/modules/customers/server-public";\n`,
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("src/app/customers/CustomersAppAdapter.tsx:2: Server-Fassade"));
    expect(f).toContainEqual(expect.stringContaining("src/app/client.tsx:1: Server-Fassade"));
    expect(f).toContainEqual(expect.stringContaining("src/app/reexport.ts:1: Server-Fassade"));
    expect(f).toContainEqual(expect.stringContaining("src/app/actions/bad.actions.ts:2: Tiefimport"));
    expect(f).toContainEqual(expect.stringContaining("src/app/actions/missing-server-marker.actions.ts:1: Server-Fassade"));
    expect(f).toContainEqual(expect.stringContaining("src/app/actions/reexport.actions.ts:2: Server-Fassade"));
    expect(f).toContainEqual(expect.stringContaining("darf nicht re-exportiert werden"));
    expect(f).toContainEqual(expect.stringContaining("src/test/customer.integration.test.tsx:1: Server-Fassade"));
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
      "src/modules/invoices/invoices.manifest.json": manifest("invoices", {
        ownsTables: ["public.invoices", "private.invoice_numbers"],
        viewsFunctions: ["private.v_invoice_receipts", "private.issue_invoice_v1"],
      }),
      "src/modules/invoices/public.ts": "export {};\n",
      "src/modules/invoices/server/q.ts": [
        "export const q = sql`",
        "  UPDATE public.invoices SET x = 1;",
        "  INSERT INTO private.invoice_numbers (n) VALUES (1);",
        "  SELECT o.id FROM public.v_order_facts o JOIN private.v_invoice_receipts r ON r.order_id = o.id JOIN public.invoices i ON i.order_id = o.id;",
        "  SELECT * FROM private.issue_invoice_v1('order-id');",
        "`;",
      ].join("\n"),
    });
    expect(findingsOf(root)).toEqual([]);
  });

  it("erlaubt public Views moduluebergreifend, private Views/Funktionen aber nur ihrem deklarierenden Modul", () => {
    const root = repo({
      ...goodModule,
      "src/modules/orders/orders.manifest.json": manifest("orders", {
        publicExports: ["@/modules/orders/public#readOrder"],
        ownsTables: ["public.orders"],
        viewsFunctions: ["public.v_order_facts", "private.v_order_secret", "private.prepare_order_v1"],
      }),
      "src/modules/orders/server/privateRead.ts": "export const q = sql`select * from private.v_order_secret; select * from private.prepare_order_v1()`;\n",
      "src/modules/invoices/invoices.manifest.json": manifest("invoices", { ownsTables: ["public.invoices"] }),
      "src/modules/invoices/public.ts": "export {};\n",
      "src/modules/invoices/server/q.ts": "export const q = sql`select * from public.v_order_facts o join private.v_order_secret s on s.id = o.id; select * from private.prepare_order_v1()`;\n",
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("[naht4] src/modules/invoices/server/q.ts:1: private View 'private.v_order_secret' gehoert orders"));
    expect(f).toContainEqual(expect.stringContaining("[naht4] src/modules/invoices/server/q.ts:1: private Funktion 'private.prepare_order_v1' gehoert orders"));
    expect(f).toHaveLength(2);
  });

  it("weist doppelte private-Relation-Deklaration fail-closed ab und verhindert Eigentumsumgehung", () => {
    const root = repo({
      ...goodModule,
      "src/modules/orders/orders.manifest.json": manifest("orders", {
        publicExports: ["@/modules/orders/public#readOrder"],
        ownsTables: ["public.orders"],
        viewsFunctions: ["public.v_order_facts", "private.v_order_secret"],
      }),
      "src/modules/invoices/invoices.manifest.json": manifest("invoices", {
        ownsTables: ["public.invoices"],
        viewsFunctions: ["private.v_order_secret"],
      }),
      "src/modules/invoices/public.ts": "export {};\n",
      "src/modules/invoices/server/q.ts": "export const q = sql`select * from private.v_order_secret`;\n",
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("private Relation 'private.v_order_secret' ist in mehreren Modulen deklariert (invoices, orders)"));
    expect(f).toContainEqual(expect.stringContaining("private View 'private.v_order_secret' gehoert invoices, orders"));
    expect(f).toHaveLength(2);
  });

  it("viewsFunctions kann fremde Basistabellen nicht als Lesenaht autorisieren", () => {
    const root = repo({
      ...goodModule,
      "src/modules/invoices/invoices.manifest.json": manifest("invoices", {
        ownsTables: ["public.invoices"],
        viewsFunctions: ["public.orders", "private.customer_number_counters", "public.calculate_total"],
      }),
      "src/modules/invoices/public.ts": "export {};\n",
      "src/modules/invoices/server/q.ts": [
        "export const q = sql`",
        "  SELECT * FROM public.orders o",
        "  JOIN private.customer_number_counters c ON c.tenant_id = o.tenant_id",
        "`;",
      ].join("\n"),
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("[naht4] src/modules/invoices/server/q.ts:2: Tabelle 'public.orders' gehoert nicht zu Modul 'invoices'"));
    expect(f).toContainEqual(expect.stringContaining("[naht4] src/modules/invoices/server/q.ts:3: Tabelle 'private.customer_number_counters' gehoert nicht zu Modul 'invoices'"));
    expect(f).toHaveLength(2);
  });

  it("ownsTables kann private Views oder Funktionsaufrufe nicht als Eigentum tarnen", () => {
    const root = repo({
      ...goodModule,
      "src/modules/invoices/invoices.manifest.json": manifest("invoices", {
        ownsTables: ["public.invoices", "private.v_order_secret", "private.prepare_order_v1"],
      }),
      "src/modules/invoices/public.ts": "export {};\n",
      "src/modules/invoices/server/q.ts": "export const q = sql`select * from private.v_order_secret; select * from private.prepare_order_v1()`;\n",
    });
    const f = findingsOf(root);
    expect(f).toContainEqual(expect.stringContaining("ownsTables 'private.v_order_secret' ist eine View"));
    expect(f).toContainEqual(expect.stringContaining("private Funktion 'private.prepare_order_v1' gehoert kein Modul"));
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
