import { db } from "./index";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Starting manual schema migration for Marketing Tracking (Spec 28)...");

  try {
    console.log("Creating table marketing_touchpoints...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "marketing_touchpoints" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" varchar(50) NOT NULL DEFAULT 'galvanik-kreile',
        "aktion_id" text,
        "kanal" text NOT NULL,
        "titel" text,
        "ausgefuehrt_am" timestamp NOT NULL DEFAULT now(),
        "budget" numeric(12, 2) DEFAULT '0',
        "aufwand_minuten" integer DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    console.log("Creating table kosten_posten...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "kosten_posten" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" varchar(50) NOT NULL DEFAULT 'galvanik-kreile',
        "modul" text NOT NULL DEFAULT 'marketing',
        "kanal" text,
        "kampagne_id" text,
        "beschreibung" text,
        "betrag" numeric(12, 2) NOT NULL,
        "gebucht_am" timestamp NOT NULL DEFAULT now()
      );
    `);

    console.log("Altering table inquiries...");
    await db.execute(sql`
      ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "quelle_typ" text NOT NULL DEFAULT 'unbekannt';
      ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "quelle_touchpoint_id" uuid;
      ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "quelle_manuell" text;
      ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "quelle_konfidenz" numeric(5,2);
    `);

    console.log("Altering table orders...");
    await db.execute(sql`
      ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "inquiry_id" text;
    `);

    console.log("Migration successful.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    process.exit(0);
  }
}

main();
