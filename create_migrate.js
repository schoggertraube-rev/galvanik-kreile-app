const fs = require('fs');

const code = `
import { db } from "./src/db/index";
import { sql } from "drizzle-orm";

async function main() {
  try {
    await db.execute(sql\`ALTER TABLE "beleg" ADD COLUMN "ocr_rohtext" text;\`).catch(() => console.log('ocr_rohtext exists'));
    await db.execute(sql\`ALTER TABLE "beleg" ADD COLUMN "ocr_positionen" jsonb;\`).catch(() => console.log('ocr_positionen exists'));
    await db.execute(sql\`ALTER TABLE "beleg" ADD COLUMN "ocr_provider" text;\`).catch(() => console.log('ocr_provider exists'));
    await db.execute(sql\`ALTER TABLE "beleg" ADD COLUMN "zahlungsart" text;\`).catch(() => console.log('zahlungsart exists'));
    await db.execute(sql\`ALTER TABLE "beleg" ADD COLUMN "rechnungsnummer_extern" text;\`).catch(() => console.log('rechnungsnummer_extern exists'));
    
    await db.execute(sql\`
      CREATE TABLE IF NOT EXISTS "audit_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "action" text NOT NULL,
        "entity_id" text NOT NULL,
        "details" jsonb,
        "erstellt_von" uuid,
        "erstellt_am" timestamp NOT NULL DEFAULT now()
      );
    \`).catch(() => console.log('audit_log exists'));

    console.log("Migration successful");
  } catch (error) {
    console.error("Migration failed:", error);
  }
  process.exit(0);
}

main();
`;

fs.writeFileSync('migrate_manual.ts', code);
console.log("migrate script created");
