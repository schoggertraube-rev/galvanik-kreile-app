import { POST } from "./src/app/api/ocr-process/route";
import { db } from "./src/db";
import { beleg, kraftstoffDetail } from "./src/db/schema_buchhaltung";
import { eq } from "drizzle-orm";

async function runE2E() {
  console.log("Starting E2E Test for Beleg-Durchlauf...");
  
  // Simulated storage path
  const storagePath = "test/aral_beleg.jpg";
  
  console.log("1. Triggering OCR API...");
  
  const mockReq = {
    json: async () => ({ storagePath })
  } as Request;

  const res = await POST(mockReq);
  const data = await res.json();
  
  console.log("API Response:", data);
  
  if (!data.ok || !data.belegId) {
    console.error("OCR API failed:", data);
    process.exit(1);
  }

  console.log("2. Verifying Beleg in DB...");
  const belegDb = await db.select().from(beleg).where(eq(beleg.id, data.belegId));
  console.log("Beleg found:", belegDb[0]?.lieferantText, "mit Brutto:", belegDb[0]?.brutto);
  
  if (!belegDb[0] || belegDb[0].lieferantText !== "Aral") {
    console.error("Beleg data mismatch. Expected Aral.");
    process.exit(1);
  }

  console.log("3. Verifying Kraftstoff-Verteilung...");
  const kDetail = await db.select().from(kraftstoffDetail).where(eq(kraftstoffDetail.belegId, data.belegId));
  console.log("Kraftstoff Detail:", kDetail[0]);
  
  if (!kDetail[0] || kDetail[0].liter !== "65.00") {
    console.error("Kraftstoff Detail mismatch. Expected 65 liters.", kDetail[0]);
    process.exit(1);
  }

  console.log("✅ E2E Test erfolgreich! Alle Komponenten (OCR, Kategorisierung, Verteilung) funktionieren.");
  process.exit(0);
}

runE2E();
