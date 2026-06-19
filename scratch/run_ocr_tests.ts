import { POST } from "../src/app/api/ocr-process/route";
import { db } from "../src/db";
import { beleg } from "../src/db/schema_buchhaltung";
import { eq } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function testOCR(storagePath: string, testName: string) {
  console.log(`\n--- Test Run: ${testName} (${storagePath}) ---`);
  
  const mockReq = {
    json: async () => ({ storagePath })
  } as Request;

  try {
    const res = await POST(mockReq);
    const data = await res.json();
    console.log("API Response:", data);

    if (data.belegId) {
      const records = await db.select().from(beleg).where(eq(beleg.id, data.belegId));
      if (records.length > 0) {
        const r = records[0];
        console.log("Database Record:");
        console.log({
          id: r.id,
          originalDatei: r.originalDatei,
          lieferantText: r.lieferantText,
          belegdatum: r.belegdatum,
          brutto: r.brutto,
          netto: r.netto,
          ustSatz: r.ustSatz,
          ustBetrag: r.ustBetrag,
          ocrConfidence: r.ocrConfidence,
          status: r.status,
          belegart: r.belegart,
          zahlungsart: r.zahlungsart,
          rechnungsnummerExtern: r.rechnungsnummerExtern
        });
      } else {
        console.log("No DB record found for ID:", data.belegId);
      }
    }
  } catch (error) {
    console.error("Test failed with error:", error);
  }
}

async function run() {
  // Test 1: Clear receipt - we want to see what happens
  await testOCR("test/clear_beleg.jpg", "Klarer Beleg (Versuch)");
  // Test 2: Unclear receipt - we want to see what happens
  await testOCR("test/unclear_beleg.jpg", "Unklarer Beleg (Versuch)");
  
  process.exit(0);
}

run();
