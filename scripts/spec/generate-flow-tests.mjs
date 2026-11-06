import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const generatedRoot = path.join(root, "e2e", "generated");
const defaultBauplan = "docs/project/endversion/codex/BAUPLAN.json";
const expectedRedPath = path.join(generatedRoot, "_erwartet_rot.json");
const workQueuePath = path.join(root, "docs", "project", "arbeitspakete", "WORKQUEUE.json");

// All model-to-storage names live here; the harness never guesses another column.
const DATABASE_MAPPING = Object.freeze({
  orders: { table: "orders", columns: { kunde: "customer_id", art: "is_quote", liefertermin: "promised_due_date", terminstatus: "intake_term_status", uebergabe: "handover_mode", zahlungsmodus: "payment_mode", eingangsart: "intake_source", geprueft: "geprueft" }, transforms: { art: "order_kind", uebergabe: "handover", zahlungsmodus: "payment_mode", liefertermin: "berlin_date" } },
  items: { table: "items", columns: { auftrag: "order_id", bezeichnung: "name", menge: "quantity", einheit: "unit", oberflaeche: "surface_requested", ausfuehrung: "execution_requested" }, transforms: {} },
  customers: { table: "customers", columns: { customer_type: "type", zahlungsbedingung: "payment_preference", notiz: "notes" }, transforms: { handover_preference: "handover" } },
  order_events: { table: "events", columns: {}, transforms: {} },
  intake_item: { table: "intake_item", columns: {}, transforms: {} },
  intake_file: { table: "intake_file", columns: {}, transforms: {} },
  intake_suggestion: { table: "intake_suggestion", columns: {}, transforms: {} },
  intake_drafts: { schema: "private", table: "intake_drafts", columns: { login: "actor_id" }, transforms: {} },
  goods_receipt: { table: "goods_receipt", columns: {}, transforms: {} },
  outbox_mails: { table: "outbox_mails", columns: {}, transforms: {} },
  task: { table: "tasks", columns: {}, transforms: {} },
  complaint: { table: "complaints", columns: { auftrag_id: "order_id", kunde_id: "customer_id", mangel: "reason" }, transforms: {} },
  supplier_invoice: { table: "supplier_invoice", columns: {}, transforms: {} },
  invoices: { table: "invoices", columns: { auftrag: "order_id", kunde: "customer_id", faellig: "due_date" }, transforms: {} },
  customer_agreements: { table: "customer_agreements", columns: { kunde: "customer_id" }, transforms: {} },
  invoice_collections: { table: "invoice_collections", columns: { kunde: "customer_id" }, transforms: {} },
  invoice_collection_orders: { table: "invoice_collection_orders", columns: { id: "order_id" }, transforms: {} },
  // Test-only contract rows needed to materialize a real order-card state in
  // the isolated Replay DB. They are never product fixtures or UI data.
  order_intake_receipts: { schema: "private", table: "order_intake_receipts", columns: {}, transforms: {} },
  order_freezes: { schema: "private", table: "order_freezes", columns: {}, transforms: {} },
  extra_work_hourly_rates: { schema: "private", table: "extra_work_hourly_rates", columns: {}, transforms: {} },
});

function parseArguments(argv) {
  let bauplan = defaultBauplan;
  let check = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--check") check = true;
    else if (argument === "--bauplan") {
      bauplan = argv[index + 1];
      if (!bauplan) throw new Error("FLOW_GENERATOR_BAUPLAN_VALUE_REQUIRED");
      index += 1;
    } else throw new Error(`FLOW_GENERATOR_UNKNOWN_ARGUMENT:${argument}`);
  }
  return { bauplan, check };
}

function quoted(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function customerSeedRows(datenlagen) {
  return Object.entries(datenlagen)
    .filter(([, fixture]) => fixture?.tabelle === "customers")
    .map(([name, fixture], index) => {
      const values = fixture.werte ?? {};
      const id = `00000000-0000-4000-8000-${String(index + 101).padStart(12, "0")}`;
      const customerNumber = `K-FLOW-${String(index + 1).padStart(3, "0")}`;
      const contactPerson = values.contact_person
        ?? ([values.first_name, values.last_name].filter(Boolean).join(" ") || null);
      const country = values.country ?? null;
      const shippingPreference = values.handover_preference === "versand"
        ? "versand"
        : values.handover_preference === "abholung"
          ? "abholung"
          : null;
      return {
        name,
        id,
        customerNumber,
        columns: {
          name: values.name ?? values.company_name ?? name,
          type: values.customer_type ?? "business",
          company_name: values.company_name ?? null,
          contact_person: contactPerson,
          salutation: values.salutation ?? null,
          first_name: values.first_name ?? null,
          last_name: values.last_name ?? null,
          contact_role: values.contact_role ?? null,
          phone: values.phone ?? null,
          email: values.email ?? null,
          billing_email: values.billing_email ?? null,
          website: values.website ?? null,
          street: values.street ?? null,
          house_number: values.house_number ?? null,
          address: null,
          zip_code: values.zip_code ?? null,
          city: values.city ?? null,
          country,
          payment_preference: values.zahlungsbedingung ?? null,
          handover_preference: values.handover_preference === "versand" ? "shipping" : values.handover_preference === "abholung" ? "pickup" : values.handover_preference ?? null,
          auto_info: values.auto_info ?? true,
          vorrang: values.vorrang ?? false,
          notes: values.notiz ?? null,
          shipping_preference: shippingPreference,
          vat_id: values.vat_id ?? null,
          ziel_freigeschaltet: values.ziel_freigeschaltet ?? false,
          ziel_tage: values.ziel_tage ?? null,
          skonto_prozent: values.skonto_prozent ?? null,
          skonto_tage: values.ziel_freigeschaltet ? values.skonto_tage ?? 0 : null,
        },
      };
    });
}

function renderSeed(model, screens) {
  const loginIds = {
    login_meister: "10000000-0000-4000-8000-000000000001",
    login_werkstatt: "10000000-0000-4000-8000-000000000002",
    login_ohne_eingang: "10000000-0000-4000-8000-000000000003",
    login_ohne_kunden: "10000000-0000-4000-8000-000000000004",
    login_nur_eingang: "10000000-0000-4000-8000-000000000005",
    login_buero_ohne_geld: "10000000-0000-4000-8000-000000000006",
    login_einstellungen: "10000000-0000-4000-8000-000000000007",
  };
  const pins = {
    login_meister: ["1111", "$2b$12$u4o.djf1c9OZbJWiD7XtCOFahRnoeyJe2OiyG7QyzsIEb4vv/UHaq"],
    login_werkstatt: ["2222", "$2b$12$a9ZEwrinIz0zIJ7jrTabAuF6ACwd.oUHJv1iOZ61xkkn.1minJHBy"],
    login_ohne_eingang: ["3333", "$2b$12$/C2xIVQ7tBxoZKRL6Ba7UOtHwE.fBynIDbe0fejXDxjQyWaFkzQnq"],
    login_ohne_kunden: ["4444", "$2b$12$lgvHXCJ7iDaE3gRb28yQsunVSdvEAPBaesRNAY3XWYUO3/znrjk3i"],
    login_nur_eingang: ["5555", "$2b$12$iX9SQ7tzMSuCSdN9P1ZokeuIjv53solEfRP2g0ve.ObqxdXFTV9eu"],
    login_buero_ohne_geld: ["6666", "$2b$12$REJw.ffLob7XTc35.mq5BuGF5QfanyzWTey1N0rMh3hy8DUuQtay2"],
    login_einstellungen: ["7777", "$2b$12$cgAV2CpgQkfW9zMsrQSFUOIobbZIEwVppDcRJA2G378JOw9jpSlyy"],
  };
  const allowedRights = new Set(["auftraege", "eingang", "kunden", "geld", "kassieren", "mails", "einstellungen", "logins", "wartung", "entscheiden"]);
  const users = Object.entries(model.logins).map(([name, login], index) => ({
    name,
    id: loginIds[name],
    pin: pins[name][0],
    pinHash: pins[name][1],
    role: login.vorlage === "werkstatt" ? "werkstatt" : "meister",
    fullName: `Flow ${name.replace("login_", "")}`,
    shortCode: `F${String(index + 1).padStart(2, "0")}`,
    rights: login.rechte.filter((right) => allowedRights.has(right)),
  }));
  const customers = customerSeedRows(model.datenlagen);
  const fixtureSql = {};
  const lines = [
    "-- Generated from BAUPLAN.testmodell. Local replay database only.",
    "BEGIN;",
  ];
  for (const user of users) {
    lines.push(
      "INSERT INTO public.app_users (id, tenant_id, email, full_name, role, pin_hash, active, kuerzel, bezeichnung)",
      `VALUES (${quoted(user.id)}::uuid, 'galvanik-kreile', ${quoted(`${user.name}@flow.local`)}, ${quoted(user.fullName)}, ${quoted(user.role)}, ${quoted(user.pinHash)}, true, ${quoted(user.shortCode)}, 'Generierter Wege-Test')`,
      "ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, pin_hash = EXCLUDED.pin_hash, active = true, updated_at = statement_timestamp();",
      `DELETE FROM public.app_user_rights WHERE tenant_id = 'galvanik-kreile' AND user_id = ${quoted(user.id)}::uuid;`,
    );
    for (const right of user.rights) {
      const insertRight = `INSERT INTO public.app_user_rights (tenant_id, user_id, bereich) VALUES ('galvanik-kreile', ${quoted(user.id)}::uuid, ${quoted(right)}) ON CONFLICT DO NOTHING;`;
      if (right === "entscheiden") {
        lines.push(`DO $flow$ BEGIN BEGIN ${insertRight} EXCEPTION WHEN check_violation THEN RAISE NOTICE 'FLOW_SEED_AREA_PENDING:entscheiden'; END; END $flow$;`);
      } else {
        lines.push(insertRight);
      }
    }
  }
  for (const customer of customers) {
    const seedStart = lines.length;
    const c = customer.columns;
    const values = {
      id: customer.id, tenant_id: "galvanik-kreile", customer_number: customer.customerNumber,
      ...Object.fromEntries(Object.entries(c).filter(([key]) => !["contact_person", "shipping_preference", "address"].includes(key))),
      source: "flow-spec",
    };
    const columns = Object.keys(values);
    lines.push(
      `INSERT INTO public.customers (${columns.join(", ")})`,
      `VALUES (${columns.map(key => key === "country" ? `private.kunde_land_schluessel(${quoted(values[key])})` : typeof values[key] === "boolean" ? String(values[key]) : quoted(values[key])).join(", ")})`,
      `ON CONFLICT (id) DO UPDATE SET ${columns.filter(key => key !== "id" && key !== "tenant_id").map(key => `${key}=EXCLUDED.${key}`).join(", ")},updated_at=statement_timestamp();`,
    );
    fixtureSql[customer.name] = lines.splice(seedStart).join("\n");
  }
  for (const [fixtureName, fixture] of Object.entries(model.datenlagen).filter(([, value]) => value.tabelle === "address_directory")) {
    const seedStart = lines.length;
    const addresses = fixture.zeilen ?? [];
    lines.push("DO $flow$ BEGIN IF to_regclass('public.address_directory') IS NOT NULL THEN");
    for (const address of addresses) {
      lines.push(
        "INSERT INTO public.address_directory (country, zip_code, city, district, street)",
        `VALUES (${quoted(address.country)}, ${quoted(address.zip_code)}, ${quoted(address.city)}, ${quoted(address.district ?? null)}, ${quoted(address.street ?? null)})`,
        "ON CONFLICT DO NOTHING;",
      );
    }
    lines.push("END IF; END $flow$;");
    fixtureSql[fixtureName] = lines.splice(seedStart).join("\n");
  }
  lines.push("COMMIT;", "");
  const customerRuntime = new Map(customers.map((customer) => [customer.name, {
    id: customer.id,
    tabelle: "customers",
    customer_number: customer.customerNumber,
    ...model.datenlagen[customer.name].werte,
  }]));
  const fixtureCounters = new Map();
  const allFixtures = Object.fromEntries(Object.entries(model.datenlagen).map(([name, fixture], index) => {
    const customer = customerRuntime.get(name);
    if (customer) return [name, customer];
    const sequence = (fixtureCounters.get(fixture.tabelle) ?? 0) + 1;
    fixtureCounters.set(fixture.tabelle, sequence);
    const generatedKeys = fixture.tabelle === "orders"
      ? { order_number: `A-2099-${String(9000 + sequence)}` }
      : fixture.tabelle === "complaint"
        ? { nummer: `RK-2099-${String(9000 + sequence)}` }
        : {};
    return [name, {
      id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      tabelle: fixture.tabelle,
      ...generatedKeys,
      ...(fixture.werte ?? {}),
      // null in a data scenario requests a deterministic technical identity.
      id: fixture.werte?.id ?? `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      ...(fixture.zeilen ? { zeilen: fixture.zeilen } : {}),
    }];
  }));
  return {
    sql: lines.join("\n"),
    runtime: {
      database: DATABASE_MAPPING,
      fixtureSql,
      logins: Object.fromEntries(users.map((user) => [user.name, { id: user.id, pin: user.pin }])),
      datenlagen: allFixtures,
      screenTypes: Object.fromEntries(screens.map(screen => [screen.id, screen.typ])),
    },
  };
}

function renderPage(pageName, page, bauplanSha) {
  const cases = JSON.stringify(page.faelle ?? [], null, 2);
  return `// Generated from BAUPLAN SHA-256 ${bauplanSha}. Do not edit.\n`
    + `import { test } from "@playwright/test";\n`
    + `import expectedRed from "./_erwartet_rot.json";\n`
    + `import { prepareGeneratedSeed, runGeneratedFlowCase, type FlowCase } from "./_harness";\n\n`
    + `const cases = ${cases} as unknown as FlowCase[];\n\n`

    + `test.describe(${JSON.stringify(`BAUPLAN Wege · ${pageName}`)}, () => {\n`
    + `  for (const flowCase of cases) {\n`
    + `    const packageTag = flowCase.paket ? \`@\${flowCase.paket}\` : "@UNASSIGNED";\n`
    + `    test(\`\${flowCase.id || "OFFEN"} \${packageTag} · \${flowCase.titel || "noch nicht beschrieben"}\`, async ({ page }) => {\n`
    + `      const red = expectedRed[flowCase.id as keyof typeof expectedRed];\n`
    + `      test.fail(Boolean(red), red ? \`\${red.paket}: \${red.grund}\` : undefined);\n`
    + `      await prepareGeneratedSeed(flowCase);\n`
    + `      await runGeneratedFlowCase(page, flowCase);\n`
    + `    });\n`
    + `  }\n`
    + `});\n`;
}

function readAndValidateExpectedRed(document) {
  if (!existsSync(expectedRedPath)) throw new Error("FLOW_EXPECTED_RED_FILE_MISSING");
  const expectedRed = JSON.parse(readFileSync(expectedRedPath, "utf8"));
  if (!expectedRed || Array.isArray(expectedRed) || typeof expectedRed !== "object") {
    throw new Error("FLOW_EXPECTED_RED_FORMAT_INVALID");
  }
  const cases = new Map();
  for (const page of Object.values(document.testmodell?.seiten ?? {})) {
    for (const flowCase of page.faelle ?? []) {
      if (cases.has(flowCase.id)) throw new Error(`FLOW_CASE_ID_DUPLICATE:${flowCase.id}`);
      cases.set(flowCase.id, flowCase);
    }
  }
  if (!existsSync(workQueuePath)) throw new Error("FLOW_EXPECTED_RED_WORKQUEUE_MISSING");
  const workQueue = JSON.parse(readFileSync(workQueuePath, "utf8"));
  const acceptedPackages = new Set(
    (workQueue.pakete ?? [])
      .filter((workPackage) => workPackage?.status === "abgenommen")
      .map((workPackage) => workPackage.nr)
      .filter((packageId) => typeof packageId === "string"),
  );
  for (const [id, entry] of Object.entries(expectedRed)) {
    const flowCase = cases.get(id);
    if (!flowCase) throw new Error(`FLOW_EXPECTED_RED_CASE_UNKNOWN:${id}`);
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`FLOW_EXPECTED_RED_ENTRY_INVALID:${id}`);
    if (typeof entry.paket !== "string" || !entry.paket.startsWith("AP-")) throw new Error(`FLOW_EXPECTED_RED_PACKAGE_REQUIRED:${id}`);
    if (acceptedPackages.has(entry.paket)) throw new Error(`FLOW_EXPECTED_RED_ACCEPTED_PACKAGE:${id}:${entry.paket}`);
    if (typeof entry.grund !== "string" || entry.grund.trim().length === 0) throw new Error(`FLOW_EXPECTED_RED_REASON_REQUIRED:${id}`);
  }
  return expectedRed;
}

function renderRuntime(runtime, sha) {
  return `// Generated from BAUPLAN SHA-256 ${sha}. Do not edit.\nexport const generatedFlowRuntime = ${JSON.stringify(runtime, null, 2)} as const;\n`;
}

function buildOutputs(raw, document) {
  if (!document.testmodell?.seiten) throw new Error("FLOW_GENERATOR_TESTMODELL_MISSING");
  const sha = createHash("sha256").update(raw).digest("hex").toUpperCase();
  const seed = renderSeed(document.testmodell, document.screens);
  const outputs = new Map([
    ["_model.ts", renderRuntime(seed.runtime, sha)],
    ["_seed.sql", seed.sql],
  ]);
  for (const [pageName, page] of Object.entries(document.testmodell.seiten)) {
    outputs.set(`${pageName}.flow.spec.ts`, renderPage(pageName, page, sha));
  }
  return { outputs, sha };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const bauplanPath = path.resolve(root, options.bauplan);
  const raw = readFileSync(bauplanPath, "utf8");
  const document = JSON.parse(raw);
  readAndValidateExpectedRed(document);
  const { outputs, sha } = buildOutputs(raw, document);
  mkdirSync(generatedRoot, { recursive: true });

  if (options.check) {
    const mismatches = [];
    for (const [name, expected] of outputs) {
      const target = path.join(generatedRoot, name);
      if (!existsSync(target) || readFileSync(target, "utf8") !== expected) mismatches.push(name);
    }
    const expectedSpecs = new Set([...outputs.keys()].filter((name) => name.endsWith(".flow.spec.ts")));
    for (const name of readdirSync(generatedRoot).filter((name) => name.endsWith(".flow.spec.ts"))) {
      if (!expectedSpecs.has(name)) mismatches.push(name);
    }
    if (mismatches.length) throw new Error(`FLOW_GENERATOR_CHECK_FAILED:${[...new Set(mismatches)].sort().join(",")}`);
    console.log(`FLOW_GENERATOR_CHECK=PASS bauplan_sha256=${sha} files=${outputs.size}`);
    return;
  }

  for (const [name, content] of outputs) writeFileSync(path.join(generatedRoot, name), content, "utf8");
  console.log(`FLOW_GENERATOR_WRITE=PASS bauplan_sha256=${sha} files=${outputs.size}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
