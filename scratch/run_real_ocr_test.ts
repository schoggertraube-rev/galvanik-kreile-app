import { POST } from "../src/app/api/ocr-process/route";
import { db } from "../src/db";
import { beleg } from "../src/db/schema_buchhaltung";
import { eq } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("CRITICAL ERROR: GEMINI_API_KEY is not defined in the environment. Stopping execution as per stop condition.");
  process.exit(1);
}

async function run() {
  console.log("Triggering real OCR processing via Gemini API for test/real_receipt.png...");

  const storagePath = "test/real_receipt.png";
  const mockReq = {
    json: async () => ({ storagePath })
  } as Request;

  try {
    const res = await POST(mockReq);
    const data = await res.json();
    console.log("\n--- Route API Response ---");
    console.log(JSON.stringify(data, null, 2));

    if (!data.ok || !data.belegId) {
      console.error("OCR Route returned failure state:", data);
      process.exit(1);
    }

    console.log("\n--- Querying Database for Created Record ---");
    const records = await db.select().from(beleg).where(eq(beleg.id, data.belegId));
    if (records.length > 0) {
      const r = records[0];
      console.log("Database Record Contents:");
      console.log(JSON.stringify({
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
        rechnungsnummerExtern: r.rechnungsnummerExtern,
        ocrProvider: r.ocrProvider
      }, null, 2));
      console.log("\n✅ Real OCR Test completed successfully!");
      process.exit(0);
    } else {
      console.error("No record found in database for ID:", data.belegId);
      process.exit(1);
    }
  } catch (error) {
    console.error("E2E Real OCR test failed with error:", error);
    process.exit(1);
  }
}

run();
