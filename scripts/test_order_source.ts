import { createOrderFromErfassung } from "../src/app/actions/erfassung.actions";
import { VALID_ORDER_SOURCES } from "../src/lib/validation/orderSchema";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { db } from "../src/db";

async function runTests() {
  console.log("Starte Validierungstests für source-Feld...");
  
  let passed = 0;
  let failed = 0;

  const runTest = async (name: string, payload: any, expectedError: boolean, expectedSourceVal?: string) => {
    const result = await createOrderFromErfassung({
      customerId: "test-customer",
      title: "Test Auftrag",
      ...payload
    });

    if (expectedError) {
      if (!result.ok) {
        console.log(`[PASS] ${name}: Wurde korrekt abgelehnt (${result.error})`);
        passed++;
      } else {
        console.log(`[FAIL] ${name}: Wurde nicht abgelehnt!`);
        failed++;
      }
    } else {
      if (result.ok && result.order) {
        const order = result.order;
        if (order.source === expectedSourceVal) {
          console.log(`[PASS] ${name}: Erfolgreich erstellt mit source=${order.source}`);
          passed++;
        } else {
          console.log(`[FAIL] ${name}: Erstellt, aber falscher source=${order.source}`);
          failed++;
        }
      } else {
        console.log(`[FAIL] ${name}: Unerwarteter Fehler: ${result.error}`);
        failed++;
      }
    }
  };

  await runTest("Auftrag ohne source", {}, true);
  await runTest("Auftrag mit source null", { source: null }, true);
  await runTest("Auftrag mit source unbekannt", { source: "unbekannt" }, true);
  await runTest("Manuelle Erfassung", { source: "manual" }, false, "manual");
  await runTest("Kundenakte", { source: "customer" }, false, "customer");
  await runTest("Capture", { source: "capture" }, false, "capture");
  await runTest("Integrationstest", { source: "integration-test" }, false, "integration-test");

  console.log(`\nTestergebnisse: ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exit(1);
}

runTests().then(() => process.exit(0)).catch(console.error);
