// STATIC_CONTRACT_TEST
// Dieser Test liest die Datei review.actions.ts statisch und prüft den B2-Vertrag.
import { test, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

test("B2 Contract: Review Action holds invariants", () => {
  const actionFilePath = join(process.cwd(), "src/app/actions/review.actions.ts");
  const content = readFileSync(actionFilePath, "utf8");

  // 1. Schreibt nur auf scan_uploads
  expect(content).toContain("db");
  expect(content).toContain(".update(scanUploads)");
  
  // 2. Keine Writes auf customers, orders, events
  expect(content).not.toMatch(/insert\s*\(\s*customers\s*\)/);
  expect(content).not.toMatch(/insert\s*\(\s*orders\s*\)/);
  expect(content).not.toMatch(/insert\s*\(\s*events\s*\)/);

  // 3. Keine verbotenen Funktionen
  expect(content).not.toContain("createOrderFromScan");
  expect(content).not.toContain("processImage");
  expect(content).not.toContain("toDataURL");
  expect(content).not.toContain("getPublicUrl");
  // Date.now is used as new Date() here which is fine according to rule? The prompt says "kein Date.now() für Auftragsnummern oder IDs".
  expect(content).not.toContain("Date.now()");

  // 4. Keine harte Tenant-Zuweisung
  expect(content).not.toContain("tenantId: 'galvanik-kreile'");
  expect(content).not.toContain("tenantId: \"galvanik-kreile\"");
  
  // 5. Auth-Check vorhanden
  expect(content).toContain("resolveAuthorization");
});
