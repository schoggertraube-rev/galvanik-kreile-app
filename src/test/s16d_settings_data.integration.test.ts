import { expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { readLagerEinstellungen, readKanalAnhangGrenzen } from "@/modules/fundament/server-public";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).hostname !== "127.0.0.1") {
  throw new Error("S16D_LOCAL_TEST_DATABASE_REQUIRED");
}

test("S16d reads the same defaults without a company row and the changed row in its transaction", async () => {
  const tenantId = `TEST-s16d-${crypto.randomUUID()}`;
  const withoutRow = await readLagerEinstellungen(tenantId);
  expect(withoutRow).toMatchObject({
    offline_max_stunden: 24,
    geraetefreigabe_aktiv: true,
    automatische_inventur_aktiv: false,
    bilanzbewertung_methode: "unbewertet",
  });
  expect(await readKanalAnhangGrenzen(tenantId)).toEqual({ anhang_max_mb: 25, mime_original_max_mb: 35 });

  await expect(withPrivilegedTenantTransaction({ tenantId }, async tx => {
    await tx.execute(sql`INSERT INTO public.company_settings (id,tenant_id) VALUES ('default',${tenantId})`);
    expect(await readLagerEinstellungen(tenantId, tx)).toEqual(withoutRow);
    await tx.execute(sql`UPDATE public.company_settings SET offline_max_stunden=20,
      geraetefreigabe_aktiv=false, automatische_inventur_aktiv=true,
      anhang_max_mb=30, mime_original_max_mb=45 WHERE tenant_id=${tenantId}`);
    expect(await readLagerEinstellungen(tenantId, tx)).toMatchObject({
      offline_max_stunden: 20,
      geraetefreigabe_aktiv: false,
      automatische_inventur_aktiv: true,
    });
    throw new Error("S16D_TEST_ROLLBACK");
  })).rejects.toThrow("S16D_TEST_ROLLBACK");
  expect(await readLagerEinstellungen(tenantId)).toEqual(withoutRow);
});
