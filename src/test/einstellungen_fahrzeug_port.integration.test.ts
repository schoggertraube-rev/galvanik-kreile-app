import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { expect, test } from "vitest";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { liesAktiveFahrzeugauswahl, speichereFahrzeug } from "@/modules/fundament/server-public";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("EINSTELLUNGEN_LOCAL_TEST_DATABASE_REQUIRED");
}

test("KP10 stores one tenant-bound vehicle and retries without a second record", async () => {
  const tenantId = `TEST-vehicle-${randomUUID()}`;
  const actorId = randomUUID();
  const vehicleId = randomUUID();
  await expect(withPrivilegedTenantTransaction({ tenantId }, async tx => {
    await tx.execute(sql`INSERT INTO public.app_users
      (id,tenant_id,email,full_name,role,active,created_at,updated_at)
      VALUES (${actorId}::uuid,${tenantId},${actorId + "@test.invalid"},'TEST-Fahrzeug','meister',true,
        statement_timestamp(),statement_timestamp())`);
    const context = { tenantId, actorId, canManageCompany: true };
    const input = { id: vehicleId, version: 0, kennzeichen: "TEST-KR-1", art: "TEST-Transporter",
      kraftstoff: "TEST-Diesel", tankkarte: null, fahrerId: null, startKm: 100, aktiv: true };
    expect((await speichereFahrzeug(tx, context, input)).code).toBe("OK");
    expect((await speichereFahrzeug(tx, context, input)).code).toBe("OK");
    expect(await liesAktiveFahrzeugauswahl(tx, tenantId)).toHaveLength(1);
    expect((await speichereFahrzeug(tx, context, { ...input, version: 1, aktiv: false })).code).toBe("OK");
    expect(await liesAktiveFahrzeugauswahl(tx, tenantId)).toHaveLength(0);
    expect((await speichereFahrzeug(tx, { ...context, canManageCompany: false }, input)).code).toBe("FORBIDDEN");
    throw new Error("EINSTELLUNGEN_VEHICLE_TEST_ROLLBACK");
  })).rejects.toThrow("EINSTELLUNGEN_VEHICLE_TEST_ROLLBACK");
});
