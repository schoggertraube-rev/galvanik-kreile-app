import { createOrderFromErfassung } from "../src/app/actions/erfassung.actions";

async function runTests() {
  type SourceTestPayload = { source?: string | null };
  const sourcePayloads: readonly [string, SourceTestPayload][] = [
    ["Auftrag ohne source", {}],
    ["Auftrag mit source null", { source: null }],
    ["Auftrag mit source unbekannt", { source: "unbekannt" }],
    ["Manuelle Erfassung", { source: "manual" }],
    ["Kundenakte", { source: "customer" }],
    ["Capture", { source: "capture" }],
    ["Integrationstest", { source: "integration-test" }],
  ];

  for (const [name, payload] of sourcePayloads) {
    const result = await createOrderFromErfassung({
      customerId: "test-customer",
      title: "Test Auftrag",
      ...payload,
    });

    if (result.ok !== false || result.error !== "CONFLICT" || !result.message.includes("NOT_AVAILABLE")) {
      throw new Error(`${name}: erwarteter NOT_AVAILABLE-CONFLICT-Denial fehlt`);
    }
  }

  console.log(`PASS: ${sourcePayloads.length} NOT_AVAILABLE-CONFLICT-Denials verifiziert.`);
}

runTests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
